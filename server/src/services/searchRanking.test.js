import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateSearchFragments,
  parseSearchIntent,
  rankPersonSearch,
  rankPostSearch,
} from './searchRanking.js';

test('understands full author names and keeps the content phrase separate', () => {
  assert.deepEqual(parseSearchIntent('quiet sunset by Ali Suleman'), {
    query: 'quiet sunset by Ali Suleman',
    contentQuery: 'quiet sunset',
    byUsername: null,
    exactAt: null,
    authorName: 'Ali Suleman',
  });
});

test('ranks exact titles above detail-only matches', () => {
  const exact = rankPostSearch('quiet sunset', { nameIt: 'Quiet sunset', text: '', detail: '', links: [] });
  const detail = rankPostSearch('quiet sunset', { nameIt: 'Evening', text: '', detail: 'A quiet sunset arrived', links: [] });
  assert.ok(exact > detail);
});

test('tolerates a small typo but rejects unrelated content', () => {
  assert.ok(rankPostSearch('sunest', { nameIt: 'Sunset walk', text: '', detail: '', links: [] }) > 0);
  assert.equal(rankPostSearch('sunest', { nameIt: 'Cooking pasta', text: '', detail: '', links: [] }), 0);
  assert.ok(candidateSearchFragments('sunest').includes('est'));
});

test('prioritizes exact usernames over partial names', () => {
  const exact = rankPersonSearch('ali', { username: 'ali', fullName: 'Ali Suleman' });
  const partial = rankPersonSearch('ali', { username: 'alison', fullName: 'Alison Green' });
  assert.ok(exact > partial);
});
