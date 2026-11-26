import { describe, expect, it, vi } from 'vitest';
import {
  detectMimeFromMagicBytes,
  MAX_FILE_SIZE_BYTES,
  uploadFileFieldsSchema,
} from '@/modules/files/files.schemas';
import { toPublicFileDto, uploadFileService } from '@/modules/files/files.service';
import { assertCanManageStudents, assertCanReadStudent } from '@/modules/students/students.permissions';

describe('files magic-byte validation, R2 compensation, and student RBAC', () => {
  it('detects JPEG, PNG, WebP, and PDF magic bytes and rejects unknown/spoofed payloads', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectMimeFromMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectMimeFromMagicBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(detectMimeFromMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBe('application/pdf');
    expect(detectMimeFromMagicBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(detectMimeFromMagicBytes(new Uint8Array([0x01, 0x02]))).toBeNull();
  });

  it('requires ownerEntityType and ownerEntityId to be paired', () => {
    expect(
      uploadFileFieldsSchema.safeParse({
        category: 'STUDENT_PHOTO',
        ownerEntityType: 'STUDENT',
      }).success
    ).toBe(false);

    expect(
      uploadFileFieldsSchema.safeParse({
        category: 'DOCUMENT',
      }).success
    ).toBe(true);
  });

  it('compensates with storage.delete when D1 file_objects insert fails after R2 put', async () => {
    const putMock = vi.fn(async () => {});
    const deleteMock = vi.fn(async () => {});
    const failingDb = {
      prepare: () => ({ bind: () => ({ first: async () => ({ id: 'st_1' }) }) }),
      batch: async () => {
        throw new Error('D1 insert failed');
      },
    };

    await expect(
      uploadFileService(
        failingDb,
        { put: putMock, delete: deleteMock },
        { userId: 'u_admin' },
        {
          fileBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          declaredMime: 'image/png',
          category: 'STUDENT_PHOTO',
          ownerEntityType: null,
          ownerEntityId: null,
        },
        { clientIp: '127.0.0.1', requestId: 'req_comp_1' }
      )
    ).rejects.toMatchObject({ code: 'FILE_METADATA_FAILED', status: 500 });

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock.mock.calls[0][0]).toMatch(/^uploads\/student_photo\/.+\.png$/);
  });

  it('rejects oversized files (> 5 MB) and strips r2ObjectKey from public DTOs', async () => {
    const oversized = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
    await expect(
      uploadFileService(
        {},
        { put: vi.fn() },
        { userId: 'u_admin' },
        {
          fileBytes: oversized,
          declaredMime: 'image/png',
          category: 'DOCUMENT',
        },
        { clientIp: '127.0.0.1', requestId: 'req_big' }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });

    const dto = toPublicFileDto({
      id: 'f_1',
      r2ObjectKey: 'uploads/document/f_1.pdf',
      category: 'DOCUMENT',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
      ownerEntityType: null,
      ownerEntityId: null,
      uploadedByUserId: 'u_1',
      createdAt: '2026-11-26T00:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('r2ObjectKey');
  });

  it('enforces student RBAC for ADMIN, STUDENT, PARENT, and TEACHER', async () => {
    expect(assertCanManageStudents({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManageStudents({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManageStudents({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanManageStudents({ roles: ['STUDENT'] })?.status).toBe(403);

    const mockDb = {
      prepare: () => ({
        bind: (parentId, studentId) => ({
          first: async () => (parentId === 'pp_1' && studentId === 'st_1' ? { ok: 1 } : null),
        }),
      }),
    };

    expect(
      await assertCanReadStudent(
        { roles: ['STUDENT'], profiles: { studentId: 'st_1' } },
        'st_1',
        mockDb
      )
    ).toBeNull();
    expect(
      (
        await assertCanReadStudent(
          { roles: ['STUDENT'], profiles: { studentId: 'st_1' } },
          'st_2',
          mockDb
        )
      )?.status
    ).toBe(403);
    expect(
      await assertCanReadStudent(
        { roles: ['PARENT'], profiles: { parentProfileId: 'pp_1' } },
        'st_1',
        mockDb
      )
    ).toBeNull();
    expect(
      (
        await assertCanReadStudent(
          { roles: ['PARENT'], profiles: { parentProfileId: 'pp_1' } },
          'st_other',
          mockDb
        )
      )?.status
    ).toBe(403);
    expect(
      (await assertCanReadStudent({ roles: ['TEACHER'] }, 'st_1', mockDb))?.status
    ).toBe(403);
  });
});
