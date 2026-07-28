import test from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/User.js';
import { cleanLoginIdentifier } from './normalize.js';

test('login identifiers accept and normalize only phone numbers or email addresses', () => {
  assert.equal(cleanLoginIdentifier(' PERSON@Example.COM '), 'person@example.com');
  assert.equal(cleanLoginIdentifier('+92 300-1234567'), '+923001234567');

  for (const identifier of ['person', '@person', '']) {
    assert.throws(
      () => cleanLoginIdentifier(identifier),
      (error) => ['PHONE_OR_EMAIL_REQUIRED', 'IDENTIFIER_REQUIRED'].includes(error?.code) && error?.status === 422
    );
  }
});

test('signup channel normalization follows the selected verified channel', () => {
  assert.equal(cleanLoginIdentifier(' PERSON@Example.COM ', 'email'), 'person@example.com');
  assert.equal(cleanLoginIdentifier('+92 (300) 1234567', 'phone'), '+923001234567');
  assert.throws(
    () => cleanLoginIdentifier('person', 'email'),
    (error) => error?.code === 'INVALID_EMAIL' && error?.status === 422
  );
});

test('person types include the four signup choices and keep the legacy value readable', () => {
  const values = User.schema.path('gender').enumValues;
  for (const value of ['female', 'male', 'transgender', 'other', 'prefer-not-to-say']) {
    assert.ok(values.includes(value));
  }
});
