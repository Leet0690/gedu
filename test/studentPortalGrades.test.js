import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/services/teacherGradePortalClient.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export async function readStudentPortalGrades')).replace('export ', '');

function createReader(read) {
  const calls = [];
  const reader = new Function('doc', 'setDoc', 'getDocFromServer', 'deleteDoc', 'serverTimestamp',
    `${body}; return readStudentPortalGrades;`)(
    (_db, collection, id) => `${collection}/${id}`,
    async (ref, data) => calls.push(['session', ref, data]),
    read,
    async ref => calls.push(['cleanup', ref]),
    () => 'server-time',
  );
  return { reader, calls };
}

test('student portal reads only its own document and removes the temporary session', async () => {
  const { reader, calls } = createReader(async ref => {
    assert.equal(ref, 'grades/student-1');
    return { exists: () => true, data: () => ({ math: { c1: 0 } }) };
  });
  assert.deepEqual(await reader({}, 'uid-1', 'student-1', 'private-token'), { 'student-1': { math: { c1: 0 } } });
  assert.deepEqual(calls, [
    ['session', 'student_grade_sessions/uid-1', { studentId: 'student-1', token: 'private-token', createdAt: 'server-time' }],
    ['cleanup', 'student_grade_sessions/uid-1'],
  ]);
});

test('a denied grade read is surfaced and still removes the session', async () => {
  const { reader, calls } = createReader(async () => { throw new Error('permission-denied'); });
  await assert.rejects(reader({}, 'uid-1', 'student-1', 'private-token'), /permission-denied/);
  assert.equal(calls.at(-1)[0], 'cleanup');
});

test('an absent grade document returns no grades', async () => {
  const { reader } = createReader(async () => ({ exists: () => false }));
  assert.deepEqual(await reader({}, 'uid-1', 'student-1', 'private-token'), {});
});
