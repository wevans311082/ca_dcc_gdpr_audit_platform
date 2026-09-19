import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

function splitText(text, pageNumber = null) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  return [{ text: normalized, pageNumber }];
}

async function parsePdf(contents) {
  const document = await getDocument({ data: new Uint8Array(contents) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = (await page.getTextContent()).items.map((item) => item.str).join(' ');
    pages.push(...splitText(text, pageNumber));
  }
  return pages;
}

export async function parseDocument({ contents, contentType }) {
  switch (contentType) {
    case 'application/pdf':
      return parsePdf(contents);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer: contents });
      return splitText(result.value);
    }
    case 'text/plain':
    case 'text/markdown':
      return splitText(new TextDecoder('utf-8', { fatal: true }).decode(contents));
    default:
      throw new Error(`Unsupported document content type: ${contentType}`);
  }
}