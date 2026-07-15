const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function safeFilePart(value) {
  return String(value || '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 700);
}

const xmlEscape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export async function createXlsxBlob(lines, sheetName = 'Report') {
  const { strToU8, zipSync } = await import('fflate');
  const safeSheetName = String(sheetName || 'Report').replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Report';
  const rows = lines.map((line, index) => (
    `<row r="${index + 1}"><c r="A${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(line)}</t></is></c></row>`
  )).join('');
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="72" customWidth="1"/></cols><sheetData>${rows}</sheetData></worksheet>`),
  };
  return new Blob([zipSync(files, { level: 6 })], { type: XLSX_TYPE });
}

function createPdfBlob(lines) {
  const printable = lines.slice(0, 52).map((line) => String(line).replace(/[^\x20-\x7E]/g, ' ').replace(/([\\()])/g, '\\$1'));
  const content = `BT\n/F1 10 Tf\n40 760 Td\n14 TL\n${printable.map((line) => `(${line}) Tj T*`).join('\n')}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function createImageBlob(lines, title) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = Math.max(1200, Math.min(3000, 260 + lines.length * 43));
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('This browser could not draw the report image.'));
      return;
    }
    context.fillStyle = '#fffdf7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(79, 148, 177, .18)';
    for (let y = 80; y < canvas.height; y += 43) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
    }
    context.strokeStyle = 'rgba(182, 111, 82, .32)';
    context.beginPath(); context.moveTo(105, 0); context.lineTo(105, canvas.height); context.stroke();
    context.fillStyle = '#20343d';
    context.font = '700 38px Arial';
    context.fillText(String(title).slice(0, 58), 145, 95);
    context.font = '24px Arial';
    lines.slice(1).forEach((line, index) => {
      context.fillStyle = /^(Most|What|Every|Collective)/.test(line) ? '#8f4e37' : '#315b6b';
      context.fillText(String(line).slice(0, 92), 145, 155 + index * 43);
    });
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The report image could not be prepared.')), 'image/png', .94);
  });
}

export async function exportReport({ format, fileName, title, lines, sheetName = 'Report' }) {
  const base = safeFilePart(fileName || title || 'socialmediamother-report');
  if (format === 'excel') {
    downloadBlob(await createXlsxBlob(lines, sheetName), `${base}.xlsx`);
    return;
  }
  if (format === 'image') {
    downloadBlob(await createImageBlob(lines, title), `${base}.png`);
    return;
  }
  if (format === 'pdf') downloadBlob(createPdfBlob(lines), `${base}.pdf`);
}
