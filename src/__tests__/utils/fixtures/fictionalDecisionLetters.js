/**
 * Fictional decision letters in different shapes, for the Decision Decoder's
 * rule-based reading. Every name, office, date and finding is invented.
 */
const HEADER = [
  "SYNTHETIC TEST FIXTURE - NOT A REAL DOCUMENT",
  "DEPARTMENT OF VETERANS AFFAIRS",
  "Regional Office of Nowhere (fictional)",
  "RATING DECISION",
  "Veteran: Pat Q. Sample-Fictional",
].join("\n");

export const ALL_GRANTED = `${HEADER}

DECISION
1. Service connection for tinnitus is granted with an evaluation of 10 percent.
2. Service connection for a right ankle sprain is granted with an evaluation
of 10 percent.

REASONS FOR DECISION
1. Tinnitus. Noise exposure in service is conceded. Service connection is
granted.
2. Right ankle sprain. The examiner linked the sprain to a fall recorded in
service. Service connection is granted.
`;

export const ALL_DENIED = `${HEADER}

DECISION
1. Service connection for a left knee strain is denied.
2. Service connection for a lower back strain is
denied.

REASONS FOR DECISION
1. Left knee strain. The records show no knee complaint in service. Service
connection is denied.
2. Lower back strain. The records show no back complaint in service. Service
connection is denied.
`;

export const ONE_DEFERRED = `${HEADER}

DECISION
1. Service connection for tinnitus is granted with an evaluation of 10 percent.
2. The claim for service connection for sleep apnea is deferred pending a VA
examination.

REASONS FOR DECISION
1. Tinnitus. Noise exposure in service is conceded. Service connection is
granted.
2. Sleep apnea. An examination has been requested. A decision on this issue
is deferred.
`;

export const RATING_CONTINUED = `${HEADER}

DECISION
1. The evaluation of migraine headaches, currently 30 percent disabling, is
continued.

REASONS FOR DECISION
1. Migraine headaches. The examination showed attacks about once a month.
A higher evaluation of 50 percent needs very frequent, completely
prostrating attacks, which the evidence does not show. The 30 percent
evaluation is continued.
`;

export const CONTINUED_AND_DENIED = `${HEADER}

DECISION
1. The evaluation of migraine headaches, currently 30 percent disabling, is
continued.
2. Service connection for a left knee strain is denied.

REASONS FOR DECISION
1. Migraine headaches. The 30 percent evaluation is continued.
2. Left knee strain. Service connection is denied because the evidence does
not show a link between the current condition and service.
`;
