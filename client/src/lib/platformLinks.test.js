import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExternalLink, describeExternalLinks } from './platformLinks.js';

test('recognizes familiar platform links by their real hostname', () => {
  assert.equal(classifyExternalLink('https://youtube.com/@coderalisuleman').id, 'youtube');
  assert.equal(classifyExternalLink('https://vm.tiktok.com/example').id, 'tiktok');
  assert.equal(classifyExternalLink('https://www.instagram.com/example').id, 'instagram');
  assert.equal(classifyExternalLink('https://example.com/video').id, 'website');
});

test('keeps every external place and supplies a readable label', () => {
  assert.deepEqual(describeExternalLinks(['https://x.com/a', 'https://github.com/a']).map(({ id, label }) => ({ id, label })), [
    { id: 'x', label: 'X' },
    { id: 'github', label: 'GitHub' },
  ]);
});
