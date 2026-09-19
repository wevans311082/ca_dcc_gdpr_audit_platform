export function buildReportData({ assessments, assessorName, organisationName, auditDate, steps, outcome, counts, gapAnalysis, referencedAnswers }) {
  const answersByQuestionId = new Map(referencedAnswers.map((answer) => [answer.question_id, answer]));
  const reportData = {
    meta: { organisationName, assessorName, auditDate, outcome: outcome.label, counts },
    gapAnalysis,
    referencedAnswers,
    details: {},
  };

  steps.forEach((step) => {
    reportData.details[step.id] = { title: step.title, items: {} };
    step.items.forEach((item) => {
      const assessment = assessments[step.id]?.[item.id] || { status: 'not-assessed', notes: '', evidenceFiles: [] };
      reportData.details[step.id].items[item.id] = {
        label: item.label,
        status: assessment.status,
        response: assessment.response || '',
        notes: assessment.notes,
        evidenceChecklist: assessment.evidenceChecklist || [],
        evidence: (assessment.evidenceFiles || []).map(({ name, hash }) => ({ name, hash })),
        ...(answersByQuestionId.has(item.id) ? { referencedAnswer: answersByQuestionId.get(item.id) } : {}),
      };
    });
  });
  return reportData;
}