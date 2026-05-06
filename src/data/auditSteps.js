/**
 * DCC Level 0 GDPR Audit - Wizard Step Definitions
 *
 * Each step contains:
 *  - id: unique identifier
 *  - title: display title
 *  - description: brief description shown at the top of the step
 *  - items: array of checklist items the assessor must evaluate
 *    Each item has:
 *      - id: unique identifier within the step
 *      - label: the evidence / check description
 *      - hint: (optional) additional guidance for the assessor
 */

export const AUDIT_STEPS = [
  {
    id: 'applicant-expectations',
    title: 'Applicant Expectations',
    description:
      'Verify that the applicant has appropriate expectations and practices in place for GDPR compliance when processing Personally Identifiable Information (PII).',
    items: [
      {
        id: 'gdpr-compliance',
        label: 'The applicant complies with GDPR requirements when processing PII.',
        hint: 'Confirm the applicant is aware of their obligations under GDPR and has processes to support compliance.',
        exampleEvidence: 'Internal memos, meeting minutes discussing GDPR, training logs for staff, overarching data governance framework document.'
      },
      {
        id: 'consent-obtained',
        label: 'Data subjects\' consent is obtained and recorded.',
        hint: 'Check that a formal consent mechanism exists and that records of consent are maintained.',
        exampleEvidence: 'Screenshots of web forms with checkboxes, consent database logs, physical signed consent forms.'
      },
      {
        id: 'consent-withdrawal',
        label: 'Data subjects are informed they can withdraw consent at any point.',
        hint: 'Verify that privacy notices and consent forms include clear information on the right to withdraw consent.',
        exampleEvidence: 'Privacy policy excerpts detailing withdrawal, unsubscribe link examples in marketing emails, user portal screenshots showing opt-out options.'
      },
      {
        id: 'deletion-requests-reviewed',
        label: 'Data deletion requests from individuals are reviewed and responded to.',
        hint: 'Confirm there is a process to receive, log, verify identity, and respond to erasure / right-to-be-forgotten requests.',
        exampleEvidence: 'Standard Operating Procedure (SOP) for handling deletion requests, templates for acknowledging and fulfilling requests.'
      },
      {
        id: 'deletion-identity-verified',
        label: 'Identity of the data deletion requestor is verified before acting on the request.',
        hint: 'Review the identity verification steps taken when handling deletion requests.',
        exampleEvidence: 'Policy detailing ID verification steps, examples of redacted communication asking for ID verification.'
      },
      {
        id: 'compliance-assessments',
        label: 'GDPR compliance assessments are conducted to identify and mitigate risks.',
        hint: 'Look for evidence of periodic compliance assessments.',
        exampleEvidence: 'Internal audit schedules, external audit reports, compliance checklists completed by departments.'
      },
      {
        id: 'dpias-conducted',
        label: 'Data Protection Impact Assessments (DPIAs) are conducted to identify and mitigate risks.',
        hint: 'Verify DPIAs are carried out for high-risk processing activities.',
        exampleEvidence: 'Completed DPIA templates for recent projects or new software deployments.'
      },
    ],
  },
  {
    id: 'policy',
    title: 'Policy',
    description:
      'Review formal documentation and policies that govern GDPR compliance and risk assessment activities within the organisation.',
    items: [
      {
        id: 'gdpr-policy-exists',
        label: 'Documentation / policy exists outlining the requirement to comply with GDPR when processing PII.',
        hint: 'Look for a Data Protection Policy, Privacy Policy, or equivalent document that references GDPR obligations.',
        exampleEvidence: 'The organisation\'s main Data Protection Policy or Information Security Policy.'
      },
      {
        id: 'dpia-policy-exists',
        label: 'Documentation / policy exists outlining the requirement to conduct DPIAs.',
        hint: 'Confirm there is a policy mandating DPIAs for relevant processing activities.',
        exampleEvidence: 'DPIA Policy or a section within the Data Protection Policy detailing when and how to conduct DPIAs.'
      },
      {
        id: 'compliance-assessment-policy-exists',
        label: 'Documentation / policy exists outlining the requirement to conduct compliance assessments.',
        hint: 'Check for procedures or schedules that mandate regular GDPR compliance reviews.',
        exampleEvidence: 'Compliance Policy, internal audit charters, or management review meeting agendas.'
      },
    ],
  },
  {
    id: 'implementation-evidence',
    title: 'Implementation Evidence',
    description:
      'Gather and assess evidence demonstrating that GDPR controls have been implemented in practice.',
    items: [
      {
        id: 'dpo-details',
        label: 'The applicant\'s Data Protection Officer (DPO) details are documented and accessible.',
        hint: 'Confirm the DPO\'s name and contact details are recorded and communicated to relevant stakeholders. If no DPO is required, document the rationale.',
        exampleEvidence: 'Appointment letter of DPO, screenshot of intranet or public website listing DPO contact details, or formal documented rationale for not needing a DPO.'
      },
      {
        id: 'data-processing-clauses',
        label: 'Evidence of data processing template clauses included in contracts where personal data is processed.',
        hint: 'Review sample contracts or Data Processing Agreements (DPAs) for appropriate GDPR clauses.',
        exampleEvidence: 'Blank Data Processing Agreement (DPA) template, signed DPA with a key vendor (redacted).'
      },
      {
        id: 'data-processing-assessment',
        label: 'Evidence of a data processing assessment determining what personal information is required and who has access.',
        hint: 'Look for a data mapping / inventory exercise, Records of Processing Activities (RoPA), or similar documentation.',
        exampleEvidence: 'Records of Processing Activities (RoPA) spreadsheet, data flow diagrams.'
      },
      {
        id: 'data-subject-rights',
        label: 'Documentation evidencing that data subjects are informed of all their rights.',
        hint: 'Verify the privacy notice covers all GDPR rights: access, rectification, erasure, restriction, portability, objection, and rights related to automated decision-making.',
        exampleEvidence: 'The public Privacy Notice/Policy, employee privacy notice.'
      },
      {
        id: 'privacy-policy-legal-basis',
        label: 'Evidence of clear data processing purpose and legal justification in the applicant\'s privacy policy.',
        hint: 'Check that the privacy policy specifies the lawful basis for each processing activity (e.g. consent, legitimate interest, legal obligation).',
        exampleEvidence: 'Section of the Privacy Policy mapping data types to lawful bases (e.g., table format).'
      },
    ],
  },
  {
    id: 'operational-effectiveness',
    title: 'Operational Effectiveness Testing',
    description:
      'Test whether the policies and controls are operating effectively in practice.',
    items: [
      {
        id: 'consent-walkthrough',
        label: 'Walkthrough: The process for obtaining and recording data subjects\' consent has been tested and complies with GDPR.',
        hint: 'Walk through the end-to-end consent journey (e.g. web form, opt-in mechanism) and verify consent records are properly stored.',
        exampleEvidence: 'Screen recording of the consent process, tester notes from the walkthrough, extract from the consent log database.'
      },
      {
        id: 'deletion-logs',
        label: 'Logs / records show review and response to data deletion requests, including identity verification.',
        hint: 'Request sample deletion request logs. Verify timestamps, identity checks performed, and outcomes are recorded.',
        exampleEvidence: 'Data Subject Access Request (DSAR) or Deletion log tracking spreadsheet (redacted).'
      },
      {
        id: 'compliance-reports-12m',
        label: 'Reports from GDPR compliance assessments conducted within the last 12 months are available.',
        hint: 'Obtain copies of any compliance assessment reports. Check they are dated within the last 12 months and include remediation actions.',
        exampleEvidence: 'Recent internal or external GDPR audit report, management review minutes discussing GDPR compliance.'
      },
      {
        id: 'dpia-reports-12m',
        label: 'Reports from DPIAs conducted within the last 12 months are available.',
        hint: 'Obtain copies of DPIA reports. Verify they cover current high-risk processing activities and include risk mitigation measures.',
        exampleEvidence: 'DPIA report for a recent major project or system change.'
      },
    ],
  },
  {
    id: 'guiding-questions',
    title: 'Guiding Questions',
    description:
      'Record the applicant\'s responses to key guiding questions. Use the notes field to capture their answers for the final report.',
    items: [
      {
        id: 'gdpr-process-explained',
        label: 'Q: Explain the process for ensuring GDPR compliance when processing PII.',
        hint: 'The applicant should describe their end-to-end data governance process, including staff training, policy review cycles, and accountability mechanisms.',
        exampleEvidence: 'Documented interview notes, written summary provided by the applicant.'
      },
      {
        id: 'consent-process',
        label: 'Q: How is data subjects\' consent obtained and recorded?',
        hint: 'Look for a clearly defined consent mechanism (e.g. explicit opt-in, granular consent), secure storage of consent records, and a process to honour withdrawal requests.',
        exampleEvidence: 'Detailed written response from the applicant explaining the technical and administrative steps.'
      },
      {
        id: 'deletion-process',
        label: 'Q: How are data deletion requests reviewed and responded to?',
        hint: 'The applicant should describe their workflow: receipt, identity verification, review of legal grounds to retain, deletion or documented refusal, and communication back to the data subject.',
        exampleEvidence: 'Flowchart of the deletion request process provided by the applicant, written explanation.'
      },
    ],
  },
  {
    id: 'considerations',
    title: 'Considerations & Final Assessment',
    description:
      'Review additional considerations, including any data breaches, and record the overall audit outcome. Note: A satisfactory outcome does not guarantee full GDPR compliance — it indicates the applicant has suitable policies and evidence in place.',
    items: [
      {
        id: 'data-breaches',
        label: 'Have there been any data breaches? If so, were they reported appropriately and is there a residual risk?',
        hint: 'Review the breach register. Confirm any notifiable breaches were reported to the supervisory authority within 72 hours. Assess whether the breach represents an ongoing or systemic risk.',
        exampleEvidence: 'Data breach incident log/register, correspondence with the ICO or relevant supervisory authority.'
      },
      {
        id: 'breach-remediation',
        label: 'If breaches occurred, has appropriate remediation been carried out to prevent recurrence?',
        hint: 'Look for evidence of root-cause analysis and corrective actions following any breach.',
        exampleEvidence: 'Post-incident review reports, documentation of new security controls implemented.'
      },
      {
        id: 'overall-posture',
        label: 'Overall GDPR posture: The applicant has suitable policies, processes, and evidence to demonstrate Level 0 GDPR compliance.',
        hint: 'Consider all evidence gathered throughout this audit. A Level 0 assessment verifies baseline documentation and intent; it does not constitute a full GDPR compliance certification.',
        exampleEvidence: 'Final Assessor summary note or sign-off.'
      },
    ],
  },
];

export const STATUS_OPTIONS = [
  { value: 'not-assessed', label: 'Not Assessed', color: '#6b7280' },
  { value: 'compliant', label: 'Compliant', color: '#16a34a' },
  { value: 'partial', label: 'Partially Compliant', color: '#d97706' },
  { value: 'non-compliant', label: 'Non-Compliant', color: '#dc2626' },
  { value: 'not-applicable', label: 'Not Applicable', color: '#2563eb' },
];
