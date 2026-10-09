/**
 * The app must not teach the model, or show the veteran, a 38 CFR section
 * that does not exist. Every citation to Parts 3, 4, 19 and 20 in the app's
 * own source (prompts, the regulations summary, UI copy and the data files
 * the UI prints) is checked against the bundled section list.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import {
  CFILE_ANALYSIS_SYSTEM_PROMPT,
  DECISION_DECODER_SYSTEM_PROMPT,
  KEY_REGULATIONS_SUMMARY,
  buildSystemPrompt,
} from "../../utils/aiSystemPrompts";
import { findUnverifiedCitations } from "../../utils/citationCheck";
import { extractCfrSections } from "../../utils/cfrCitations";
import sections from "../../data/cfrSections.json";
import reference from "../../data/verifiedReference.json";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// An unused scrape placeholder ("[Content would be scraped ...]") that writes
// diagnostic codes as section numbers. Nothing under src/ imports it.
const NOT_APP_TEXT = new Set(["services/vet_rate_knowledge.json"]);

const isAppSource = (path) =>
  /\.(?:js|jsx|json)$/.test(path) &&
  !/(?:^|\/)(?:__tests__|fixtures|generated)\//.test(path) &&
  !/\.test\.jsx?$/.test(path) &&
  !NOT_APP_TEXT.has(path);

function appSourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return appSourceFiles(full);
    const path = relative(SRC, full).split(sep).join("/");
    return isAppSource(path) ? [{ path, full }] : [];
  });
}

describe("38 CFR citations the app itself writes", () => {
  const files = appSourceFiles()
    .map((file) => ({ ...file, text: readFileSync(file.full, "utf8") }))
    .filter((file) => file.text.includes("CFR"));

  it("checks Parts 3, 4, 19 and 20 against the bundled list", () => {
    expect(Object.keys(sections.parts)).toEqual(["3", "4", "19", "20"]);
    expect(files.length).toBeGreaterThan(100);
    expect(
      files.flatMap((file) => extractCfrSections(file.text)).length,
    ).toBeGreaterThan(200);
  });

  it("none cites a section that is missing or reserved", () => {
    const missing = files.flatMap((file) =>
      [...new Set(findUnverifiedCitations(file.text))].map(
        (section) => `${file.path}: 38 CFR § ${section}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it("every prompt the default assembly can produce is clean", () => {
    const tasks = [
      "general",
      "cfile",
      "nexus",
      "statement",
      "decision",
      "buddy",
      "rating",
    ];
    for (const task of tasks) {
      expect(findUnverifiedCitations(buildSystemPrompt({ task }))).toEqual([]);
    }
  });
});

describe("the review options in the regulations summary", () => {
  it("cite § 3.2500, which the bundled verified text quotes, not the reserved § 19.5", () => {
    expect(KEY_REGULATIONS_SUMMARY).toContain(
      "- 38 CFR § 3.2500: Appeals under the Appeals Modernization Act (AMA)",
    );
    expect(KEY_REGULATIONS_SUMMARY).not.toContain("19.5");
    const quoted = reference.entries.find((e) => e.id === "cfr-3.2500-a");
    expect(quoted.citation).toBe("38 CFR § 3.2500(a)");
    expect(quoted.text).toContain("Reviews available");
  });
});

describe("the model is not asked to look for a missing bilateral factor", () => {
  it.each([
    ["C-File analysis", CFILE_ANALYSIS_SYSTEM_PROMPT],
    ["Decision Decoder", DECISION_DECODER_SYSTEM_PROMPT],
  ])("%s prompt", (_name, prompt) => {
    expect(prompt).not.toMatch(/missing bilateral factor/i);
    expect(prompt).toContain("pyramiding");
  });
});

describe("the evidence standard for reopening in the regulations summary", () => {
  const line = KEY_REGULATIONS_SUMMARY.split("\n").find((l) =>
    l.includes("§ 3.156"),
  );

  it("limits new and material evidence to legacy claims, as § 3.156(a) does", () => {
    expect(line).toBe(
      "- 38 CFR § 3.156: New and material evidence reopens only legacy claims decided before the § 19.2(a) effective date; since then a supplemental claim needs new and relevant evidence (38 CFR § 3.2501)",
    );
  });

  it("no line of the summary gives new and material evidence as the way to reopen a claim", () => {
    expect(KEY_REGULATIONS_SUMMARY).not.toContain(
      "New and material evidence to reopen claims",
    );
    const material = KEY_REGULATIONS_SUMMARY.split("\n").filter((l) =>
      /new and material/i.test(l),
    );
    expect(material).toEqual([line]);
    expect(KEY_REGULATIONS_SUMMARY).toContain(
      "- Supplemental Claim: New and relevant evidence",
    );
  });
});
