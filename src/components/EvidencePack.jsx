export default function EvidencePack({ levelConfig }) {
  const handlePrint = () => {
    const evidenceItems = levelConfig.evidencePack.map((item) => `<li>${item}</li>`).join('');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>DCC ${levelConfig.title} Proposed Evidence Checklist</title><style>body{font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;margin:36px}h1{color:#1e3a5f}li{margin:10px 0}.note{border-left:4px solid #a16207;background:#fff9e8;padding:12px}</style></head><body><h1>DCC ${levelConfig.title} Proposed Evidence Checklist</h1><p>Source: ${levelConfig.source}</p><p class="note">This is a preparation checklist of common evidence. The Applicant Guide question-level expected evidence and the agreed assessment scope remain authoritative.</p><ul>${evidenceItems}</ul></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <details className="evidence-pack">
      <summary>Proposed evidence checklist</summary>
      <p>Common documents to prepare for {levelConfig.title}. Confirm relevance against each question and the agreed scope.</p>
      <ul>
        {levelConfig.evidencePack.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>Print / Save as PDF</button>
    </details>
  );
}