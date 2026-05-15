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
 *      - exampleEvidence: examples of acceptable evidence
 *      - whatGoodLooksLike: description of a fully compliant state
 *      - keyChecks: array of specific assessor checks to perform
 */

export const AUDIT_STEPS = [
  {
    id: 'applicant-expectations',
    title: 'Applicant Expectations',
    description:
      'Control 2314 requirement: The Applicant shall align their processing of personal data with UK General Data Protection Regulation. Verify that the applicant complies with UK GDPR when processing PII, obtains and records consent, handles deletion requests correctly, and conducts compliance assessments and DPIAs. Evidence should be proportionate to the size and complexity of the organisation.',
    items: [
      {
        id: 'gdpr-compliance',
        label: 'The applicant complies with UK GDPR requirements when processing PII.',
        hint: 'Confirm the applicant is aware of their obligations under UK GDPR (UK DPA 2018) and has processes to support compliance. Follow ICO guidance. Evidence does not need to be perfect — assess what is proportionate for the size and type of organisation.',
        exampleEvidence: 'Internal memos, meeting minutes discussing UK GDPR, training logs for staff, overarching data governance or compliance framework document.',
        whatGoodLooksLike:
          'The organisation has a documented UK GDPR compliance programme aligned to the UK Data Protection Act 2018, with clearly assigned responsibilities, regular staff training, and an ongoing review cycle. Senior management are visibly accountable and the seven UK GDPR principles (lawfulness/fairness/transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity/confidentiality, accountability) are embedded in day-to-day operations.',
        keyChecks: [
          'Staff are aware of their UK GDPR obligations and have received documented training.',
          'A named individual or team holds accountability for data protection compliance.',
          'A compliance framework exists that references UK GDPR / UK DPA 2018 and follows ICO guidance.',
          'UK GDPR is considered during new projects, system changes, and procurement.',
          'There is evidence of regular management review of the compliance programme.',
        ],
      },
      {
        id: 'consent-obtained',
        label: "Data subjects' consent is obtained, recorded, and they are informed it can be withdrawn at any point.",
        hint: 'Check that a formal consent mechanism exists, that consent records are maintained, and that data subjects are clearly informed of the right to withdraw. Per the official DCC guidance, consent and withdrawal must be handled together.',
        exampleEvidence: 'Screenshots of web forms with checkboxes, consent database logs, physical signed consent forms.',
        whatGoodLooksLike:
          'Consent is obtained before processing begins. It is freely given, specific, informed, and unambiguous — using a clear opt-in mechanism with no pre-ticked boxes. Each consent record is timestamped, linked to the data subject, and stored securely.',
        keyChecks: [
          'Consent mechanism is a positive opt-in (no pre-ticked boxes, no bundled consent).',
          'Separate consent is obtained for each distinct processing purpose.',
          'Consent records capture the date, method, and wording presented to the data subject.',
          'Records are stored securely and can be retrieved per individual on request.',
          'Consent records are retained beyond the period of processing for accountability.',
        ],
      },
      {
        id: 'consent-withdrawal',
        label: 'Data subjects are informed they can withdraw consent at any point.',
        hint: 'Verify that privacy notices and consent forms include clear information on the right to withdraw consent.',
        exampleEvidence: 'Privacy policy excerpts detailing withdrawal, unsubscribe link examples in marketing emails, user portal screenshots showing opt-out options.',
        whatGoodLooksLike:
          'The right to withdraw is communicated clearly at the point of collection and in all subsequent communications. Withdrawal is as easy as giving consent and is actioned promptly without any detriment to the data subject.',
        keyChecks: [
          'Privacy notice and consent forms explicitly state the right to withdraw.',
          'Withdrawal method is as easy and accessible as the original consent mechanism.',
          'Process for actioning withdrawal is documented, tested, and has defined timescales.',
          'Withdrawal is actioned promptly and does not result in detriment to the individual.',
          'Downstream systems and processors are updated following a withdrawal.',
        ],
      },
      {
        id: 'deletion-requests-reviewed',
        label: 'Data deletion requests from individuals are reviewed and responded to.',
        hint: 'Confirm there is a process to receive, log, verify identity, and respond to erasure / right-to-be-forgotten requests.',
        exampleEvidence: 'Standard Operating Procedure (SOP) for handling deletion requests, templates for acknowledging and fulfilling requests.',
        whatGoodLooksLike:
          'A defined SOP governs erasure requests end-to-end: from receipt and logging, through identity verification and legal review, to deletion across all systems and documented response to the data subject — all within the 30-day statutory timescale.',
        keyChecks: [
          'A documented SOP exists for receiving, logging, and responding to deletion requests.',
          'Requests are logged on receipt with a unique reference and timestamp.',
          'Response is provided within 30 days (or documented extension up to 3 months for complex cases).',
          'All systems holding the data, including backups and third-party processors, are considered.',
          'Where a request is refused, the legal grounds are documented and communicated to the individual.',
        ],
      },
      {
        id: 'deletion-identity-verified',
        label: 'Identity of the data deletion requestor is verified before acting on the request.',
        hint: 'Review the identity verification steps taken when handling deletion requests.',
        exampleEvidence: 'Policy detailing ID verification steps, examples of redacted communication asking for ID verification.',
        whatGoodLooksLike:
          'A proportionate identity verification step is built into every deletion request workflow to prevent unauthorised erasure. The method of verification is appropriate to the sensitivity of the data held.',
        keyChecks: [
          'An identity verification step is required before any deletion action is taken.',
          'The verification method is proportionate to the sensitivity and risk of the request.',
          'The verification step and its outcome are recorded against the deletion request log.',
          'Policy specifies acceptable forms of identification for different request types.',
          'Unverified requests are not actioned; the process for handling refusals is documented.',
        ]
      },
      {
        id: 'compliance-assessments',
        label: 'GDPR compliance assessments are conducted to identify and mitigate risks.',
        hint: 'Look for evidence of periodic UK GDPR compliance assessments.',
        exampleEvidence: 'Internal audit schedules, external audit reports, compliance checklists completed by departments.',
        whatGoodLooksLike:
          'Regular UK GDPR compliance assessments are scheduled, completed, and reported to senior management. Findings are risk-rated, remediation plans are produced with named owners and target dates, and evidence of improvements from previous assessments is available.',
        keyChecks: [
          'Assessments are conducted at least annually or after significant changes to processing activities.',
          'Scope covers all processing activities across the organisation.',
          'Results are documented, risk-rated, and reported to senior management.',
          'Remediation actions have named owners and defined due dates.',
          'Evidence exists that findings from previous assessments have been actioned.',
        ],
      },
      {
        id: 'dpias-conducted',
        label: 'Data Protection Impact Assessments (DPIAs) are conducted to identify and mitigate risks associated with data processing activities.',
        hint: 'Verify DPIAs are carried out for high-risk processing activities. Note: not all organisations are required to conduct DPIAs — if the applicant states DPIAs are not applicable, explore and document their rationale (see Considerations step).',
        exampleEvidence: 'The procedure used for conducting DPIAs, the template or tool used to complete an assessment, or a completed DPIA report for a recent project or software deployment.',
        whatGoodLooksLike:
          'DPIAs are embedded in the project and change management lifecycle. They are completed before high-risk processing begins, signed off by the DPO where applicable, and include documented risk mitigation measures. Where residual risk remains high, the ICO has been consulted. Smaller organisations may have simpler DPIA documentation — evidence should be proportionate to their size and complexity.',
        keyChecks: [
          'A screening or trigger process exists to determine when a DPIA is required.',
          'DPIAs are initiated before high-risk processing activities begin (not retrospectively).',
          'The methodology used is documented (e.g. aligned to ICO DPIA guidance).',
          'Risk mitigation measures are clearly documented with owners and implementation status.',
          'ICO consultation is sought and documented where residual risk remains high after mitigation.',
          'If the applicant states DPIAs are not applicable, a clear rationale has been provided and documented.',
        ],
      },
    ],
  },
  {
    id: 'policy',
    title: 'Policy',
    description:
      'Two formal policy requirements apply under Control 2314: (1) documentation or policies outlining the requirement to comply with UK GDPR when processing PII; and (2) documentation or policies outlining the requirement to conduct DPIAs and compliance assessments. Policies may be dedicated documents or incorporated within other company documentation (e.g. a risk register). Evidence should be proportionate to the size and nature of the organisation.',
    items: [
      {
        id: 'gdpr-policy-exists',
        label: 'Documentation / policy exists outlining the requirement to comply with UK GDPR when processing PII. (2314.1)',
        hint: 'Look for a Data Protection Policy, Privacy Policy, or equivalent document that references UK GDPR / UK DPA 2018 obligations. This may be a dedicated policy or incorporated within other company documentation such as a risk register. Smaller organisations may have simpler documentation — assess proportionately.',
        exampleEvidence: "The organisation's Data Protection Policy, Information Security Policy, or risk register documenting how they comply with UK GDPR. Larger organisations will typically have multiple dedicated documents.",
        whatGoodLooksLike:
          'A current Data Protection Policy (or equivalent) exists, is communicated to all relevant staff, and covers the seven UK GDPR principles: lawfulness, fairness and transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity and confidentiality; and accountability. It is version-controlled, named-owned, and has a defined review cycle. It may reference ICO guidance.',
        keyChecks: [
          'Policy references UK GDPR and/or UK Data Protection Act 2018 explicitly.',
          'Policy is version-controlled, dated, and has a defined review frequency.',
          'A named owner is accountable for the policy.',
          'Covers the seven UK GDPR principles and the applicant\'s lawful bases for processing.',
          'Evidence of distribution to relevant staff (e.g. intranet, sign-off records, training logs).',
          'Policy size and complexity is proportionate to the organisation — a small organisation may have a single concise document.',
        ],
      },
      {
        id: 'dpia-compliance-policy-exists',
        label: 'Documentation / policy exists outlining the requirement to conduct DPIAs and compliance assessments. (2314.2)',
        hint: 'Per the official DCC assessor guidance (Control 2314), these two requirements are covered by a single policy check. Look for a DPIA procedure, compliance assessment schedule, or both within the organisation\'s Data Protection Policy or equivalent documentation. Evidence may be a dedicated DPIA policy or a section within broader documentation.',
        exampleEvidence: 'DPIA procedure or policy, compliance assessment schedule, section of the Data Protection Policy covering DPIAs and compliance reviews, completed DPIA template or tool, DPIA report output.',
        whatGoodLooksLike:
          'The organisation has documented procedures covering both DPIAs and compliance assessments. For DPIAs: criteria for when one is required are defined, a methodology is documented (aligned to ICO guidance), and outputs are retained. For compliance assessments: a schedule exists, findings are risk-rated, and remediation is tracked. For smaller organisations, this may be a single simple document covering both.',
        keyChecks: [
          'A DPIA procedure or policy exists, defining when DPIAs are required and how they are conducted.',
          'DPIA methodology aligns with ICO published guidance (e.g. screening criteria, risk assessment steps).',
          'A compliance assessment policy or schedule mandates periodic UK GDPR reviews.',
          'Responsibility for conducting and approving both DPIAs and compliance assessments is assigned.',
          'Records retention requirements for completed DPIAs and assessment reports are stated.',
          'Both requirements may be met within a single document — assess proportionately for the organisation size.',
        ],
      },
    ],
  },
  {
    id: 'implementation-evidence',
    title: 'Implementation Evidence',
    description:
      'Gather and assess evidence demonstrating that UK GDPR controls have been implemented in practice. Evidence must demonstrate real implementation, not just intent. Check all five implementation evidence areas: DPO details; data processing contract clauses; data processing assessment / RoPA; data subject rights documentation; and privacy policy with legal basis.',
    items: [
      {
        id: 'dpo-details',
        label: "The applicant's Data Protection Officer (DPO) details are documented and accessible.",
        hint: "Confirm the DPO's name and contact details are recorded and communicated to relevant stakeholders. If no DPO is required, document the rationale.",
        exampleEvidence: 'Appointment letter of DPO, screenshot of intranet or public website listing DPO contact details, or formal documented rationale for not needing a DPO.',
        whatGoodLooksLike:
          "The DPO is clearly identified, appropriately qualified, free from conflicts of interest, and has sufficient resources and access to senior management. Their contact details are publicly accessible on the privacy notice. If no DPO is required under Article 37, this is documented with clear legal rationale.",
        keyChecks: [
          'DPO contact details are published on the public-facing privacy notice.',
          'DPO appointment is formally documented (e.g. letter of appointment, job description).',
          'DPO is independent and has no conflicts of interest with other roles they hold.',
          'DPO has sufficient resources, training, and access to senior management.',
          'If no DPO is required, a written legal rationale is documented and retained.',
        ],
      },
      {
        id: 'data-processing-clauses',
        label: 'Evidence of data processing template clauses included in contracts where personal data is processed.',
        hint: 'Review sample contracts or Data Processing Agreements (DPAs) for appropriate GDPR clauses.',
        exampleEvidence: 'Blank Data Processing Agreement (DPA) template, signed DPA with a key vendor (redacted).',
        whatGoodLooksLike:
          'All contracts involving personal data processing include a Data Processing Agreement or equivalent clauses meeting all GDPR Article 28(3) requirements. A standard DPA template is used and updated when legislation or guidance changes.',
        keyChecks: [
          'DPA template covers all mandatory Article 28(3) clauses.',
          'Processor is bound to act only on documented instructions from the controller.',
          'Provisions for sub-processors are included, requiring equivalent protections.',
          'Security obligations on the processor are specified (aligned with Article 32).',
          'Controller retains audit rights and the right to inspect the processor.',
        ],
      },
      {
        id: 'data-processing-assessment',
        label: 'Evidence of a data processing assessment determining what personal information is required and who has access.',
        hint: 'Look for a data mapping / inventory exercise, Records of Processing Activities (RoPA), or similar documentation.',
        exampleEvidence: 'Records of Processing Activities (RoPA) spreadsheet, data flow diagrams.',
        whatGoodLooksLike:
          'A comprehensive Records of Processing Activities (RoPA) is maintained, covering all processing activities, data categories, purposes, lawful bases, retention periods, and third-party transfers. It is kept up to date and access-controlled.',
        keyChecks: [
          'RoPA covers all departments and all known processing activities.',
          'Each entry includes: data categories, purpose, lawful basis, retention period, and any transfers.',
          'Access to the RoPA is appropriately controlled and it is reviewed regularly.',
          'Data flow diagrams or equivalent are available for high-risk processing activities.',
          'The RoPA is used to drive DPIAs, privacy notices, and compliance assessments.',
        ],
      },
      {
        id: 'data-subject-rights',
        label: 'Documentation evidencing that data subjects are informed of all their rights.',
        hint: 'Verify the privacy notice covers all GDPR rights: access, rectification, erasure, restriction, portability, objection, and rights related to automated decision-making.',
        exampleEvidence: 'The public Privacy Notice/Policy, employee privacy notice.',
        whatGoodLooksLike:
          'The privacy notice clearly describes all eight GDPR data subject rights in plain, accessible language, explains how to exercise each right, provides contact details for requests, and states the timescale for responses.',
        keyChecks: [
          'All eight rights are addressed: access, rectification, erasure, restriction, portability, objection, and rights relating to automated decision-making and profiling.',
          'Language is clear, jargon-free, and accessible to the intended audience.',
          'Contact method for exercising rights is clearly provided.',
          'Timescales for responses to requests are stated.',
          'Separate privacy notices exist for different audiences (e.g. customers, employees) if processing differs.',
        ],
      },
      {
        id: 'privacy-policy-legal-basis',
        label: "Evidence of clear data processing purpose and legal justification in the applicant's privacy policy.",
        hint: 'Check that the privacy policy specifies the lawful basis for each processing activity (e.g. consent, legitimate interest, legal obligation).',
        exampleEvidence: 'Section of the Privacy Policy mapping data types to lawful bases (e.g., table format).',
        whatGoodLooksLike:
          'The privacy policy explicitly maps each processing activity to a specific lawful basis under Article 6 (and Article 9 for special categories), with a plain English explanation. Legitimate Interests Assessments (LIAs) are documented where applicable.',
        keyChecks: [
          'A lawful basis is specified for every type of personal data processed.',
          'Special category data is identified and the appropriate Article 9 condition is documented.',
          'Legitimate Interests Assessments (LIAs) are documented where legitimate interest is relied upon.',
          'The privacy policy is easily accessible (e.g. linked from every web page, provided at point of data collection).',
          'Processing purposes are stated specifically — vague or overly broad purposes are flagged.',
        ],
      },
    ],
  },
  {
    id: 'operational-effectiveness',
    title: 'Operational Effectiveness Testing',
    description:
      'Test whether the policies and controls are operating effectively in practice. Confirm the applicant is actually operating its UK GDPR processes as documented — not just that policies exist. Look for logs, reports, and walkthroughs across the four operational effectiveness areas.',
    items: [
      {
        id: 'consent-walkthrough',
        label: "Walkthrough: The process for obtaining and recording data subjects' consent has been tested and complies with UK GDPR.",
        hint: 'Walk through the end-to-end consent journey (e.g. web form, opt-in mechanism) and verify consent records are properly stored and include the right to withdraw.',
        exampleEvidence: 'Screen recording of the consent process, tester notes from the walkthrough, extract from the consent log database.',
        whatGoodLooksLike:
          'The consent journey is seamless, transparent, and fully compliant: opt-in only, granular per purpose, clearly worded, and consent records are automatically captured and stored securely. The withdrawal journey is equally smooth and records are updated immediately.',
        keyChecks: [
          'No pre-ticked boxes or implied consent mechanisms are present.',
          'Each processing purpose requires a separate, distinct consent action.',
          'The wording presented to the data subject is clear, specific, and unambiguous.',
          "Consent records are automatically timestamped and linked to the individual's record.",
          'The withdrawal journey was tested and results in immediate, complete cessation of processing.',
        ],
      },
      {
        id: 'deletion-logs',
        label: 'Logs / records show review and response to data deletion requests, including identity verification.',
        hint: 'Request sample deletion request logs. Verify timestamps, identity checks performed, and outcomes are recorded.',
        exampleEvidence: 'Data Subject Access Request (DSAR) or Deletion log tracking spreadsheet (redacted).',
        whatGoodLooksLike:
          'A complete, auditable log exists for all deletion requests, showing receipt, identity verification, processing, outcome, and communication back to the data subject — all within the 30-day statutory timescale.',
        keyChecks: [
          'Each request is tracked end-to-end with a unique reference in the log.',
          'Identity verification step is recorded for each request.',
          'Responses were provided within 30 days, or a documented extension was applied.',
          'Downstream systems and processors were notified of the deletion.',
          'Refusals include documented legal grounds and evidence of communication to the data subject.',
        ],
      },
      {
        id: 'compliance-reports-12m',
        label: 'Reports from UK GDPR compliance assessments conducted within the last 12 months are available.',
        hint: 'Obtain copies of any compliance assessment reports. Check they are dated within the last 12 months and include remediation actions.',
        exampleEvidence: 'Recent internal or external UK GDPR audit report, management review minutes discussing UK GDPR compliance.',
        whatGoodLooksLike:
          'A formal compliance assessment report dated within the last 12 months covers all processing activities, identifies gaps with risk ratings, and has associated remediation plans with named owners and target dates. Evidence of actioned findings from previous assessments is available.',
        keyChecks: [
          'Report is dated within the last 12 months.',
          'Scope is clearly defined and covers all relevant processing activities.',
          'Findings are risk-rated (e.g. critical, high, medium, low).',
          'Remediation actions have named owners and defined due dates.',
          'Evidence exists that findings from previous assessment cycles have been closed.',
        ],
      },
      {
        id: 'dpia-reports-12m',
        label: 'Reports from DPIAs conducted within the last 12 months are available.',
        hint: 'Obtain copies of DPIA reports. Verify they cover current high-risk processing activities and include risk mitigation measures.',
        exampleEvidence: 'DPIA report for a recent major project or system change.',
        whatGoodLooksLike:
          'DPIA reports exist for all processing activities that require one. They are completed before processing begins, include identified risks and mitigation measures, carry DPO sign-off, and are reviewed after significant changes to the processing activity.',
        keyChecks: [
          'DPIAs cover all current high-risk processing activities.',
          'Reports are dated within the last 12 months or since the last significant change.',
          'Risk mitigation measures are documented, with owners and implementation status.',
          'DPO sign-off is recorded on each DPIA.',
          'Where required, ICO consultation is documented within the DPIA record.',
        ],
      },
    ],
  },
  {
    id: 'guiding-questions',
    title: 'Guiding Questions',
    description:
      'Ask the three official guiding questions to understand how the applicant manages UK GDPR compliance in practice. Listen for evidence that processes are real and embedded, not just documented on paper.',
    items: [
      {
        id: 'gdpr-process-explained',
        label: 'Q: Explain the process for ensuring UK GDPR compliance when processing PII.',
        hint: 'The applicant should describe their end-to-end data governance process, including staff training, policy review cycles, and accountability mechanisms.',
        exampleEvidence: 'Documented interview notes, written summary provided by the applicant.',
        whatGoodLooksLike:
          'The applicant provides a clear, structured, and specific account of their GDPR compliance programme — demonstrating genuine operational knowledge rather than superficial policy awareness. They can name key roles, reference specific procedures, and give examples.',
        keyChecks: [
          'Applicant can name their DPO or data protection lead and describe their responsibilities.',
          'Describes a structured and evidenced staff training programme.',
          'Explains how compliance is monitored, measured, and reported to senior management.',
          'References specific policies, procedures, and review cycles by name.',
          'Demonstrates awareness of recent regulatory developments or ICO guidance.',
        ],
      },
      {
        id: 'consent-process',
        label: "Q: How is data subjects' consent obtained and recorded?",
        hint: 'Look for a clearly defined consent mechanism (e.g. explicit opt-in, granular consent), secure storage of consent records, and a process to honour withdrawal requests.',
        exampleEvidence: 'Detailed written response from the applicant explaining the technical and administrative steps.',
        whatGoodLooksLike:
          'The applicant describes a technically sound and operationally tested consent mechanism that meets GDPR requirements for granularity, clarity, and record-keeping. They demonstrate understanding of the difference between consent and other lawful bases.',
        keyChecks: [
          'Applicant explains how consent is obtained differently for each processing purpose.',
          'Describes secure, auditable storage of consent records linked to individuals.',
          'Can demonstrate or describe the withdrawal mechanism and how it is actioned.',
          'Explains how they handle consent for minors or vulnerable individuals if applicable.',
          'Demonstrates awareness that consent is not always the most appropriate lawful basis.',
        ],
      },
      {
        id: 'deletion-process',
        label: 'Q: How are data deletion requests reviewed and responded to?',
        hint: 'The applicant should describe their workflow: receipt, identity verification, review of legal grounds to retain, deletion or documented refusal, and communication back to the data subject.',
        exampleEvidence: 'Flowchart of the deletion request process provided by the applicant, written explanation.',
        whatGoodLooksLike:
          'The applicant provides a clear, end-to-end description of the deletion request workflow, including identity verification, legal review, deletion across all systems (including backups and third-party processors), and timely communication to the data subject.',
        keyChecks: [
          'Process includes an explicit identity verification step with defined methods.',
          'Describes review of legal grounds that may permit retention despite a deletion request.',
          'Covers deletion from all downstream systems, backups, and third-party processors.',
          'References the 30-day statutory response timescale and the extension mechanism.',
          'Explains how partial deletion or pseudonymisation is handled where full deletion is not possible.',
        ],
      },
    ],
  },
  {
    id: 'considerations',
    title: 'Considerations & Final Assessment',
    description:
      'Review additional considerations before finalising the assessment. Has there been a breach that is a \'thread to follow\'? Is DPIA genuinely not applicable to this organisation? Remember: assessing this control does not guarantee UK GDPR compliance — it only indicates the applicant has suitable policies and processes in place and you have found no evidence that UK GDPR is not met.',
    items: [
      {
        id: 'data-breaches',
        label: 'Have there been any breaches? If so, what happened, and is this a thread to follow?',
        hint: 'Review the breach register. Ask what happened with any breaches and determine whether there is an underlying systemic issue — a \'thread to follow\'  — that warrants deeper investigation. Confirm any notifiable breaches were reported to the ICO within 72 hours.',
        exampleEvidence: 'Data breach incident log/register, correspondence with the ICO, post-incident review reports.',
        whatGoodLooksLike:
          'A current breach register is maintained. Any notifiable breaches were reported to the ICO within 72 hours and affected data subjects were notified where required. Root-cause analysis and remediation are documented for every incident. There is no evidence of systemic or recurring breach patterns indicating a structural control failure.',
        keyChecks: [
          'A breach register exists and is kept up to date.',
          'All notifiable breaches were reported to the ICO within 72 hours.',
          'Affected individuals were notified without undue delay where required.',
          'Root-cause analysis has been conducted for each notifiable breach.',
          'No evidence of systemic or recurring breach patterns — if patterns exist, treat as a thread to follow.',
        ],
      },
      {
        id: 'dpia-applicability',
        label: 'If the Applicant states DPIAs are not applicable to their organisation, has this been discussed and a rationale accepted?',
        hint: "Per the official DCC assessor guidance: if the Applicant says DPIAs are not applicable, discuss the reasons. Not all organisations are required to carry out a DPIA. If DPIA is genuinely not applicable, mark question 2314.2 as pass.",
        exampleEvidence: 'Written statement or documented rationale from the Applicant explaining why DPIAs are not applicable, assessor note confirming the rationale was discussed and accepted.',
        whatGoodLooksLike:
          'The Applicant can clearly articulate why DPIAs are not applicable (e.g. no high-risk processing activities, limited or no special category data, small scale processing). The rationale is documented and credible. Where DPIA is not applicable but a basic privacy risk assessment is conducted, note this as positive evidence. If in doubt, challenge the rationale.',
        keyChecks: [
          'The Applicant has provided a clear, documented reason why DPIAs are not applicable.',
          'The rationale is credible and consistent with the nature and scale of the organisation\'s processing activities.',
          'If DPIA is genuinely not applicable, question 2314.2 is marked as pass.',
          'The assessor has challenged any weak or insufficient rationale.',
          'The outcome (applicable or not applicable) is documented in the assessment record.',
        ],
      },
      {
        id: 'breach-remediation',
        label: 'If breaches occurred, has appropriate remediation been carried out to prevent recurrence?',
        hint: 'Look for evidence of root-cause analysis and corrective actions following any breach.',
        exampleEvidence: 'Post-incident review reports, documentation of new security controls implemented.',
        whatGoodLooksLike:
          'For every historical breach, a post-incident review was conducted, root causes were identified, and corrective controls were implemented and verified as effective. Lessons learned have been shared with relevant staff.',
        keyChecks: [
          'Post-incident review reports exist for each notifiable breach.',
          'Root causes are clearly identified — including underlying systemic issues, not just immediate causes.',
          'Corrective actions are documented with named owners and completion evidence.',
          'Controls implemented post-breach have been tested to confirm effectiveness.',
          'Lessons learned have been shared with relevant staff and fed back into training and policy.',
        ],
      },
      {
        id: 'overall-posture',
        label: 'Overall UK GDPR posture: The applicant has suitable policies and processes in place to meet UK GDPR, with no evidence found that UK GDPR is not met.',
        hint: 'Consider all evidence gathered throughout this audit. Per the official DCC guidance: assessing this control does not guarantee UK GDPR compliance — it only means the Applicant has suitable policies and processes in place to meet UK GDPR and you have not found any evidence that UK GDPR is not met. A Level 0 / Control 2314 assessment verifies baseline documentation and processes.',
        exampleEvidence: 'Final Assessor summary note or sign-off.',
        whatGoodLooksLike:
          'All required evidence areas have been assessed. The applicant has suitable policies and processes for UK GDPR compliance and the assessor has found no evidence that UK GDPR is not met. Outstanding partial findings have documented remediation plans. Senior management demonstrate awareness and accountability for data protection.',
        keyChecks: [
          'All audit areas have been assessed and no critical items are left unaddressed.',
          'Outstanding non-compliant or partially compliant findings have documented, time-bound remediation plans.',
          'No evidence found throughout the assessment that UK GDPR is being breached.',
          'Senior management demonstrates awareness and commitment to UK GDPR compliance.',
          'Outcome matches the official DCC caveat: suitable policies and processes in place, no evidence of non-compliance — not a full GDPR certification.',
        ],
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
