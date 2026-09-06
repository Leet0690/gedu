// Header visibility is independent of whether a page's records are year-scoped.
// Keep the selector on every administration page, never on public/auth pages.
export const isAcademicYearScopedPath = (pathname = '') => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return path === '/' || path.startsWith('/admin/');
};
