/**
 * Which sentences the build copies for two app-built uses of the verified
 * text: the decision review options the Decision Decoder shows, and the one
 * sentence each answer correction quotes. Selectors work as in build.mjs:
 * the opening words of a paragraph, or part of one by sentence count.
 */

export const REVIEW_ENTRIES = [
  {
    id: "cfr-3.2500-a",
    citation: "38 CFR § 3.2500(a)",
    section: "3.2500",
    select: [
      {
        from: "(a) Reviews available.",
        through: "(2) At any time after VA issues notice",
      },
    ],
  },
  {
    id: "cfr-3.2601-f",
    citation: "38 CFR § 3.2601(f)",
    section: "3.2601",
    select: ["(f) Evidentiary record."],
  },
  {
    id: "cfr-20.203",
    citation: "38 CFR § 20.203(a)-(b)",
    section: "20.203",
    select: ["(a) Place of filing.", "(b) Time of filing."],
  },
  {
    id: "cfr-20.202-a-b",
    citation: "38 CFR § 20.202(a)-(b)",
    section: "20.202",
    select: [
      { start: "(a) In general.", firstSentences: 2 },
      {
        from: "(b) Review options.",
        through: "(3) An opportunity to submit additional evidence",
      },
    ],
  },
];

export const REVIEW_FORM_NUMBERS = ["20-0996", "10182", "20-0995"];

const LANES_OPENING = "(1) Within one year from the date on which the agency";
const SUPPLEMENTAL_ANY_TIME = "(2) At any time after VA issues notice";

export const REVIEW_OPTIONS_SPEC = {
  lead: {
    citation: "38 CFR § 3.2500(a)(1)",
    section: "3.2500",
    select: [LANES_OPENING],
  },
  lanes: [
    {
      id: "higher-level-review",
      form: "20-0996",
      quotes: [
        {
          citation: "38 CFR § 3.2500(a)(1)(i)",
          section: "3.2500",
          select: ["(i) A request for higher-level review"],
        },
        {
          citation: "38 CFR § 3.2601(f)",
          section: "3.2601",
          select: [{ start: "(f) Evidentiary record.", firstSentences: 2 }],
        },
      ],
    },
    {
      id: "board-appeal",
      form: "10182",
      quotes: [
        {
          citation: "38 CFR § 3.2500(a)(1)(ii)",
          section: "3.2500",
          select: ["(ii) An appeal to the Board under"],
        },
        {
          citation: "38 CFR § 20.203(a)",
          section: "20.203",
          select: ["(a) Place of filing."],
        },
        {
          citation: "38 CFR § 20.203(b)",
          section: "20.203",
          select: [{ start: "(b) Time of filing.", firstSentences: 2 }],
        },
      ],
    },
    {
      id: "supplemental-claim",
      form: "20-0995",
      quotes: [
        {
          citation: "38 CFR § 3.2500(a)(2)",
          section: "3.2500",
          select: [SUPPLEMENTAL_ANY_TIME],
        },
        {
          citation: "38 CFR § 3.2501(a)(1)",
          section: "3.2501",
          select: ["(1) Definition."],
        },
      ],
    },
  ],
};

export const CORRECTION_SPECS = {
  secondary: {
    citation: "38 CFR § 3.310(a)",
    section: "3.310",
    select: [{ start: "(a) General.", firstSentences: 2 }],
  },
  "tdiu-judgment": {
    citation: "38 CFR § 4.16(a)",
    section: "4.16",
    select: [
      {
        start: "(a) Total disability ratings for compensation may be assigned",
        firstSentences: 1,
      },
    ],
  },
  "tdiu-extra-schedular": {
    citation: "38 CFR § 4.16(b)",
    section: "4.16",
    select: [{ start: "(b) It is the established policy", firstSentences: 2 }],
  },
  "presumptive-herbicide": {
    citation: "38 CFR § 3.309(e)",
    section: "3.309",
    select: [
      "(e) Disease associated with exposure to certain herbicide agents.",
    ],
  },
  "presumptive-toxic": {
    citation: "VA manual M21-1 VIII.ii.2.A.1.d",
    topic: "toxic-rule",
    line: "Veterans who served in a qualifying location",
  },
  "presumed-toxic-exposure": {
    citation: "VA manual M21-1 VIII.ii.2.A.1.e",
    topic: "toxic-service",
    line: "VA will presume BPOT exposure",
  },
  "higher-level-review-evidence": {
    citation: "38 CFR § 3.2601(f)",
    section: "3.2601",
    select: [{ start: "(f) Evidentiary record.", firstSentences: 2 }],
  },
  "ratings-combined": {
    citation: "38 CFR § 4.25",
    section: "4.25",
    select: [
      {
        start: "Table I, Combined Ratings Table, results from",
        afterSentences: 1,
      },
    ],
  },
  "supplemental-any-time": {
    citation: "38 CFR § 3.2500(a)(2)",
    section: "3.2500",
    select: [SUPPLEMENTAL_ANY_TIME],
  },
  "new-and-relevant": {
    citation: "38 CFR § 3.2501(a)",
    section: "3.2501",
    select: ["(a) New and relevant evidence."],
  },
  "intent-to-file-purpose": {
    citation: "38 CFR § 3.155(b)",
    section: "3.155",
    select: [{ start: "(b) Intent to file a claim.", firstSentences: 2 }],
  },
  "review-filing": {
    citation: "38 CFR § 3.2500(a)",
    section: "3.2500",
    select: [{ from: LANES_OPENING, through: SUPPLEMENTAL_ANY_TIME }],
  },
};
