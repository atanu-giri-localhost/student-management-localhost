import { describe, expect, it, vi } from 'vitest';
import { hydrateUserProfiles } from '@/lib/auth/profile-hydration';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';

describe('cross-D1 profile hydration', () => {
  it('skips DB_STUDENTS and DB_ACADEMICS queries for admin-only roles', async () => {
    const spyStudents = { prepare: vi.fn() };
    const spyAcademics = { prepare: vi.fn() };

    const profiles = await hydrateUserProfiles(
      {
        [D1_BINDINGS.STUDENTS]: spyStudents,
        [D1_BINDINGS.ACADEMICS]: spyAcademics,
      },
      { userId: 'u_admin', roles: ['SUPER_ADMIN', 'COACHING_ADMIN'] }
    );

    expect(profiles).toEqual({
      parentProfileId: null,
      teacherProfileId: null,
      studentId: null,
    });
    expect(spyStudents.prepare).not.toHaveBeenCalled();
    expect(spyAcademics.prepare).not.toHaveBeenCalled();
  });

  it('hydrates STUDENT, PARENT, and TEACHER profiles in parallel from DB_STUDENTS and DB_ACADEMICS', async () => {
    const mockStudents = {
      prepare: (sql) => ({
        bind: () => ({
          first: async () =>
            sql.includes('parent_profiles') ? { id: 'pp_1' } : { id: 'st_1' },
        }),
      }),
    };
    const mockAcademics = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 'tp_1' }),
        }),
      }),
    };

    const profiles = await hydrateUserProfiles(
      {
        [D1_BINDINGS.STUDENTS]: mockStudents,
        [D1_BINDINGS.ACADEMICS]: mockAcademics,
      },
      { userId: 'u_multi', roles: ['PARENT', 'STUDENT', 'TEACHER'] }
    );

    expect(profiles).toEqual({
      parentProfileId: 'pp_1',
      teacherProfileId: 'tp_1',
      studentId: 'st_1',
    });
  });

  it('degrades gracefully to null profiles when DB_STUDENTS or DB_ACADEMICS is unavailable or throws', async () => {
    const failingStudents = {
      prepare: () => {
        throw new Error('DB_STUDENTS down');
      },
    };

    const profiles = await hydrateUserProfiles(
      {
        [D1_BINDINGS.STUDENTS]: failingStudents,
      },
      { userId: 'u_1', roles: ['STUDENT', 'TEACHER'] }
    );

    expect(profiles).toEqual({
      parentProfileId: null,
      teacherProfileId: null,
      studentId: null,
    });
  });
});
