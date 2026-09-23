import { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { scopeDiagramPng } from './scopeDiagrams';

const text = (value) => String(value || '').trim() || 'Not provided — review before submission';
const p = (value, options = {}) => { const { bold, color, ...paragraphOptions } = options; return new Paragraph({ children: [new TextRun({ text: String(value), bold, color })], spacing: { after: 100 }, ...paragraphOptions }); };
const heading = (value, level = HeadingLevel.HEADING_1) => new Paragraph({ text: value, heading: level, spacing: { before: 250, after: 120 } });
function table(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'B8C2CC' };
  const cell = (value, header = false) => new TableCell({ children: [p(value, { bold: header, color: header ? 'FFFFFF' : '1E293B' })], shading: header ? { fill: '1E3A5F' } : undefined, borders: { top: border, bottom: border, left: border, right: border }, width: { size: 100 / headers.length, type: WidthType.PERCENTAGE } });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headers.map((v) => cell(v, true)), tableHeader: true }), ...rows.map((row) => new TableRow({ children: headers.map((_, i) => cell(row[i] || 'Not provided')) }))] });
}
function entryRows(rows, detailKey) { return rows.length ? rows.map((row) => [text(row.name), text(row[detailKey])]) : [['Not provided', 'Not provided']]; }
export async function downloadScopeAttestationDocx({ scope, level, organisationName, assessorName, auditDate }) {
  const sections = [
    { properties: {}, children: [
      p('DEFENCE CYBER CERTIFICATION (DCC)', { bold: true, color: '1E3A5F', alignment: AlignmentType.CENTER }),
      p(`${level.title} Scoping Attestation`, { heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      p('Scope boundary and certification alignment', { alignment: AlignmentType.CENTER }),
      heading('Document and organisation details'),
      table(['Detail', 'Value'], [
        ['Organisation Name', text(scope.organisation.legalName || organisationName)], ['Company Registration Number', scope.organisation.companyNumber],
        ['Registered Address', scope.organisation.registeredAddress], ['DCC Certification Level', level.title], ['DCC Application Reference', scope.organisation.applicationReference],
        ['Certification Scope', scope.service.certificationScope], ['Document Version & Date', `Version ${text(scope.organisation.documentVersion)} — ${text(scope.organisation.documentDate || auditDate)}`],
        ['Assessor / Assessment Body', `${text(scope.organisation.assessor || assessorName)}, ${text(scope.organisation.assessmentBody)}`],
      ]),
      heading('Context and scoping alignment'), p('This document records the organisation’s declared DCC assessment boundary, related certification boundaries, included systems and assets, exclusions, and authorisation. Information is supplied by the applicant and must be confirmed with the assessment body.'),
      heading('Attestation statement'), p(scope.declaration.statement || `I, ${text(scope.declaration.signatoryName)}, ${text(scope.declaration.signatoryTitle)}, am authorised to make this statement on behalf of ${text(scope.organisation.legalName || organisationName)}. I attest that the statements in this ${level.title} scoping document are accurate and complete, that no material facts have been omitted or misrepresented, and that all essential services, networks, identities, and functions needed for normal business activities and contracted outputs are represented in the scope below.`),
      heading('Scope purpose and rationale'), p(`In-scope service or activity: ${text(scope.service.description)}\nEssential functions: ${text(scope.service.essentialFunctions)}\nContracted outputs: ${text(scope.service.contractedOutputs)}\nScope rationale: ${text(scope.service.rationale)}`),
      heading('(a) Sites and their operational functions'), table(['Site / Location', 'Operational Function & Boundary Details'], entryRows(scope.sites, 'function')),
      heading('(b) IT networks and systems'), table(['Network / Platform', 'Implementation & Purpose'], entryRows(scope.systems, 'purpose')),
      heading('(c) Operational technology (OT) networks and systems'), p(scope.ot.operates === 'no' ? `The organisation declares that it does not operate OT, ICS, or SCADA platforms within the business operations described in this assessment scope. ${text(scope.ot.details)}` : text(scope.ot.details)),
      heading('(d) Devices and assets'), table(['Device Classification', 'Quantity', 'Operating System & Management State'], scope.assets.length ? scope.assets.map((row) => [text(row.name), text(row.quantity), text(row.details)]) : [['Not provided', 'Not provided', 'Not provided']]),
      heading('(e) Data and document storage'), table(['Repository / Storage', 'Purpose, location and protection'], entryRows(scope.dataStorage, 'details')),
      heading('(f) Scoping architecture and boundary diagrams'), p('These diagrams are generated from the organisation’s entries in this attestation. Confirm exact membership and relationships before formal submission.'),
      new Paragraph({ children: [new ImageRun({ data: await scopeDiagramPng(scope, 'boundary'), transformation: { width: 500, height: 300 }, altText: { title: 'DCC and Cyber Essentials scope boundary', description: 'Customer-entered DCC and CE scope inclusions and exclusions', name: 'DCC scope boundary' } })], alignment: AlignmentType.CENTER }),
      heading('(f)(i) Scope definition and boundary alignment'), table(['In Scope (DCC & CE / CE+ Coterminous)', 'Out of Scope (Formally Excluded)'], [[text(scope.boundaries.inDcc), scope.boundaries.exclusions.length ? scope.boundaries.exclusions.map((row) => `${text(row.name)} — ${text(row.rationale)}`).join('\n') : 'Not provided — confirm exclusions or record none']]),
      p(`CE / CE+ declared boundary: ${text(scope.boundaries.inCyberEssentials)}`),
      p(`Cyber Essentials scope overlap: ${text(scope.boundaries.overlap)} ${text(scope.boundaries.overlapExplanation)} ${text(scope.diagram.dccCeCoterminous)}`),
      heading('(f)(ii) Systems, networks, assets and relationships'), p(text(scope.diagram.relationships)),
      new Paragraph({ children: [new ImageRun({ data: await scopeDiagramPng(scope, 'architecture'), transformation: { width: 500, height: 300 }, altText: { title: 'Systems, networks, assets and relationships', description: 'Customer-entered sites, systems, storage, asset classes and connections', name: 'Systems and assets diagram' } })], alignment: AlignmentType.CENTER }),
      heading('(f)(iii) Boundary coterminous matrix'), table(['Relationship', 'Scope Content'], [
        ['In DCC scope, not in CE/CE+ scope', text(scope.boundaries.coterminousMatrix.dccOnly)], ['In CE/CE+ scope, not in DCC scope', text(scope.boundaries.coterminousMatrix.ceOnly)],
        ['In both scopes', text(scope.boundaries.coterminousMatrix.both)], ['In neither scope', text(scope.boundaries.coterminousMatrix.neither)],
      ]),
      heading('Certification currency and maintenance'), table(['Framework', 'Scope Boundary', 'Status / Reference'], [
        ['Cyber Essentials', text(scope.certifications.cyberEssentials.scope), `${text(scope.certifications.cyberEssentials.reference)} — ${text(scope.certifications.cyberEssentials.status)}; renewal ${text(scope.certifications.cyberEssentials.renewalDate)}`],
        ['Cyber Essentials Plus', text(scope.certifications.cyberEssentialsPlus.scope), `${text(scope.certifications.cyberEssentialsPlus.reference)} — ${text(scope.certifications.cyberEssentialsPlus.status)}; renewal ${text(scope.certifications.cyberEssentialsPlus.renewalDate)}`],
        ['Defence Cyber Certification', text(scope.service.certificationScope), text(scope.certifications.dccReference || scope.organisation.applicationReference)],
      ]),
      heading('Declaration and authorisation'), p('I understand that a material omission or misleading statement may affect assessment validity. I confirm the information is complete to the best of my knowledge and undertake to report material changes to the declared scope. I also confirm that the organisation will maintain any required Cyber Essentials certification for the duration of the relevant activity and DCC certification period.'),
      p(`Additional declaration notes: ${text(scope.declaration.additionalDeclaration)}`),
      p(`Authorised Signature: __________________________________________   Full Name: ${text(scope.declaration.signatoryName)}   Title / Position: ${text(scope.declaration.signatoryTitle)}   Date: ${text(scope.declaration.signatureDate || auditDate)}`),
    ] },
  ];
  const doc = new Document({ creator: 'DCC Readiness Guide', title: `${level.title} Scoping Attestation`, description: 'DCC scope attestation generated from customer-provided scope details', sections, styles: { default: { document: { run: { font: 'Arial', size: 20, color: '1E293B' }, paragraph: { spacing: { after: 100 } } } } } });
  const blob = await Packer.toBlob(doc);
  const safeName = (scope.organisation.legalName || organisationName || 'organisation').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `DCC_${level.title.replaceAll(' ', '_')}_Scope_Attestation_${safeName}.docx`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
