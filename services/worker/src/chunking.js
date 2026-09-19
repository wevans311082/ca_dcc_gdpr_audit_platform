import { createHash } from 'node:crypto';

const maxCharacters = 2_400;
const overlapCharacters = 300;

function headingFor(text) {
  return text.split('\n').find((line) => /^#{1,6}\s+/.test(line))?.replace(/^#{1,6}\s+/, '') || null;
}

export function chunkParsedSections(sections) {
  const chunks = [];
  for (const section of sections) {
    let start = 0;
    while (start < section.text.length) {
      let end = Math.min(start + maxCharacters, section.text.length);
      if (end < section.text.length) {
        const boundary = section.text.lastIndexOf(' ', end);
        if (boundary > start + maxCharacters / 2) end = boundary;
      }
      const content = section.text.slice(start, end).trim();
      if (content) {
        chunks.push({
          content,
          contentHash: createHash('sha256').update(content).digest('hex'),
          pageNumber: section.pageNumber,
          sectionHeading: headingFor(content),
          sourceStart: start,
          sourceEnd: end,
        });
      }
      if (end === section.text.length) break;
      start = Math.max(end - overlapCharacters, start + 1);
    }
  }
  return chunks;
}