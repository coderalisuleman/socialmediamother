import { promises as fs } from 'node:fs';

const startsWith = (buffer, bytes) => bytes.every((value, index) => buffer[index] === value);

export const hasValidMediaSignature = async (file) => {
  if (!file?.path || !file.mimetype) return false;
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    const ascii = head.toString('ascii');
    switch (file.mimetype) {
      case 'image/jpeg': return startsWith(head, [0xff, 0xd8, 0xff]);
      case 'image/png': return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      case 'image/gif': return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a');
      case 'image/webp': return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
      case 'image/avif': return ascii.slice(4, 12) === 'ftypavif' || ascii.slice(4, 12) === 'ftypavis';
      case 'video/mp4':
      case 'video/quicktime': return ascii.slice(4, 8) === 'ftyp';
      case 'video/webm':
      case 'video/x-matroska': return startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]);
      case 'video/ogg': return ascii.startsWith('OggS');
      default: return false;
    }
  } finally {
    await handle.close();
  }
};
