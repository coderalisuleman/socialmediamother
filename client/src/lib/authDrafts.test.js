import test from 'node:test';
import assert from 'node:assert/strict';
import { hasProtectedAuthDraft } from './authDrafts.js';

test('account creation remains protected as unfinished work', () => {
  assert.equal(hasProtectedAuthDraft('create-account', ['', 'person@example.com']), true);
  assert.equal(hasProtectedAuthDraft('create-account', ['', '']), false);
});

test('account-in credentials never trigger the unfinished-work confirmation', () => {
  assert.equal(hasProtectedAuthDraft('account-in', ['person@example.com', 'secret password']), false);
});
