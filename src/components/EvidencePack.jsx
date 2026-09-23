import { useMemo, useState } from 'react';

export default function EvidencePack({ levelConfig, onBack }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const questionRequests = useMemo(() => levelConfig.steps.flatMap((step) => step.items.map((item) => ({
    controlTitle: step.title,
    question: item.label,
    evidenceRequest: item.evidenceRequest,
  }))), [levelConfig]);
  const documents = useMemo(() => {
    const records = new Map();
    questionRequests.forEach((entry) => entry.evidenceRequest.documents.forEach((name) => {
      const record = records.get(name) || { name, questions: [] };
      record.questions.push(entry);
      records.set(name, record);
    }));
    return [...records.values()];
  }, [questionRequests]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleQuestions = questionRequests.filter((entry) => {
    if (filter === 'documents' && !entry.evidenceRequest.documents.some((name) => name.toLowerCase().includes(normalizedQuery))) return false;
    return !normalizedQuery || `${entry.controlTitle} ${entry.question} ${entry.evidenceRequest.documents.join(' ')} ${entry.evidenceRequest.officialExpectedEvidence}`.toLowerCase().includes(normalizedQuery);
  });
  const visibleDocuments = documents.filter((document) => !normalizedQuery || `${document.name} ${document.questions.map((entry) => `${entry.controlTitle} ${entry.question}`).join(' ')}`.toLowerCase().includes(normalizedQuery));

  return (
    <main className="evidence-screen" aria-labelledby="evidence-title">
      <header className="evidence-screen-heading">
        <div>
          <p className="eyebrow">{levelConfig.title} · Evidence preparation</p>
          <h1 id="evidence-title">Question-by-question evidence checklist</h1>
          <p>Browse questions and the suggested files or records that can help demonstrate them. These are practical prompts; confirm relevance against the agreed assessment scope.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back to scope</button>
      </header>
      <div className="evidence-toolbar no-print">
        <label className="form-group evidence-search"><span className="form-label">Search</span><input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Question, control, file or record" /></label>
        <label className="form-group"><span className="form-label">Browse by</span><select className="form-input" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Questions and files</option><option value="questions">Questions</option><option value="documents">Files and records</option></select></label>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <p className="evidence-source">Source: {levelConfig.source} · {questionRequests.length} questions · {documents.length} unique file and record types</p>
      <div className="evidence-browser">
        {filter !== 'documents' && <section className="evidence-browser-list" aria-label="Questions">
          <h2>Questions <span>{visibleQuestions.length}</span></h2>
          {visibleQuestions.map((entry, index) => <article className="evidence-card" key={`${entry.controlTitle}-${entry.question}`}>
            <p className="evidence-question-control">{entry.controlTitle}</p>
            <h3>{entry.question}</h3>
            <p><strong>Official expected evidence</strong><br />{entry.evidenceRequest.officialExpectedEvidence}</p>
            <h4>Files and records to collate</h4>
            <ul className="evidence-document-links">{entry.evidenceRequest.documents.map((name) => <li key={name}><button type="button" onClick={() => { setSelectedDocument(documents.find((doc) => doc.name === name)); setSelectedQuestion(null); }}>{name}</button></li>)}</ul>
            <span className="evidence-item-number">Question {questionRequests.indexOf(entry) + 1} of {questionRequests.length}</span>
            {index < visibleQuestions.length - 1 && <hr />}
          </article>)}
          {visibleQuestions.length === 0 && <p className="evidence-empty">No questions match this search.</p>}
        </section>}
        {filter !== 'questions' && <section className="evidence-browser-list" aria-label="Files and records">
          <h2>Files and records <span>{visibleDocuments.length}</span></h2>
          <p className="form-help">Select an entry to see why it may be useful and which questions it supports.</p>
          {visibleDocuments.map((document) => <button type="button" className={`evidence-document-row${selectedDocument?.name === document.name ? ' is-selected' : ''}`} key={document.name} onClick={() => { setSelectedDocument(document); setSelectedQuestion(null); }}>
            <strong>{document.name}</strong><span>Supports {document.questions.length} {document.questions.length === 1 ? 'question' : 'questions'}</span>
          </button>)}
          {visibleDocuments.length === 0 && <p className="evidence-empty">No files or records match this search.</p>}
        </section>}
        {(selectedDocument || selectedQuestion) && <aside className="evidence-detail" aria-live="polite">
          <button type="button" className="evidence-detail-close no-print" onClick={() => { setSelectedDocument(null); setSelectedQuestion(null); }} aria-label="Close explanation">×</button>
          <p className="eyebrow">Why this evidence matters</p>
          <h2>{selectedDocument?.name || selectedQuestion?.question}</h2>
          <p>{selectedDocument ? `This file or record can help show how the organisation carries out and records its ${selectedDocument.questions.length === 1 ? 'relevant requirement' : 'relevant requirements'}. It is a suggested evidence prompt, not a mandatory document title. Use the current, approved record that best demonstrates the practice in scope.` : selectedQuestion?.evidenceRequest.officialExpectedEvidence}</p>
          {selectedDocument && <><h3>Questions it supports</h3><ul>{selectedDocument.questions.map((entry) => <li key={entry.question}><button type="button" className="evidence-inline-link" onClick={() => { setSelectedQuestion(entry); setSelectedDocument(null); }}>{entry.question}</button><small>{entry.controlTitle}</small></li>)}</ul></>}
          {selectedQuestion && <><h3>Suggested files and records</h3><ul>{selectedQuestion.evidenceRequest.documents.map((name) => <li key={name}><button type="button" className="evidence-inline-link" onClick={() => { setSelectedDocument(documents.find((doc) => doc.name === name)); setSelectedQuestion(null); }}>{name}</button></li>)}</ul></>}
        </aside>}
      </div>
      <div className="evidence-print-only"><h1>{levelConfig.title} Question Evidence Checklist</h1><p>Source: {levelConfig.source}</p><p>Suggested evidence prompts; confirm relevance against the agreed assessment scope.</p>{questionRequests.map((entry) => <section key={entry.question}><small>{entry.controlTitle}</small><h2>{entry.question}</h2><p><strong>Official expected evidence:</strong> {entry.evidenceRequest.officialExpectedEvidence}</p><p><strong>Files and records to collate:</strong></p><ul>{entry.evidenceRequest.documents.map((name) => <li key={name}>□ {name}</li>)}</ul></section>)}</div>
    </main>
  );
}
