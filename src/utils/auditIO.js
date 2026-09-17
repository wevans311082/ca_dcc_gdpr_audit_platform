import { CATALOGUE_VERSION, LEVEL_CONFIGS, STATUS_OPTIONS, getLevelConfig } from '../data/auditSteps';

const CHECKPOINT_VERSION = 1;
const validStatuses = new Set(STATUS_OPTIONS.map((option) => option.value));

export function buildCheckpoint({ assessments, assessorName, organisationName, auditDate, scope, selectedLevel, currentStep, view }) {
  return {
    checkpointVersion: CHECKPOINT_VERSION,
    catalogueVersion: CATALOGUE_VERSION,
    savedAt: new Date().toISOString(),
    metadata: { assessorName, organisationName, auditDate },
    scope,
    selectedLevel,
    currentStep,
    view,
    assessments: Object.fromEntries(
      Object.entries(assessments).map(([stepId, items]) => [
        stepId,
        Object.fromEntries(Object.entries(items).map(([itemId, assessment]) => [
          itemId,
          {
            status: assessment.status,
            notes: assessment.notes,
            evidenceChecklist: assessment.evidenceChecklist || [],
            evidenceReferences: (assessment.evidenceFiles || []).map(({ name, hash }) => ({ name, hash })),
          },
        ])),
      ])
    ),
  };
}

export function validateCheckpoint(candidate) {
  if (!candidate || typeof candidate !== 'object' || candidate.checkpointVersion !== CHECKPOINT_VERSION) {
    throw new Error('This file is not a compatible audit checkpoint.');
  }
  const level = getLevelConfig(candidate.selectedLevel);
  if (!LEVEL_CONFIGS[candidate.selectedLevel]?.available) {
    throw new Error('The checkpoint requires a level whose verified control catalogue is not yet available.');
  }
  if (!candidate.metadata || !candidate.scope || !candidate.assessments) {
    throw new Error('The checkpoint is missing required audit data.');
  }
  const stepIds = new Set(level.steps.map((step) => step.id));
  Object.entries(candidate.assessments).forEach(([stepId, items]) => {
    if (!stepIds.has(stepId)) throw new Error(`Unknown audit section: ${stepId}.`);
    const itemIds = new Set(level.steps.find((step) => step.id === stepId).items.map((item) => item.id));
    Object.entries(items).forEach(([itemId, assessment]) => {
      if (!itemIds.has(itemId) || !validStatuses.has(assessment.status)) {
        throw new Error('The checkpoint contains an unknown control or invalid status.');
      }
    });
  });
  return candidate;
}