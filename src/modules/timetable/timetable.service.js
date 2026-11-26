import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso, todayIsoDate } from '@/lib/dates/format';
import { recordBestEffortAudit } from '@/modules/audit/audit.service';
import {
  countSlotsReferencingRoom,
  createAcademicCalendarEntry,
  createRoom,
  createTimetableSlot,
  deleteAcademicCalendarEntryById,
  deleteRoomById,
  deleteTimetableSlotById,
  findAcademicCalendarEntryById,
  findAcademicCalendarEntryBySessionAndDate,
  findConflictingTimetableSlots,
  findRoomById,
  findTimetableSlotById,
  listAcademicCalendarPaginated,
  listRoomsPaginated,
  listTimetableSlotsForClass,
  listTimetableSlotsForDay,
  listTimetableSlotsForTeacher,
  listTimetableSlotsPaginated,
  updateAcademicCalendarEntry,
  updateRoom,
  updateTimetableSlot,
} from '@/modules/timetable/timetable.repository';

const MAX_IN_PARAMS = 90;

export class TimetableServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   * @param {unknown} [details]
   */
  constructor(code, message, status, details) {
    super(message);
    this.name = 'TimetableServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isUniqueConstraintError(error) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function buildPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

function chunkArray(items, size = MAX_IN_PARAMS) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isoDateToDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map((part) => Number.parseInt(part, 10));
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

// ---------------------------------------------------------------------------
// Cross-D1 Reference Validators & Hydration Helpers
// ---------------------------------------------------------------------------

async function assertAcademicSessionExists(workerEnv, academicSessionId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare('SELECT id FROM academic_sessions WHERE id = ? LIMIT 1')
    .bind(academicSessionId)
    .first();

  if (!row) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'Referenced academic session does not exist.',
      400
    );
  }
}

async function resolveAcademicSessionId(workerEnv, academicSessionId) {
  if (academicSessionId) {
    await assertAcademicSessionExists(workerEnv, academicSessionId);
    return academicSessionId;
  }

  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare('SELECT id FROM academic_sessions WHERE is_active = 1 LIMIT 1')
    .first();

  if (!row?.id) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'No active academic session found. Specify academicSessionId explicitly.',
      400
    );
  }

  return row.id;
}

async function assertClassExists(workerEnv, classId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare('SELECT id, name, grade_level, section FROM classes WHERE id = ? LIMIT 1')
    .bind(classId)
    .first();

  if (!row) {
    throw new TimetableServiceError('VALIDATION_ERROR', 'Referenced class does not exist.', 400);
  }

  return {
    id: row.id,
    name: row.name,
    gradeLevel: Number(row.grade_level),
    section: row.section ?? null,
  };
}

async function assertSubjectExists(workerEnv, subjectId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare('SELECT id FROM subjects WHERE id = ? LIMIT 1')
    .bind(subjectId)
    .first();

  if (!row) {
    throw new TimetableServiceError('VALIDATION_ERROR', 'Referenced subject does not exist.', 400);
  }
}

async function assertClassSubjectMapped(workerEnv, { academicSessionId, classId, subjectId }) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare(
      `SELECT id
       FROM class_subjects
       WHERE academic_session_id = ? AND class_id = ? AND subject_id = ?
       LIMIT 1`
    )
    .bind(academicSessionId, classId, subjectId)
    .first();

  if (!row) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'Subject is not mapped to this class and academic session.',
      400
    );
  }
}

async function assertTeacherProfileActive(workerEnv, teacherProfileId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare(
      `SELECT id, full_name, employee_code
       FROM teacher_profiles
       WHERE id = ? AND employment_status = 'ACTIVE'
       LIMIT 1`
    )
    .bind(teacherProfileId)
    .first();

  if (!row) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'Referenced teacher profile does not exist or is not ACTIVE.',
      400
    );
  }

  return {
    id: row.id,
    fullName: row.full_name,
    employeeCode: row.employee_code,
  };
}

async function assertTeacherAssignedToClassSubject(
  workerEnv,
  { academicSessionId, classId, subjectId, teacherProfileId }
) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare(
      `SELECT id
       FROM teacher_assignments
       WHERE teacher_profile_id = ?
         AND academic_session_id = ?
         AND class_id = ?
         AND subject_id = ?
       LIMIT 1`
    )
    .bind(teacherProfileId, academicSessionId, classId, subjectId)
    .first();

  if (!row) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'Teacher is not assigned to this class, subject, and academic session.',
      400
    );
  }
}

