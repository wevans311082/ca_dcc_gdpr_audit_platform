const esc = (value) => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#ffffff"/><style>text{font-family:Arial,sans-serif;fill:#1e293b}.title{font-size:27px;font-weight:bold;fill:#1e3a5f}.heading{font-size:20px;font-weight:bold}.body{font-size:17px}.small{font-size:14px;fill:#475569}</style>';
const wrap = (content) => `${svgStart}${content}</svg>`;
function lines(text, max = 42) {
  const words = String(text || 'Not provided').split(/\s+/); const result = []; let line = '';
  words.forEach((word) => { if ((line + word).length > max && line) { result.push(line); line = ''; } line += `${line ? ' ' : ''}${word}`; }); if (line) result.push(line); return result.slice(0, 5);
}
const textBlock = (value, x, y, className = 'body', max = 42) => lines(value, max).map((line, index) => `<text x="${x}" y="${y + index * 24}" class="${className}">${esc(line)}</text>`).join('');

export function buildScopeDiagramSvg(scope, kind) {
  if (kind === 'boundary') {
    const exclusions = scope.boundaries.exclusions.length ? scope.boundaries.exclusions.map((item) => item.name).join('; ') : 'No exclusions recorded';
    const matrix = scope.boundaries.coterminousMatrix;
    const cols = [
      ['DCC only', matrix.dccOnly], ['Both scopes', matrix.both], ['CE / CE+ only', matrix.ceOnly],
    ];
    const cards = cols.map(([title, value], index) => { const x = 50 + index * 375; return `<rect x="${x}" y="130" width="345" height="270" rx="14" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/><text x="${x + 20}" y="172" class="heading">${esc(title)}</text>${textBlock(value, x + 20, 215, 'body', 34)}`; }).join('');
    return wrap(`<text x="50" y="52" class="title">DCC and CE / CE+ scope boundary alignment</text>
      <text x="52" y="95" class="small">DCC description: ${esc(lines(scope.boundaries.inDcc, 105).join(' '))}</text>
      ${cards}
      <rect x="50" y="430" width="1095" height="105" rx="12" fill="#fff7ed" stroke="#c2410c" stroke-width="3"/><text x="75" y="468" class="heading">Outside both scopes</text>${textBlock(`${matrix.neither || 'None recorded'}; exclusions: ${exclusions}`, 375, 468, 'body', 74)}
      <text x="55" y="575" class="small">Applicant description of boundary relationship: ${esc(lines(scope.boundaries.overlap, 105).join(' '))}</text>`);
  }
  const categories = [
    ['Sites and workforce', scope.sites.map((x) => x.name).join('; ') || 'No sites recorded'],
    ['Networks and systems', scope.systems.map((x) => x.name).join('; ') || 'No systems recorded'],
    ['Data and storage', scope.dataStorage.map((x) => x.name).join('; ') || 'No repositories recorded'],
  ];
  const cards = categories.map(([title, value], index) => {
    const x = 50 + index * 385;
    return `<rect x="${x}" y="115" width="350" height="300" rx="16" fill="#f8fafc" stroke="#64748b" stroke-width="3"/><text x="${x + 22}" y="160" class="heading">${esc(title)}</text>${textBlock(value, x + 22, 205, 'body', 31)}`;
  }).join('');
  const assetText = scope.assets.map((x) => x.name).join('; ') || 'No asset classes recorded';
  const linksText = scope.diagram.connections.length
    ? scope.diagram.connections.map((connection) => `${connection.from || 'Unspecified'} → ${connection.to || 'Unspecified'}: ${connection.purpose || 'Purpose not recorded'}`).join(' · ')
    : scope.diagram.relationships || 'No connection details recorded';
  return wrap(`<text x="50" y="55" class="title">Declared systems, networks, assets and data</text>${cards}
    <rect x="50" y="440" width="1125" height="90" rx="12" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><text x="75" y="475" class="heading">Device and asset classes</text>${textBlock(assetText, 375, 475, 'body', 75)}
    <rect x="50" y="550" width="1125" height="145" rx="12" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/><text x="75" y="588" class="heading">Applicant-declared connections</text>${textBlock(linksText, 75, 625, 'body', 115)}`);
}

export async function scopeDiagramPng(scope, kind) {
  const svg = buildScopeDiagramSvg(scope, kind);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 620;
  const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Unable to render a scope diagram for the Word document.');
  return blob.arrayBuffer();
}
