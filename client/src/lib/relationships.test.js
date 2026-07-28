import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectRelationshipPages,
  filterRelationshipPeople,
  relationshipAccordionLabel,
} from './relationships.js';

test('uses the requested relationship labels for own and other profiles', () => {
  assert.equal(relationshipAccordionLabel('followers', true), 'The people who want to see me');
  assert.equal(relationshipAccordionLabel('following', true), 'The people I want to see');
  assert.equal(relationshipAccordionLabel('followers', false), 'The people who want to see them');
  assert.equal(relationshipAccordionLabel('following', false), 'The people they want to see');
});

test('filters relationship people by full name or @username', () => {
  const people = [
    { id: '1', fullName: 'Ayesha Khan', username: 'ayesha' },
    { id: '2', name: 'Bilal Ahmed', username: 'bilalwrites' },
  ];

  assert.deepEqual(filterRelationshipPeople(people, 'khan'), [people[0]]);
  assert.deepEqual(filterRelationshipPeople(people, '@BILAL'), [people[1]]);
  assert.deepEqual(filterRelationshipPeople(people, ''), people);
});

test('collects every relationship page and preserves a cursor when the safety batch ends', async () => {
  const cursors = [];
  const pages = new Map([
    ['first', { people: [{ id: '1' }], nextCursor: 'page-2' }],
    ['page-2', { people: [{ id: '2' }], nextCursor: 'page-3' }],
    ['page-3', { people: [{ id: '3' }], nextCursor: null }],
  ]);
  const loadPage = async (cursor) => {
    const key = cursor || 'first';
    cursors.push(key);
    return pages.get(key);
  };

  const all = await collectRelationshipPages(loadPage);
  assert.deepEqual(cursors, ['first', 'page-2', 'page-3']);
  assert.deepEqual(all.people.map((person) => person.id), ['1', '2', '3']);
  assert.equal(all.nextCursor, null);

  const bounded = await collectRelationshipPages(loadPage, { maxPages: 2 });
  assert.deepEqual(bounded.people.map((person) => person.id), ['1', '2']);
  assert.equal(bounded.nextCursor, 'page-3');
});
