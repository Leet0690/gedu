import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Transitional production rules preserve existing portal reads while enforcing
// the same user-management, financial-data and write protections as strict RBAC.
const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const anchor = '    // Default deny, including unauthenticated legacy bearer-link portals.';
if (source.split(anchor).length !== 2) throw new Error('Expected exactly one default-deny rule anchor');
const compatibility = `    // TEMPORARY: legacy portals still query these academic collections anonymously.
    // Finance, users, backups, settings, tokens and audit logs have no public grant.
    // Remove this block after migrating portals to server-validated sessions.
    match /{portalCollection}/{portalDocument} {
      allow read: if request.auth == null && portalCollection in ['students', 'teachers', 'grades', 'schedules', 'modules', 'attendance_formateurs', 'attendance_stagiaires'];
    }
`;
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/firestore.portal-compat.rules', import.meta.url), source.replace(anchor, compatibility + anchor));
console.log('Generated artifacts/firestore.portal-compat.rules');