async function validateSlotReferences(
  dbTimetable,
  workerEnv,
  { academicSessionId, classId, subjectId, teacherProfileId, roomId, roomName }
) {
  await assertAcademicSessionExists(workerEnv, academicSessionId);
  await assertClassExists(workerEnv, classId);
  await assertSubjectExists(workerEnv, subjectId);
  await assertClassSubjectMapped(workerEnv, { academicSessionId, classId, subjectId });
  await assertTeacherProfileActive(workerEnv, teacherProfileId);
  await assertTeacherAssignedToClassSubject(workerEnv, {
    academicSessionId,
    classId,
    subjectId,
    teacherProfileId,
  });

  let resolvedRoomName = roomName ?? null;
  if (roomId) {
    const room = await findRoomById(dbTimetable, roomId);
    if (!room) {
      throw new TimetableServiceError('VALIDATION_ERROR', 'Referenced room does not exist.', 400);
    }
    if (!room.isActive) {
      throw new TimetableServiceError('VALIDATION_ERROR', 'Referenced room is inactive.', 400);
    }
    if (!resolvedRoomName) {
      resolvedRoomName = room.name;
    }
  }

  return { resolvedRoomName };
}

function describeSlotConflict(candidate, conflicts) {
  for (const existing of conflicts) {
    if (existing.classId === candidate.classId) {
      return `Class already has a conflicting timetable slot on day ${candidate.dayOfWeek} (period ${existing.periodNumber}, ${existing.startTime}-${existing.endTime}).`;
    }
    if (existing.teacherProfileId === candidate.teacherProfileId) {
      return `Teacher already has a conflicting timetable slot on day ${candidate.dayOfWeek} (period ${existing.periodNumber}, ${existing.startTime}-${existing.endTime}).`;
    }
    if (candidate.roomId && existing.roomId === candidate.roomId) {
      return `Room is already booked on day ${candidate.dayOfWeek} (period ${existing.periodNumber}, ${existing.startTime}-${existing.endTime}).`;
    }
  }
  return 'Timetable slot conflicts with an existing slot.';
}

