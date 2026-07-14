import assert from 'node:assert/strict';
import test from 'node:test';
import { privateUser, publicUser } from './serializers.js';

const account = {
  id: 'user-1',
  fullName: 'Private Person',
  username: 'privateperson',
  email: 'private@example.com',
  phone: '+923254695657',
  verifiedEmail: true,
  verifiedPhone: true,
};

test('never exposes email or phone in a public person response', () => {
  const result = publicUser(account);
  assert.equal('email' in result, false);
  assert.equal('phone' in result, false);
});

test('keeps private contact details available only to the signed-in owner response', () => {
  const result = privateUser(account);
  assert.equal(result.email, account.email);
  assert.equal(result.phone, account.phone);
});
