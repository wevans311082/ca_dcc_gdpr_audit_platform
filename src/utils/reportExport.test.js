import { describe, expect, it } from 'vitest';
import { buildReportData } from './reportExport';

const steps = [{
  id: 'policy', title: 'Policy', items: [
    { id: 'policy-1', label: 'Policy question one' },
    { id: 'policy-2', label: 'Policy question two' },
  ],
}];

describe('buildReportData', () => {
  it('embeds the latest answer with its full citation data beside the matching assessment', () => {
    const answer = {
      id: 'answer-1', question_id: 'policy-1', answer: 'The policy sets a retention period.', status: 'stale',
      model: 'gpt-4.1-mini', generatedAt: '2026-09-19T12:00:00.000Z', citations: [{
        title: 'Retention Policy', version_number: 1, excerpt: 'Records are retained for seven years.', source_status: 'unavailable',
      }],
    };
    const report = buildReportData({
      assessments: { policy: { 'policy-1': { status: 'partial', response: 'Seven years', notes: 'Verify scope', evidenceFiles: [{ name: 'evidence.txt', hash: 'abc123', file: 'local-file' }] } } },
      assessorName: 'Alex', organisationName: 'Example Ltd', auditDate: '2026-09-19', steps,
      outcome: { label: 'Partially Compliant' }, counts: { partial: 1 }, gapAnalysis: [], referencedAnswers: [answer],
    });

    expect(report.referencedAnswers).toEqual([answer]);
    expect(report.details.policy.items['policy-1'].referencedAnswer).toEqual(answer);
    expect(report.details.policy.items['policy-1'].evidence).toEqual([{ name: 'evidence.txt', hash: 'abc123' }]);
    expect(report.details.policy.items['policy-2']).not.toHaveProperty('referencedAnswer');
  });

  it('retains latest answers outside the current question list in the top-level audit manifest', () => {
    const historicalAnswer = { id: 'answer-2', question_id: 'retired-question', status: 'stale', citations: [] };
    const report = buildReportData({
      assessments: {}, assessorName: '', organisationName: '', auditDate: '', steps,
      outcome: { label: 'Incomplete Assessment' }, counts: {}, gapAnalysis: [], referencedAnswers: [historicalAnswer],
    });

    expect(report.referencedAnswers).toEqual([historicalAnswer]);
    expect(report.details.policy.items['policy-1']).not.toHaveProperty('referencedAnswer');
  });
});