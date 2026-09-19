import { useRef, useState } from 'react';

const acceptedFormats = '.pdf,.docx,.txt,.md,.markdown';

function statusLabel(status) {
  return {
    queued: 'Queued for indexing',
    processing: 'Indexing policy',
    indexed: 'Ready for referenced answers',
    failed: 'Indexing failed',
    unsupported: 'No extractable text found',
  }[status] || 'Awaiting status';
}

export default function DocumentLibrary({ documents, onUpload, onReplace, onRetry, onDelete, onDownload }) {
  const uploadInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [actionDocumentId, setActionDocumentId] = useState(null);
  const [error, setError] = useState('');

  const runAction = async (documentId, action) => {
    try {
      setActionDocumentId(documentId);
      setError('');
      await action();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionDocumentId(null);
    }
  };

  const handleUpload = async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    await runAction('upload', async () => {
      setUploading(true);
      try {
        await onUpload({ file, title: file.name });
      } finally {
        setUploading(false);
      }
    });
  };

  const handleReplace = async (document, event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    await runAction(document.id, () => onReplace(document.id, { file, title: document.title }));
  };

  return (
    <section className="document-library" aria-labelledby="document-library-heading">
      <div className="document-library-heading">
        <div>
          <p className="eyebrow">Policy Sources</p>
          <h2 id="document-library-heading">Document Library</h2>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload Policy'}
        </button>
      </div>
      <input ref={uploadInputRef} type="file" accept={acceptedFormats} className="visually-hidden" onChange={handleUpload} />
      <p className="document-library-help">PDF, DOCX, TXT, and Markdown files are indexed locally before they can support referenced answers.</p>
      {documents.length === 0 ? (
        <p className="document-empty">No policies have been added to this assessment yet.</p>
      ) : (
        <ul className="document-list">
          {documents.map((document) => {
            const status = document.ingestion_status || document.status;
            const isBusy = actionDocumentId === document.id;
            return (
              <li key={document.id} className="document-row">
                <div className="document-details">
                  <strong>{document.title}</strong>
                  <span>{document.original_filename} · Version {document.version_number}</span>
                  <span className={`document-status document-status-${status}`}>{statusLabel(status)}</span>
                  {document.error_message && <small className="document-error">{document.error_message}</small>}
                </div>
                <div className="document-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={isBusy} onClick={() => runAction(document.id, () => onDownload(document.id))}>Download</button>
                  {status === 'failed' && <button type="button" className="btn btn-secondary btn-sm" disabled={isBusy} onClick={() => runAction(document.id, () => onRetry(document.id))}>Retry</button>}
                  <label className="btn btn-secondary btn-sm" aria-busy={isBusy}>
                    Replace
                    <input type="file" accept={acceptedFormats} className="visually-hidden" disabled={isBusy} onChange={(event) => handleReplace(document, event)} />
                  </label>
                  <button type="button" className="btn btn-danger btn-sm" disabled={isBusy} onClick={() => runAction(document.id, () => onDelete(document.id))}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}