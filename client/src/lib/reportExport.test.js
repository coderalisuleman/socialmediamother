import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { createXlsxBlob } from './reportExport.js';

test('creates a real XLSX zip workbook instead of XML renamed as xls', async () => {
  const blob = await createXlsxBlob(['SocialMediaMother report', 'Human sessions: 12'], 'Human behaviour');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  const files = unzipSync(bytes);
  assert.ok(files['xl/workbook.xml']);
  assert.match(strFromU8(files['xl/worksheets/sheet1.xml']), /Human sessions: 12/);
});
