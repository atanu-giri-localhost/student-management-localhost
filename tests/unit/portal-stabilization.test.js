import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNavItemsForRole } from '@/components/layout/nav-config';
import { ApiClientError, apiFetch } from '@/lib/http/api-client';
import { getDashboardPathForRoles, getPortalByKey, hasAnyRole } from '@/lib/portals';

describe('Phase B10 Portal & Navigation Stabilization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves portal keys, role dashboard paths, and role guards', () => {
    expect(getPortalByKey('student')?.key).toBe('student');
    expect(getPortalByKey('unknown')).toBeNull();

    expect(getDashboardPathForRoles(['SUPER_ADMIN'])).toBe('/admin/dashboard');
    expect(getDashboardPathForRoles(['COACHING_ADMIN'])).toBe('/admin/dashboard');
    expect(getDashboardPathForRoles(['TEACHER'])).toBe('/teacher/dashboard');
    expect(getDashboardPathForRoles(['STUDENT'])).toBe('/student/dashboard');
    expect(getDashboardPathForRoles(['PARENT'])).toBe('/parent/dashboard');
    expect(getDashboardPathForRoles([])).toBe('/dashboard');

    expect(hasAnyRole({ roles: ['TEACHER'] }, ['TEACHER', 'SUPER_ADMIN'])).toBe(true);
    expect(hasAnyRole({ roles: ['STUDENT'] }, ['SUPER_ADMIN', 'COACHING_ADMIN'])).toBe(false);
    expect(hasAnyRole(null, ['STUDENT'])).toBe(false);
  });

  it('excludes finance navigation links from TEACHER and STUDENT roles', () => {
    const teacherLinks = getNavItemsForRole('TEACHER');
    const studentLinks = getNavItemsForRole('STUDENT');
    const parentLinks = getNavItemsForRole('PARENT');
    const adminLinks = getNavItemsForRole('COACHING_ADMIN');

    expect(teacherLinks.some((item) => /fee|finance/i.test(item.label) || /fee|finance/i.test(item.href))).toBe(false);
    expect(studentLinks.some((item) => /fee|finance/i.test(item.label) || /fee|finance/i.test(item.href))).toBe(false);
    expect(parentLinks.some((item) => item.href === '/parent/fees')).toBe(true);
    expect(adminLinks.some((item) => item.href === '/admin/finance')).toBe(true);
  });

  it('apiFetch includes credentials and unwraps or throws structured ApiClientError', async () => {
    const okFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, meta: { requestId: 'req_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', okFetch);

    const payload = await apiFetch('/api/v1/health');
    expect(payload.data.ok).toBe(true);
    expect(okFetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ credentials: 'include' })
    );

    const errFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'FORBIDDEN', message: 'Denied', details: [] },
          meta: { requestId: 'req_2' },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', errFetch);

    await expect(apiFetch('/api/v1/finance/invoices')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 403,
      code: 'FORBIDDEN',
      message: 'Denied',
    });
    expect(new ApiClientError('x', { status: 401 })).toBeInstanceOf(Error);
  });
});
