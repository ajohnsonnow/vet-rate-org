/**
 * The M21-1 topics the verified-reference bundle quotes: where each one
 * starts and stops in its article, and where its flattened tables and lists
 * are broken back into lines. Every `at` phrase is copied from the source
 * text; structureText fails the build if one stops matching.
 *
 * Where a list has no punctuation between items, the item boundaries below
 * are the only thing in the bundle that is not taken from the source
 * mechanically. They move line breaks, never words.
 */

const TOPIC_TAIL = [" References:", " Reference:"];
const BPOT_ARTICLE = "M21-1, Part VIII, Subpart ii, Chapter 2, Section A - ";
const HERBICIDE_ARTICLE =
  "M21-1, Part VIII, Subpart i, Chapter 1, Section A - ";

const line = (at) => ({ at, as: "line" });
const item = (at) => ({ at, as: "item" });
const block = (at) => ({ at, as: "block" });
const firstItem = (at) => ({ at, as: "firstItem" });
const items = (...phrases) => phrases.map(item);

export const MANUAL_TOPICS = {
  "toxic-rule": {
    article: BPOT_ARTICLE,
    start: "VIII.ii.2.A.1.d.",
    end: "VIII.ii.2.A.1.e.",
    stopAt: TOPIC_TAIL,
    structure: [
      line("Veterans who served in a qualifying location"),
      line("Effective August 10, 2022,"),
      line("Exception:"),
    ],
  },
  "toxic-service": {
    article: BPOT_ARTICLE,
    start: "VIII.ii.2.A.1.e.",
    end: "VIII.ii.2.A.1.f.",
    stopAt: [" Important:", ...TOPIC_TAIL],
    structure: [
      line("A covered Veteran means"),
      line("VA will presume BPOT exposure"),
      line("Time period 38 CFR 3.320 Locations"),
      block("Active service on or after August 2, 1990"),
      item("Duty station in, including airspace above, Bahrain"),
      item("Duty station in, including airspace above, Somalia"),
      block("Active service on or after September 11, 2001"),
      item("Duty station in, including airspace above, Afghanistan"),
      item("Duty station in, including airspace above, Egypt"),
      block("Note:"),
    ],
  },
  "toxic-conditions-1120": {
    article: BPOT_ARTICLE,
    start: "VIII.ii.2.A.1.f.",
    end: "VIII.ii.2.A.1.g.",
    stopAt: TOPIC_TAIL,
    structure: [
      line("Effective August 10, 2022,"),
      line("Under 38 U.S.C. 1120, the recognized presumptive conditions are"),
      ...items(
        "head cancer of any type",
        "neck cancer of any type",
        "respiratory cancer of any type",
        "gastrointestinal cancer of any type",
        "reproductive cancer of any type",
        "lymphoma cancer of any type",
        "kidney cancer",
        "brain cancer",
        "melanoma",
        "pancreatic cancer",
        "chronic bronchitis",
        "chronic obstructive pulmonary disease",
        "constrictive bronchiolitis or obliterative bronchiolitis",
        "emphysema",
        "granulomatous disease",
        "interstitial lung disease",
        "pleuritis",
        "pulmonary fibrosis",
        "sarcoidosis",
        "glioblastoma",
        "asthma diagnosed after service",
        "chronic sinusitis, or",
        "chronic rhinitis.",
      ),
    ],
  },
  "toxic-conditions-3.320a": {
    article: BPOT_ARTICLE,
    start: "VIII.ii.2.A.1.g.",
    end: "VIII.ii.2.A.1.h.",
    stopAt: TOPIC_TAIL,
    structure: [
      line("Effective January 2, 2025,"),
      ...items("urinary bladder cancer,", "ureter cancer,"),
    ],
  },
  "toxic-conditions-3.320b": {
    article: BPOT_ARTICLE,
    start: "VIII.ii.2.A.1.h.",
    end: " To Top",
    stopAt: TOPIC_TAIL,
    structure: [
      line("Effective January 10, 2025,"),
      ...items(
        "acute leukemias",
        "chronic leukemias",
        "multiple myelomas,",
        "myelodysplastic syndromes,",
        "myelofibrosis.",
      ),
    ],
  },
  "herbicide-service": {
    article: HERBICIDE_ARTICLE,
    start: "VIII.i.1.A.1.c.",
    end: "VIII.i.1.A.1.d.",
    stopAt: [" Notes:", ...TOPIC_TAIL],
    structure: [
      line("Currently, the Department of Veterans Affairs"),
      line("Presumptive exposure provision applies to"),
      block("Veterans who served"),
      item("in the Republic of Vietnam (RVN)"),
      item("a unit that, as determined"),
      item("individuals who performed service in the Air Force"),
      line("38 CFR 3.307(a)(6)"),
      block("Veterans who served aboard a vessel"),
      line("38 U.S.C. 1116A"),
      block("locations during specific time frames"),
      line("Veterans who performed covered service in/on"),
      ...items(
        "Thailand at any United States or Royal Thai base",
        "Laos December 1, 1965",
        "Cambodia at Mimot or Krek",
        "Guam or American Samoa",
        "Johnston Atoll or on a ship",
      ),
      line("38 U.S.C. 1116"),
    ],
  },
  "herbicide-conditions": {
    article: HERBICIDE_ARTICLE,
    start: "VIII.i.1.A.1.f.",
    end: "VIII.i.1.A.1.g.",
    stopAt: TOPIC_TAIL,
    structure: [
      line("The table below lists the disabilities"),
      line("Disability Authority"),
      firstItem("Chloracne or other acne-form disease"),
      ...items(
        "soft-tissue sarcoma, other than",
        "non-Hodgkin",
        "porphyria cutanea tarda",
        "Hodgkin",
        "respiratory cancers of the lung",
        "multiple myeloma",
        "prostate cancer",
        "acute and subacute peripheral neuropathy",
        "type 2 diabetes mellitus",
        "chronic lymphocytic leukemia",
        "AL amyloidosis",
        "ischemic heart disease",
        "chronic B-cell leukemia",
        "Parkinson",
        "early-onset peripheral neuropathy.",
      ),
      line("38 CFR 3.309(e)"),
      firstItem("parkinsonism"),
      ...items(
        "bladder cancer",
        "hypothyroidism",
        "monoclonal gammopathy of undetermined significance (MGUS)",
        "hypertension.",
      ),
      line("38 U.S.C. 1116"),
    ],
  },
  "herbicide-law-changes": {
    article: HERBICIDE_ARTICLE,
    start: "VIII.i.1.A.2.a.",
    end: "VIII.i.1.A.2.b.",
    stopAt: [" Important:", ...TOPIC_TAIL],
    structure: [
      line("Congress has enacted multiple"),
      line("The table below lists the legislative herbicide changes"),
      line("Law Impact Enactment Date"),
      ...items("PL 116-23,", "PL 116-283,", "PL 117-168,"),
    ],
  },
};
