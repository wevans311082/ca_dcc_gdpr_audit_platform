export default function EvidencePack({ levelConfig }) {
  const questionRequests = levelConfig.steps.flatMap((step) => step.items.map((item) => ({
    controlTitle: step.title,
    question: item.label,
    evidenceRequest: item.evidenceRequest,
  })));

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const handlePrint = () => {
    const evidenceItems = questionRequests.map(({ controlTitle, question, evidenceRequest }) => `
      <section class="question">
        <p class="control">${escapeHtml(controlTitle)}</p>
        <h2>${escapeHtml(question)}</h2>
        <p><strong>Official expected evidence:</strong> ${escapeHtml(evidenceRequest.officialExpectedEvidence)}</p>
        <p><strong>Files and records to collate:</strong></p>
        <ul>${evidenceRequest.documents.map((document) => `<li><span class="box"></span>${escapeHtml(document)}</li>`).join('')}</ul>
      </section>`).join('');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>DCC ${levelConfig.title} Evidence Checklist</title><style>body{font-family:Arial,sans-serif;color:#1e293b;line-height:1.45;margin:36px}h1{color:#1e3a5f}.note{border-left:4px solid #a16207;background:#fff9e8;padding:12px}.question{border-bottom:1px solid #cbd5e1;break-inside:avoid;margin:22px 0;padding-bottom:16px}.control{color:#64748b;font-size:12px;font-weight:bold;margin:0}h2{font-size:15px;margin:4px 0 10px}p{font-size:13px}ul{margin:6px 0;padding-left:0}li{font-size:13px;list-style:none;margin:6px 0}.box{border:1px solid #475569;display:inline-block;height:11px;margin-right:8px;vertical-align:-1px;width:11px}</style></head><body><h1>DCC ${levelConfig.title} Question Evidence Checklist</h1><p>Source: ${escapeHtml(levelConfig.source)}</p><p class="note">This checklist is organised by every DCC source question. The official expected evidence is reproduced for each question; the named files and records are practical collation prompts, to be confirmed against the agreed scope.</p>${evidenceItems}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <details className="evidence-pack">
      <summary>Question-by-question evidence checklist ({questionRequests.length})</summary>
      <p>Each DCC source question has its own official expected evidence and concrete files or records to collate. Confirm final relevance against the agreed scope.</p>
      <div className="evidence-question-list">
        {questionRequests.map(({ controlTitle, question, evidenceRequest }) => (
          <section className="evidence-question" key={question}>
            <p className="evidence-question-control">{controlTitle}</p>
            <strong>{question}</strong>
            <p><strong>Official expected evidence:</strong> {evidenceRequest.officialExpectedEvidence}</p>
            <p><strong>Files and records to collate:</strong></p>
            <ul>{evidenceRequest.documents.map((document) => <li key={document}>{document}</li>)}</ul>
          </section>
        ))}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>Print / Save as PDF</button>
    </details>
  );
}