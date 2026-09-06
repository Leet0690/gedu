import test from 'node:test';
import assert from 'node:assert/strict';
import { toAuthEmail, getLoginIdentifier } from '../src/utils/loginIdentifier.js';

test('username sign-in and creation use a stable Firebase identity', () => {
  assert.equal(toAuthEmail(' Admin '), 'admin@ipfp.edu');
  assert.equal(toAuthEmail('amina.diallo'), 'amina.diallo@ipfp.edu');
  assert.equal(toAuthEmail('ADMIN@IPFP.EDU'), 'admin@ipfp.edu');
  assert.equal(toAuthEmail(' Person@Example.com '), 'person@example.com');
});

test('empty and whitespace-containing identifiers cannot become Auth accounts', () => {
  for (const input of ['', '   ', null, undefined, 'deux noms', 'admin\nname']) {
    assert.throws(() => toAuthEmail(input), { code: 'auth/invalid-identifier' });
  }
});

test('displayed login identifiers resolve to the same account', () => {
  for (const email of ['admin@ipfp.edu', 'person@example.com']) {
    assert.equal(toAuthEmail(getLoginIdentifier(email)), email);
  }
  assert.equal(getLoginIdentifier('admin@ipfp.edu'), 'admin');
  assert.equal(getLoginIdentifier('person@other.ipfp.edu'), 'person@other.ipfp.edu');
  assert.equal(getLoginIdentifier(undefined), '');
});
