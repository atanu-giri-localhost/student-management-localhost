/**
 * Direct Cloudflare D1 (`DB_TIMETABLE`) repository for `rooms`, `timetable_slots`,
 * and `academic_calendar`.
 */

function mapRoomRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    floorOrBuilding: row.floor_or_building ?? null,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapTimetableSlotRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    teacherProfileId: row.teacher_profile_id,
    roomId: row.room_id ?? null,
    roomName: row.room_name ?? null,
    dayOfWeek: Number(row.day_of_week),
    periodNumber: Number(row.period_number),
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
  };
}

function mapAcademicCalendarRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    calendarDate: row.calendar_date,
    dayType: row.day_type,
    title: row.title,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} roomId
 */
export async function findRoomById(dbTimetable, roomId) {
  const row = await dbTimetable
    .prepare(
      `SELECT id, name, code, capacity, floor_or_building, is_active, created_at
       FROM rooms
       WHERE id = ?
       LIMIT 1`
    )
    .bind(roomId)
    .first();
  return mapRoomRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ search?: string, isActive?: boolean, limit: number, offset: number }} filters
 */
export async function listRoomsPaginated(dbTimetable, filters) {
  const where = [];
  const params = [];

  if (typeof filters.isActive === 'boolean') {
    where.push('is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }
  if (filters.search) {
    where.push('(name LIKE ? OR code LIKE ?)');
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbTimetable.batch([
    dbTimetable.prepare(`SELECT COUNT(*) AS total FROM rooms ${clause}`).bind(...params),
    dbTimetable
      .prepare(
        `SELECT id, name, code, capacity, floor_or_building, is_active, created_at
         FROM rooms
         ${clause}
         ORDER BY is_active DESC, name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results?.[0]?.total ?? 0),
    items: (rowsRes.results || []).map(mapRoomRow),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ id: string, name: string, code: string, capacity: number | null, floorOrBuilding: string | null, isActive: number, createdAt: string }} room
 */
export async function createRoom(dbTimetable, room) {
  await dbTimetable
    .prepare(
      `INSERT INTO rooms (id, name, code, capacity, floor_or_building, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      room.id,
      room.name,
      room.code,
      room.capacity ?? null,
      room.floorOrBuilding ?? null,
      room.isActive,
      room.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} roomId
 * @param {{ name?: string, code?: string, capacity?: number | null, floorOrBuilding?: string | null, isActive?: number }} fields
 */
export async function updateRoom(dbTimetable, roomId, fields) {
  const setClauses = [];
  const params = [];

  if (fields.name !== undefined) {
    setClauses.push('name = ?');
    params.push(fields.name);
  }
  if (fields.code !== undefined) {
    setClauses.push('code = ?');
    params.push(fields.code);
  }
  if (fields.capacity !== undefined) {
    setClauses.push('capacity = ?');
    params.push(fields.capacity);
  }
  if (fields.floorOrBuilding !== undefined) {
    setClauses.push('floor_or_building = ?');
    params.push(fields.floorOrBuilding);
  }
  if (fields.isActive !== undefined) {
    setClauses.push('is_active = ?');
    params.push(fields.isActive);
  }

  if (setClauses.length === 0) {
    return;
  }

  await dbTimetable
    .prepare(`UPDATE rooms SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...params, roomId)
    .run();
}

/**
 * Count how many timetable slots reference a given room.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} roomId
 * @returns {Promise<number>}
 */
export async function countSlotsReferencingRoom(dbTimetable, roomId) {
  const row = await dbTimetable
    .prepare('SELECT COUNT(*) AS total FROM timetable_slots WHERE room_id = ?')
    .bind(roomId)
    .first();
  return Number(row?.total ?? 0);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} roomId
 */
export async function deleteRoomById(dbTimetable, roomId) {
  await dbTimetable.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
}

// ---------------------------------------------------------------------------
// Timetable Slots
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} slotId
 */
export async function findTimetableSlotById(dbTimetable, slotId) {
  const row = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
              room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       FROM timetable_slots
       WHERE id = ?
       LIMIT 1`
    )
    .bind(slotId)
    .first();
  return mapTimetableSlotRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ academicSessionId?: string, classId?: string, subjectId?: string, teacherProfileId?: string, roomId?: string, dayOfWeek?: number, limit: number, offset: number }} filters
 */
export async function listTimetableSlotsPaginated(dbTimetable, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.classId) {
    where.push('class_id = ?');
    params.push(filters.classId);
  }
  if (filters.subjectId) {
    where.push('subject_id = ?');
    params.push(filters.subjectId);
  }
  if (filters.teacherProfileId) {
    where.push('teacher_profile_id = ?');
    params.push(filters.teacherProfileId);
  }
  if (filters.roomId) {
    where.push('room_id = ?');
    params.push(filters.roomId);
  }
  if (filters.dayOfWeek !== undefined) {
    where.push('day_of_week = ?');
    params.push(filters.dayOfWeek);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbTimetable.batch([
    dbTimetable.prepare(`SELECT COUNT(*) AS total FROM timetable_slots ${clause}`).bind(...params),
    dbTimetable
      .prepare(
        `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
                room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
         FROM timetable_slots
         ${clause}
         ORDER BY day_of_week ASC, period_number ASC, start_time ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results?.[0]?.total ?? 0),
    items: (rowsRes.results || []).map(mapTimetableSlotRow),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ academicSessionId: string, classId: string, dayOfWeek?: number }} filters
 */
export async function listTimetableSlotsForClass(dbTimetable, filters) {
  const where = ['academic_session_id = ?', 'class_id = ?'];
  const params = [filters.academicSessionId, filters.classId];

  if (filters.dayOfWeek !== undefined) {
    where.push('day_of_week = ?');
    params.push(filters.dayOfWeek);
  }

  const res = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
              room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       FROM timetable_slots
       WHERE ${where.join(' AND ')}
       ORDER BY day_of_week ASC, period_number ASC, start_time ASC
       LIMIT 200`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapTimetableSlotRow);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ academicSessionId: string, teacherProfileId: string, dayOfWeek?: number }} filters
 */
export async function listTimetableSlotsForTeacher(dbTimetable, filters) {
  const where = ['academic_session_id = ?', 'teacher_profile_id = ?'];
  const params = [filters.academicSessionId, filters.teacherProfileId];

  if (filters.dayOfWeek !== undefined) {
    where.push('day_of_week = ?');
    params.push(filters.dayOfWeek);
  }

  const res = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
              room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       FROM timetable_slots
       WHERE ${where.join(' AND ')}
       ORDER BY day_of_week ASC, period_number ASC, start_time ASC
       LIMIT 200`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapTimetableSlotRow);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ academicSessionId: string, dayOfWeek: number, classId?: string, teacherProfileId?: string }} filters
 */
export async function listTimetableSlotsForDay(dbTimetable, filters) {
  const where = ['academic_session_id = ?', 'day_of_week = ?'];
  const params = [filters.academicSessionId, filters.dayOfWeek];

  if (filters.classId) {
    where.push('class_id = ?');
    params.push(filters.classId);
  }
  if (filters.teacherProfileId) {
    where.push('teacher_profile_id = ?');
    params.push(filters.teacherProfileId);
  }

  const res = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
              room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       FROM timetable_slots
       WHERE ${where.join(' AND ')}
       ORDER BY period_number ASC, start_time ASC
       LIMIT 500`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapTimetableSlotRow);
}

/**
 * Find any existing timetable slots in the same session and day that collide on either
 * `period_number` OR overlapping time range (`start_time < endTime AND end_time > startTime`)
 * for the same class, teacher, or room.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{
 *   academicSessionId: string,
 *   dayOfWeek: number,
 *   periodNumber: number,
 *   startTime: string,
 *   endTime: string,
 *   classId: string,
 *   teacherProfileId: string,
 *   roomId?: string | null,
 *   excludeSlotId?: string | null,
 * }} candidate
 */
export async function findConflictingTimetableSlots(dbTimetable, candidate) {
  const resourceChecks = ['class_id = ?', 'teacher_profile_id = ?'];
  const resourceParams = [candidate.classId, candidate.teacherProfileId];

  if (candidate.roomId) {
    resourceChecks.push('room_id = ?');
    resourceParams.push(candidate.roomId);
  }

  const where = [
    'academic_session_id = ?',
    'day_of_week = ?',
    '(period_number = ? OR (start_time < ? AND end_time > ?))',
    `(${resourceChecks.join(' OR ')})`,
  ];
  const params = [
    candidate.academicSessionId,
    candidate.dayOfWeek,
    candidate.periodNumber,
    candidate.endTime,
    candidate.startTime,
    ...resourceParams,
  ];

  if (candidate.excludeSlotId) {
    where.push('id != ?');
    params.push(candidate.excludeSlotId);
  }

  const res = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, class_id, subject_id, teacher_profile_id,
              room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       FROM timetable_slots
       WHERE ${where.join(' AND ')}
       LIMIT 20`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapTimetableSlotRow);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{
 *   id: string,
 *   academicSessionId: string,
 *   classId: string,
 *   subjectId: string,
 *   teacherProfileId: string,
 *   roomId: string | null,
 *   roomName: string | null,
 *   dayOfWeek: number,
 *   periodNumber: number,
 *   startTime: string,
 *   endTime: string,
 *   createdAt: string,
 * }} slot
 */
export async function createTimetableSlot(dbTimetable, slot) {
  await dbTimetable
    .prepare(
      `INSERT INTO timetable_slots (
         id, academic_session_id, class_id, subject_id, teacher_profile_id,
         room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      slot.id,
      slot.academicSessionId,
      slot.classId,
      slot.subjectId,
      slot.teacherProfileId,
      slot.roomId ?? null,
      slot.roomName ?? null,
      slot.dayOfWeek,
      slot.periodNumber,
      slot.startTime,
      slot.endTime,
      slot.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} slotId
 * @param {{
 *   subjectId?: string,
 *   teacherProfileId?: string,
 *   roomId?: string | null,
 *   roomName?: string | null,
 *   dayOfWeek?: number,
 *   periodNumber?: number,
 *   startTime?: string,
 *   endTime?: string,
 * }} fields
 */
export async function updateTimetableSlot(dbTimetable, slotId, fields) {
  const setClauses = [];
  const params = [];

  if (fields.subjectId !== undefined) {
    setClauses.push('subject_id = ?');
    params.push(fields.subjectId);
  }
  if (fields.teacherProfileId !== undefined) {
    setClauses.push('teacher_profile_id = ?');
    params.push(fields.teacherProfileId);
  }
  if (fields.roomId !== undefined) {
    setClauses.push('room_id = ?');
    params.push(fields.roomId);
  }
  if (fields.roomName !== undefined) {
    setClauses.push('room_name = ?');
    params.push(fields.roomName);
  }
  if (fields.dayOfWeek !== undefined) {
    setClauses.push('day_of_week = ?');
    params.push(fields.dayOfWeek);
  }
  if (fields.periodNumber !== undefined) {
    setClauses.push('period_number = ?');
    params.push(fields.periodNumber);
  }
  if (fields.startTime !== undefined) {
    setClauses.push('start_time = ?');
    params.push(fields.startTime);
  }
  if (fields.endTime !== undefined) {
    setClauses.push('end_time = ?');
    params.push(fields.endTime);
  }

  if (setClauses.length === 0) {
    return;
  }

  await dbTimetable
    .prepare(`UPDATE timetable_slots SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...params, slotId)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} slotId
 */
export async function deleteTimetableSlotById(dbTimetable, slotId) {
  await dbTimetable.prepare('DELETE FROM timetable_slots WHERE id = ?').bind(slotId).run();
}

// ---------------------------------------------------------------------------
// Academic Calendar
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} entryId
 */
export async function findAcademicCalendarEntryById(dbTimetable, entryId) {
  const row = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, calendar_date, day_type, title, notes, created_at
       FROM academic_calendar
       WHERE id = ?
       LIMIT 1`
    )
    .bind(entryId)
    .first();
  return mapAcademicCalendarRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} academicSessionId
 * @param {string} calendarDate
 */
export async function findAcademicCalendarEntryBySessionAndDate(
  dbTimetable,
  academicSessionId,
  calendarDate
) {
  const row = await dbTimetable
    .prepare(
      `SELECT id, academic_session_id, calendar_date, day_type, title, notes, created_at
       FROM academic_calendar
       WHERE academic_session_id = ? AND calendar_date = ?
       LIMIT 1`
    )
    .bind(academicSessionId, calendarDate)
    .first();
  return mapAcademicCalendarRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ academicSessionId?: string, dayType?: string, fromDate?: string, toDate?: string, limit: number, offset: number }} filters
 */
export async function listAcademicCalendarPaginated(dbTimetable, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.dayType) {
    where.push('day_type = ?');
    params.push(filters.dayType);
  }
  if (filters.fromDate) {
    where.push('calendar_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push('calendar_date <= ?');
    params.push(filters.toDate);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbTimetable.batch([
    dbTimetable.prepare(`SELECT COUNT(*) AS total FROM academic_calendar ${clause}`).bind(...params),
    dbTimetable
      .prepare(
        `SELECT id, academic_session_id, calendar_date, day_type, title, notes, created_at
         FROM academic_calendar
         ${clause}
         ORDER BY calendar_date ASC, created_at ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results?.[0]?.total ?? 0),
    items: (rowsRes.results || []).map(mapAcademicCalendarRow),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {{ id: string, academicSessionId: string, calendarDate: string, dayType: string, title: string, notes: string | null, createdAt: string }} entry
 */
export async function createAcademicCalendarEntry(dbTimetable, entry) {
  await dbTimetable
    .prepare(
      `INSERT INTO academic_calendar (
         id, academic_session_id, calendar_date, day_type, title, notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.id,
      entry.academicSessionId,
      entry.calendarDate,
      entry.dayType,
      entry.title,
      entry.notes ?? null,
      entry.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} entryId
 * @param {{ calendarDate?: string, dayType?: string, title?: string, notes?: string | null }} fields
 */
export async function updateAcademicCalendarEntry(dbTimetable, entryId, fields) {
  const setClauses = [];
  const params = [];

  if (fields.calendarDate !== undefined) {
    setClauses.push('calendar_date = ?');
    params.push(fields.calendarDate);
  }
  if (fields.dayType !== undefined) {
    setClauses.push('day_type = ?');
    params.push(fields.dayType);
  }
  if (fields.title !== undefined) {
    setClauses.push('title = ?');
    params.push(fields.title);
  }
  if (fields.notes !== undefined) {
    setClauses.push('notes = ?');
    params.push(fields.notes);
  }

  if (setClauses.length === 0) {
    return;
  }

  await dbTimetable
    .prepare(`UPDATE academic_calendar SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...params, entryId)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbTimetable
 * @param {string} entryId
 */
export async function deleteAcademicCalendarEntryById(dbTimetable, entryId) {
  await dbTimetable.prepare('DELETE FROM academic_calendar WHERE id = ?').bind(entryId).run();
}
