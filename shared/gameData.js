export const MITRE = [
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance' },
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
  { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' },
  { id: 'T1003', name: 'Credential Dumping', tactic: 'Credential Access' },
  { id: 'T1087', name: 'Account Discovery', tactic: 'Discovery' },
  { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement' },
  { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration' },
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact' },
];

export const ROLE_DEFS = {
  blue: [
    {
      key: 'soc',
      role: 'SOC Analyst',
      description: 'Owns alert triage, hunting, and SIEM correlation.',
      statPoints: 10,
      skills: ['analysis', 'identity', 'telemetry'],
      commands: {
        'investigate-alert': { skill: 'analysis', baseDifficulty: 15 },
        'search-logs': { skill: 'telemetry', baseDifficulty: 14 },
        'hunt-identity': { skill: 'identity', baseDifficulty: 15 },
      }
    },
    {
      key: 'ir',
      role: 'Incident Responder',
      description: 'Owns containment, revocation, and host triage.',
      statPoints: 10,
      skills: ['containment', 'forensics', 'operations'],
      commands: {
        'isolate-host': { skill: 'containment', baseDifficulty: 14 },
        'revoke-session': { skill: 'operations', baseDifficulty: 13 },
        'collect-forensics': { skill: 'forensics', baseDifficulty: 15 },
      }
    },
    {
      key: 'eng',
      role: 'Security Engineer',
      description: 'Owns hardening, patching, and control tuning.',
      statPoints: 10,
      skills: ['patching', 'engineering', 'detection'],
      commands: {
        'deploy-patch': { skill: 'patching', baseDifficulty: 16 },
        'tune-detections': { skill: 'detection', baseDifficulty: 14 },
        'restrict-admin-path': { skill: 'engineering', baseDifficulty: 15 },
      }
    },
    {
      key: 'intel',
      role: 'Threat Intel',
      description: 'Owns IOC analysis, technique mapping, and reporting.',
      statPoints: 10,
      skills: ['intel', 'reporting', 'prediction'],
      commands: {
        'analyze-iocs': { skill: 'intel', baseDifficulty: 14 },
        'map-techniques': { skill: 'intel', baseDifficulty: 14 },
        'predict-next-step': { skill: 'prediction', baseDifficulty: 15 },
      }
    }
  ],
  red: [
    {
      key: 'recon',
      role: 'Recon Specialist',
      description: 'Owns discovery of targets, identities, and edge paths.',
      statPoints: 10,
      skills: ['osint', 'discovery', 'profiling'],
      commands: {
        'scan-surface': { skill: 'discovery', baseDifficulty: 13 },
        'harvest-identities': { skill: 'osint', baseDifficulty: 14 },
        'enumerate-edge': { skill: 'profiling', baseDifficulty: 13 },
      }
    },
    {
      key: 'exploit',
      role: 'Exploit Developer',
      description: 'Owns exploit chaining and initial access operations.',
      statPoints: 10,
      skills: ['exploitation', 'payloads', 'evasion'],
      commands: {
        'exploit-public-app': { skill: 'exploitation', baseDifficulty: 16 },
        'craft-phish': { skill: 'payloads', baseDifficulty: 14 },
        'chain-auth-bypass': { skill: 'evasion', baseDifficulty: 17 },
      }
    },
    {
      key: 'intrusion',
      role: 'Intrusion Operator',
      description: 'Owns credentials, movement, and persistence.',
      statPoints: 10,
      skills: ['credential_access', 'lateral_movement', 'persistence'],
      commands: {
        'dump-credentials': { skill: 'credential_access', baseDifficulty: 16 },
        'pivot-laterally': { skill: 'lateral_movement', baseDifficulty: 15 },
        'establish-persistence': { skill: 'persistence', baseDifficulty: 15 },
      }
    },
    {
      key: 'exfil',
      role: 'Exfiltration Specialist',
      description: 'Owns collection, staging, exfiltration, and impact prep.',
      statPoints: 10,
      skills: ['collection', 'staging', 'impact'],
      commands: {
        'discover-sensitive-data': { skill: 'collection', baseDifficulty: 15 },
        'stage-exfiltration': { skill: 'staging', baseDifficulty: 16 },
        'prepare-impact': { skill: 'impact', baseDifficulty: 16 },
      }
    }
  ]
};

export const SCENARIOS = [
  {
    title: 'Southern Cross Health Network',
    setting: '7:18 AM on a bitter Tuesday in July, during the peak of the Melbourne winter respiratory surge',
    business: 'Southern Cross Health Network operates three hospitals, pathology, clinics, and a telehealth platform. Continuity of care is the dominant executive priority, which means risky technical debt often survives longer than anyone likes.',
    dayToDay: 'Blue-team staff start with phishing queues, identity anomalies, and deferred maintenance meetings. Clinical systems are politically difficult to touch. Vendor-managed imaging and support paths are not fully standardized.',
    timePressure: 'Day shift arrival, delayed patching, and heavy clinical load compress decision-making.',
    objectives: ['Exfiltrate patient medical records', 'Disrupt radiology scheduling', 'Access oncology research data'],
    blueHints: [
      'An internet-facing remote access service missed a maintenance window.',
      'An after-hours support exception bypasses parts of MFA policy.',
      'A legacy clinical segment has weaker visibility than the rest of the network.'
    ],
    redIntel: [
      'Public references to telehealth and vendor-managed imaging systems.',
      'Employee email format visible in conference PDFs.',
      'A staff portal and vendor access edge are visible from the internet.'
    ],
    attackChain: ['T1595', 'T1190', 'T1078', 'T1003', 'T1021', 'T1041', 'T1486']
  },
  {
    title: 'Harbour Ledger Financial Services',
    setting: '8:42 PM on the Thursday before a long-weekend change freeze at quarter close',
    business: 'Harbour Ledger runs lending, acquiring, and mobile banking. Identity is modern in places, inherited elsewhere, and exceptions persist after a merger.',
    dayToDay: 'Blue-team staff balance cloud identity noise, finance reporting demands, Citrix stability, and audit evidence work. Stability pressure creates real friction for preventive controls.',
    timePressure: 'Quarter-close risk tolerance is low, but appetite for disruptive security actions is even lower.',
    objectives: ['Steal customer PII and lending records', 'Gain access to payment operations', 'Disrupt the customer portal'],
    blueHints: [
      'A vendor remote-access path reaches farther than intended.',
      'Duplicate admin groups from a merger were never fully reconciled.',
      'A high-value reporting system depends on older authentication assumptions.'
    ],
    redIntel: [
      'Public procurement documents reference Citrix and Azure migration.',
      'Support vendor staff are easy to enumerate on LinkedIn-like profiles.',
      'Customer and partner access pages expose multiple edge technologies.'
    ],
    attackChain: ['T1595', 'T1566', 'T1078', 'T1087', 'T1021', 'T1041']
  }
];