async function hydrateSlotsWithAcademics(workerEnv, slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  let dbAcademics;
  try {
    dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  } catch {
    return slots;
  }

  const classIds = [...new Set(slots.map((s) => s.classId))];
  const subjectIds = [...new Set(slots.map((s) => s.subjectId))];
  const teacherIds = [...new Set(slots.map((s) => s.teacherProfileId))];

  const classMap = new Map();
  for (const chunk of chunkArray(classIds)) {
    const res = await dbAcademics
      .prepare(
        `SELECT id, name, grade_level, section FROM classes WHERE id IN (${buildPlaceholders(chunk.length)})`
      )
      .bind(...chunk)
      .all();
    for (const row of res.results || []) {
      classMap.set(row.id, {
        id: row.id,
        name: row.name,
        gradeLevel: Number(row.grade_level),
        section: row.section ?? null,
      });
    }
  }

  const subjectMap = new Map();
  for (const chunk of chunkArray(subjectIds)) {
    const res = await dbAcademics
      .prepare(
        `SELECT id, name, code FROM subjects WHERE id IN (${buildPlaceholders(chunk.length)})`
      )
      .bind(...chunk)
      .all();
    for (const row of res.results || []) {
      subjectMap.set(row.id, {
        id: row.id,
        name: row.name,
        code: row.code,
      });
    }
  }

  const teacherMap = new Map();
  for (const chunk of chunkArray(teacherIds)) {
    const res = await dbAcademics
      .prepare(
        `SELECT id, full_name, employee_code FROM teacher_profiles WHERE id IN (${buildPlaceholders(chunk.length)})`
      )
      .bind(...chunk)
      .all();
    for (const row of res.results || []) {
      teacherMap.set(row.id, {
        id: row.id,
        fullName: row.full_name,
        employeeCode: row.employee_code,
      });
    }
  }

  return slots.map((slot) => ({
    ...slot,
    classInfo: classMap.get(slot.classId) ?? null,
    subject: subjectMap.get(slot.subjectId) ?? null,
    teacher: teacherMap.get(slot.teacherProfileId) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * List rooms with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ page: number, pageSize: number, search?: string, isActive?: boolean }} query
 */
export async function listRoomsService(dbTimetable, query) {
  return await listRoomsPaginated(dbTimetable, {
    search: query.search,
    isActive: query.isActive,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single room by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} roomId
 */
export async function getRoomByIdService(dbTimetable, roomId) {
  const room = await findRoomById(dbTimetable, roomId);
  if (!room) {
    throw new TimetableServiceError('NOT_FOUND', 'Room not found.', 404);
  }
  return room;
}

/**
 * Create a new room.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ name: string, code: string, capacity?: number | null, floorOrBuilding?: string | null, isActive?: boolean }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function createRoomService(dbTimetable, workerEnv, actorSession, input, meta = {}) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();

  try {
    await createRoom(dbTimetable, {
      id,
      name: input.name,
      code: input.code,
      capacity: input.capacity ?? null,
      floorOrBuilding: input.floorOrBuilding ?? null,
      isActive: input.isActive === false ? 0 : 1,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'A room with this name or code already exists.',
        409
      );
    }
    throw error;
  }

  const created = await findRoomById(dbTimetable, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'rooms',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
    createdAt,
  });

  return created;
}

/**
 * Update or soft-deactivate a room.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} roomId
 * @param {{ name?: string, code?: string, capacity?: number | null, floorOrBuilding?: string | null, isActive?: boolean }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function updateRoomService(
  dbTimetable,
  workerEnv,
  actorSession,
  roomId,
  input,
  meta = {}
) {
  const existing = await findRoomById(dbTimetable, roomId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Room not found.', 404);
  }

  const fields = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.code !== undefined) fields.code = input.code;
  if (input.capacity !== undefined) fields.capacity = input.capacity;
  if (input.floorOrBuilding !== undefined) fields.floorOrBuilding = input.floorOrBuilding;
  if (input.isActive !== undefined) fields.isActive = input.isActive ? 1 : 0;

  try {
    await updateRoom(dbTimetable, roomId, fields);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'A room with this name or code already exists.',
        409
      );
    }
    throw error;
  }

  const updated = await findRoomById(dbTimetable, roomId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'rooms',
    entityId: roomId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

/**
 * Delete a room only if no timetable slots reference it. Returns `409 CONFLICT` otherwise.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} roomId
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function deleteRoomService(dbTimetable, workerEnv, actorSession, roomId, meta = {}) {
  const existing = await findRoomById(dbTimetable, roomId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Room not found.', 404);
  }

  const refCount = await countSlotsReferencingRoom(dbTimetable, roomId);
  if (refCount > 0) {
    throw new TimetableServiceError(
      'CONFLICT',
      'Room cannot be deleted because it is referenced by existing timetable slots. Deactivate it instead.',
      409
    );
  }

  await deleteRoomById(dbTimetable, roomId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'DELETE',
    entityType: 'rooms',
    entityId: roomId,
    oldValues: existing,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return { id: roomId, deleted: true };
}

// ---------------------------------------------------------------------------
// Timetable Slots
// ---------------------------------------------------------------------------

/**
 * List timetable slots with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ page: number, pageSize: number, academicSessionId?: string, classId?: string, subjectId?: string, teacherProfileId?: string, roomId?: string, dayOfWeek?: number }} query
 */
export async function listTimetableSlotsService(dbTimetable, query) {
  return await listTimetableSlotsPaginated(dbTimetable, {
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    subjectId: query.subjectId,
    teacherProfileId: query.teacherProfileId,
    roomId: query.roomId,
    dayOfWeek: query.dayOfWeek,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single timetable slot by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} slotId
 */
export async function getTimetableSlotByIdService(dbTimetable, slotId) {
  const slot = await findTimetableSlotById(dbTimetable, slotId);
  if (!slot) {
    throw new TimetableServiceError('NOT_FOUND', 'Timetable slot not found.', 404);
  }
  return slot;
}

/**
 * Create a timetable slot with cross-D1 validation and class/teacher/room collision checks.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{
 *   academicSessionId: string,
 *   classId: string,
 *   subjectId: string,
 *   teacherProfileId: string,
 *   roomId?: string | null,
 *   roomName?: string | null,
 *   dayOfWeek: number,
 *   periodNumber: number,
 *   startTime: string,
 *   endTime: string,
 * }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function createTimetableSlotService(
  dbTimetable,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  const { resolvedRoomName } = await validateSlotReferences(dbTimetable, workerEnv, {
    academicSessionId: input.academicSessionId,
    classId: input.classId,
    subjectId: input.subjectId,
    teacherProfileId: input.teacherProfileId,
    roomId: input.roomId ?? null,
    roomName: input.roomName ?? null,
  });

  const conflicts = await findConflictingTimetableSlots(dbTimetable, {
    academicSessionId: input.academicSessionId,
    dayOfWeek: input.dayOfWeek,
    periodNumber: input.periodNumber,
    startTime: input.startTime,
    endTime: input.endTime,
    classId: input.classId,
    teacherProfileId: input.teacherProfileId,
    roomId: input.roomId ?? null,
  });

  if (conflicts.length > 0) {
    throw new TimetableServiceError(
      'CONFLICT',
      describeSlotConflict(input, conflicts),
      409,
      { conflictingSlotIds: conflicts.map((c) => c.id) }
    );
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  try {
    await createTimetableSlot(dbTimetable, {
      id,
      academicSessionId: input.academicSessionId,
      classId: input.classId,
      subjectId: input.subjectId,
      teacherProfileId: input.teacherProfileId,
      roomId: input.roomId ?? null,
      roomName: resolvedRoomName,
      dayOfWeek: input.dayOfWeek,
      periodNumber: input.periodNumber,
      startTime: input.startTime,
      endTime: input.endTime,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'Timetable slot conflicts with an existing class or teacher period.',
        409
      );
    }
    throw error;
  }

  const created = await findTimetableSlotById(dbTimetable, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'timetable_slots',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
    createdAt,
  });

  return created;
}

/**
 * Update an existing timetable slot with cross-D1 validation and collision checks.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} slotId
 * @param {Record<string, unknown>} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function updateTimetableSlotService(
  dbTimetable,
  workerEnv,
  actorSession,
  slotId,
  input,
  meta = {}
) {
  const existing = await findTimetableSlotById(dbTimetable, slotId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Timetable slot not found.', 404);
  }

  const nextStartTime = input.startTime ?? existing.startTime;
  const nextEndTime = input.endTime ?? existing.endTime;
  if (nextEndTime <= nextStartTime) {
    throw new TimetableServiceError(
      'VALIDATION_ERROR',
      'End time must be after start time.',
      400
    );
  }

  const nextSubjectId = input.subjectId ?? existing.subjectId;
  const nextTeacherProfileId = input.teacherProfileId ?? existing.teacherProfileId;
  const nextRoomId = input.roomId !== undefined ? input.roomId : existing.roomId;
  const nextRoomName =
    input.roomName !== undefined
      ? input.roomName
      : input.roomId === null
        ? null
        : input.roomId !== undefined && input.roomId !== existing.roomId
          ? null
          : existing.roomName;
  const nextDayOfWeek = input.dayOfWeek ?? existing.dayOfWeek;
  const nextPeriodNumber = input.periodNumber ?? existing.periodNumber;

  const { resolvedRoomName } = await validateSlotReferences(dbTimetable, workerEnv, {
    academicSessionId: existing.academicSessionId,
    classId: existing.classId,
    subjectId: nextSubjectId,
    teacherProfileId: nextTeacherProfileId,
    roomId: nextRoomId,
    roomName: nextRoomName,
  });

  const candidate = {
    academicSessionId: existing.academicSessionId,
    dayOfWeek: nextDayOfWeek,
    periodNumber: nextPeriodNumber,
    startTime: nextStartTime,
    endTime: nextEndTime,
    classId: existing.classId,
    teacherProfileId: nextTeacherProfileId,
    roomId: nextRoomId,
    excludeSlotId: slotId,
  };

  const conflicts = await findConflictingTimetableSlots(dbTimetable, candidate);
  if (conflicts.length > 0) {
    throw new TimetableServiceError(
      'CONFLICT',
      describeSlotConflict(candidate, conflicts),
      409,
      { conflictingSlotIds: conflicts.map((c) => c.id) }
    );
  }

  try {
    await updateTimetableSlot(dbTimetable, slotId, {
      subjectId: input.subjectId,
      teacherProfileId: input.teacherProfileId,
      roomId: input.roomId,
      roomName:
        input.roomName !== undefined || input.roomId !== undefined ? resolvedRoomName : undefined,
      dayOfWeek: input.dayOfWeek,
      periodNumber: input.periodNumber,
      startTime: input.startTime,
      endTime: input.endTime,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'Timetable slot conflicts with an existing class or teacher period.',
        409
      );
    }
    throw error;
  }

  const updated = await findTimetableSlotById(dbTimetable, slotId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'timetable_slots',
    entityId: slotId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

/**
 * Delete a timetable slot.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} slotId
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function deleteTimetableSlotService(
  dbTimetable,
  workerEnv,
  actorSession,
  slotId,
  meta = {}
) {
  const existing = await findTimetableSlotById(dbTimetable, slotId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Timetable slot not found.', 404);
  }

  await deleteTimetableSlotById(dbTimetable, slotId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'DELETE',
    entityType: 'timetable_slots',
    entityId: slotId,
    oldValues: existing,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return { id: slotId, deleted: true };
}

/**
 * Fetch weekly (or single-day) timetable for a class, hydrated with subject/teacher details.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {string} classId
 * @param {{ academicSessionId?: string, dayOfWeek?: number }} [query]
 */
export async function getClassTimetableService(dbTimetable, workerEnv, classId, query = {}) {
  const classInfo = await assertClassExists(workerEnv, classId);
  const academicSessionId = await resolveAcademicSessionId(workerEnv, query.academicSessionId);

  const slots = await listTimetableSlotsForClass(dbTimetable, {
    academicSessionId,
    classId,
    dayOfWeek: query.dayOfWeek,
  });

  const hydrated = await hydrateSlotsWithAcademics(workerEnv, slots);
  return {
    academicSessionId,
    classId,
    classInfo,
    slots: hydrated,
  };
}

/**
 * Fetch weekly (or single-day) timetable for a teacher, hydrated with class/subject details.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {string} teacherProfileId
 * @param {{ academicSessionId?: string, dayOfWeek?: number }} [query]
 */
export async function getTeacherTimetableService(
  dbTimetable,
  workerEnv,
  teacherProfileId,
  query = {}
) {
  const teacher = await assertTeacherProfileActive(workerEnv, teacherProfileId);
  const academicSessionId = await resolveAcademicSessionId(workerEnv, query.academicSessionId);

  const slots = await listTimetableSlotsForTeacher(dbTimetable, {
    academicSessionId,
    teacherProfileId,
    dayOfWeek: query.dayOfWeek,
  });

  const hydrated = await hydrateSlotsWithAcademics(workerEnv, slots);
  return {
    academicSessionId,
    teacherProfileId,
    teacher,
    slots: hydrated,
  };
}

/**
 * Fetch timetable for a student based on their `ACTIVE` enrollment in `DB_STUDENTS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {string} studentId
 * @param {{ academicSessionId?: string, dayOfWeek?: number }} [query]
 */
export async function getStudentTimetableService(dbTimetable, workerEnv, studentId, query = {}) {
  const academicSessionId = await resolveAcademicSessionId(workerEnv, query.academicSessionId);
  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);

  const enrollment = await dbStudents
    .prepare(
      `SELECT id, student_id, academic_session_id, class_id, roll_number, enrollment_status
       FROM enrollments
       WHERE student_id = ?
         AND academic_session_id = ?
         AND enrollment_status = 'ACTIVE'
       LIMIT 1`
    )
    .bind(studentId, academicSessionId)
    .first();

  if (!enrollment) {
    throw new TimetableServiceError(
      'NOT_FOUND',
      'No active enrollment found for this student in the selected academic session.',
      404
    );
  }

  const classTimetable = await getClassTimetableService(dbTimetable, workerEnv, enrollment.class_id, {
    academicSessionId,
    dayOfWeek: query.dayOfWeek,
  });

  return {
    ...classTimetable,
    studentId,
    enrollmentId: enrollment.id,
    rollNumber: enrollment.roll_number ?? null,
  };
}

/**
 * Fetch daily timetable slots (and calendar day status if a date is specified/resolved).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ academicSessionId?: string, date?: string, dayOfWeek?: number, classId?: string, teacherProfileId?: string }} [query]
 */
export async function getDailyTimetableService(dbTimetable, workerEnv, query = {}) {
  const academicSessionId = await resolveAcademicSessionId(workerEnv, query.academicSessionId);
  const resolvedDate = query.date ?? (query.dayOfWeek === undefined ? todayIsoDate() : null);
  const dayOfWeek = query.dayOfWeek ?? isoDateToDayOfWeek(resolvedDate);

  const [slots, calendarEntry] = await Promise.all([
    listTimetableSlotsForDay(dbTimetable, {
      academicSessionId,
      dayOfWeek,
      classId: query.classId,
      teacherProfileId: query.teacherProfileId,
    }),
    resolvedDate
      ? findAcademicCalendarEntryBySessionAndDate(dbTimetable, academicSessionId, resolvedDate)
      : Promise.resolve(null),
  ]);

  const hydrated = await hydrateSlotsWithAcademics(workerEnv, slots);

  return {
    academicSessionId,
    date: resolvedDate,
    dayOfWeek,
    calendarEntry,
    slots: hydrated,
  };
}

// ---------------------------------------------------------------------------
// Academic Calendar
// ---------------------------------------------------------------------------

/**
 * List academic calendar entries with bounded pagination and date-range filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ page: number, pageSize: number, academicSessionId?: string, dayType?: string, fromDate?: string, toDate?: string }} query
 */
export async function listAcademicCalendarService(dbTimetable, query) {
  return await listAcademicCalendarPaginated(dbTimetable, {
    academicSessionId: query.academicSessionId,
    dayType: query.dayType,
    fromDate: query.fromDate,
    toDate: query.toDate,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single academic calendar entry by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} entryId
 */
export async function getAcademicCalendarEntryByIdService(dbTimetable, entryId) {
  const entry = await findAcademicCalendarEntryById(dbTimetable, entryId);
  if (!entry) {
    throw new TimetableServiceError('NOT_FOUND', 'Academic calendar entry not found.', 404);
  }
  return entry;
}

/**
 * Create an academic calendar entry after validating `academicSessionId` in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ academicSessionId: string, calendarDate: string, dayType: string, title: string, notes?: string | null }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function createAcademicCalendarEntryService(
  dbTimetable,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  await assertAcademicSessionExists(workerEnv, input.academicSessionId);

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  try {
    await createAcademicCalendarEntry(dbTimetable, {
      id,
      academicSessionId: input.academicSessionId,
      calendarDate: input.calendarDate,
      dayType: input.dayType,
      title: input.title,
      notes: input.notes ?? null,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'An academic calendar entry already exists for this session and date.',
        409
      );
    }
    throw error;
  }

  const created = await findAcademicCalendarEntryById(dbTimetable, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'academic_calendar',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
    createdAt,
  });

  return created;
}

/**
 * Update an academic calendar entry.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} entryId
 * @param {{ calendarDate?: string, dayType?: string, title?: string, notes?: string | null }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function updateAcademicCalendarEntryService(
  dbTimetable,
  workerEnv,
  actorSession,
  entryId,
  input,
  meta = {}
) {
  const existing = await findAcademicCalendarEntryById(dbTimetable, entryId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Academic calendar entry not found.', 404);
  }

  try {
    await updateAcademicCalendarEntry(dbTimetable, entryId, {
      calendarDate: input.calendarDate,
      dayType: input.dayType,
      title: input.title,
      notes: input.notes,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TimetableServiceError(
        'CONFLICT',
        'An academic calendar entry already exists for this session and date.',
        409
      );
    }
    throw error;
  }

  const updated = await findAcademicCalendarEntryById(dbTimetable, entryId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'academic_calendar',
    entityId: entryId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

/**
 * Delete an academic calendar entry.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} entryId
 * @param {{ clientIp?: string | null, requestId?: string | null }} [meta]
 */
export async function deleteAcademicCalendarEntryService(
  dbTimetable,
  workerEnv,
  actorSession,
  entryId,
  meta = {}
) {
  const existing = await findAcademicCalendarEntryById(dbTimetable, entryId);
  if (!existing) {
    throw new TimetableServiceError('NOT_FOUND', 'Academic calendar entry not found.', 404);
  }

  await deleteAcademicCalendarEntryById(dbTimetable, entryId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'DELETE',
    entityType: 'academic_calendar',
    entityId: entryId,
    oldValues: existing,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return { id: entryId, deleted: true };
}
