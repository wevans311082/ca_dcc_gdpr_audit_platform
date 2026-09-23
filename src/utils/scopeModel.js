export const SCOPE_SCHEMA_VERSION = 2;

export const EMPTY_SCOPE = {
  schemaVersion: SCOPE_SCHEMA_VERSION,
  organisation: { legalName: '', companyNumber: '', registeredAddress: '', applicationReference: '', documentVersion: '1.0', documentDate: '', assessor: '', assessmentBody: '' },
  service: { certificationScope: '', description: '', essentialFunctions: '', contractedOutputs: '', rationale: '' },
  sites: [], systems: [], ot: { operates: '', details: '' }, assets: [], dataStorage: [],
  boundaries: { inDcc: '', inCyberEssentials: '', exclusions: [], overlap: '', overlapExplanation: '', coterminousMatrix: { dccOnly: '', ceOnly: '', both: '', neither: '' } },
  diagram: { dccCeCoterminous: '', relationships: '', connections: [] },
  certifications: { cyberEssentials: { scope: '', reference: '', status: '', renewalDate: '' }, cyberEssentialsPlus: { scope: '', reference: '', status: '', renewalDate: '' }, dccReference: '' },
  declaration: { statement: '', signatoryName: '', signatoryTitle: '', signatureDate: '' },
};

const legacyEntry = (label, value, detailField) => String(value || '').trim()
  ? [{ name: label, [detailField]: String(value).trim() }]
  : [];

export function migrateScope(source = {}) {
  if (source?.schemaVersion === SCOPE_SCHEMA_VERSION) {
    return { ...structuredClone(EMPTY_SCOPE), ...source,
      organisation: { ...EMPTY_SCOPE.organisation, ...source.organisation }, service: { ...EMPTY_SCOPE.service, ...source.service },
      ot: { ...EMPTY_SCOPE.ot, ...source.ot },
      diagram: { ...EMPTY_SCOPE.diagram, ...source.diagram, connections: Array.isArray(source.diagram?.connections) ? source.diagram.connections : [] }, certifications: { ...EMPTY_SCOPE.certifications, ...source.certifications,
        cyberEssentials: { ...EMPTY_SCOPE.certifications.cyberEssentials, ...source.certifications?.cyberEssentials },
        cyberEssentialsPlus: { ...EMPTY_SCOPE.certifications.cyberEssentialsPlus, ...source.certifications?.cyberEssentialsPlus } },
      declaration: { ...EMPTY_SCOPE.declaration, ...source.declaration },
      sites: Array.isArray(source.sites) ? source.sites : [], systems: Array.isArray(source.systems) ? source.systems : [],
      assets: Array.isArray(source.assets) ? source.assets : [], dataStorage: Array.isArray(source.dataStorage) ? source.dataStorage : [],
      boundaries: { ...EMPTY_SCOPE.boundaries, ...source.boundaries, exclusions: Array.isArray(source.boundaries?.exclusions) ? source.boundaries.exclusions : [], coterminousMatrix: { ...EMPTY_SCOPE.boundaries.coterminousMatrix, ...source.boundaries?.coterminousMatrix } },
    };
  }
  return {
    ...structuredClone(EMPTY_SCOPE), ...source, schemaVersion: SCOPE_SCHEMA_VERSION,
    service: { ...EMPTY_SCOPE.service, description: source.inScopeDescription || '', essentialFunctions: source.inScopeDescription || '', rationale: source.scopeRationale || '' },
    systems: legacyEntry('Legacy systems and information assets', source.inScopeSystems, 'purpose'),
    sites: legacyEntry('Legacy locations and delivery model', source.locations, 'function'),
    boundaries: { ...EMPTY_SCOPE.boundaries, inDcc: source.inScopeDescription || '', exclusions: String(source.exclusions || '').trim() ? [{ name: String(source.exclusions).trim(), rationale: 'Migrated from the previous scope answer. Review and confirm the specific exclusion rationale.' }] : [] },
  };
}

export function scopeHasRequiredContent(scope) {
  const completeRows = (rows, fields) => rows.length > 0 && rows.every((row) => fields.every((field) => String(row[field] || '').trim()));
  return Boolean(scope.organisation.legalName.trim() && scope.service.description.trim() && scope.service.essentialFunctions.trim()
    && scope.boundaries.inDcc.trim() && scope.boundaries.overlap.trim() && scope.diagram.dccCeCoterminous.trim()
    && Object.values(scope.boundaries.coterminousMatrix).every((value) => value.trim())
    && scope.diagram.relationships.trim() && scope.declaration.signatoryName.trim() && scope.declaration.signatoryTitle.trim()
    && completeRows(scope.sites, ['name', 'function']) && completeRows(scope.systems, ['name', 'purpose'])
    && completeRows(scope.assets, ['name', 'quantity', 'details']) && completeRows(scope.dataStorage, ['name', 'details'])
    && ['no', 'yes', 'unknown'].includes(scope.ot.operates) && scope.ot.details.trim()
    && completeRows(scope.boundaries.exclusions, ['name', 'rationale']));
}
