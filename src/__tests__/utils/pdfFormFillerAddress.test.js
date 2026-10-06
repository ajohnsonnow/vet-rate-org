/**
 * Answers the official forms take in a different shape from the one the
 * wizard collects: a mailing address typed as one answer, an apartment
 * typed with its word, and answers that are not a whole Social Security
 * number, date or ZIP code. The wizard's answer wins over the saved
 * profile, a whole address is written or none of it, and whatever the app
 * leaves blank is reported by name, never by value. Read back from a
 * stand-in built from the real forms' field lists. All values are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  _lastFillReport,
  fillForm21_0966,
  fillForm21_4138,
  fillForm21_4142,
} from "../../utils/pdfFormFiller";
import {
  fillSyntheticForm,
  itemNumberOf,
  realFields,
} from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ADDRESS_BOXES = ["street", "apt", "city", "state", "zip5", "zip4"];
const address = (form) => ADDRESS_BOXES.map((key) => form.text(key));
const PROFILE = {
  street: "42 Imaginary Lane",
  apt: "Apt 4B",
  city: "Elsewhere",
  state: "MO",
  zip: "64000",
};
const ONE_ANSWER_FORMS = [
  ["21-0966", fillForm21_0966],
  ["21-4142", fillForm21_4142],
];

describe.each(ONE_ANSWER_FORMS)(
  "%s mailing address, asked as one answer",
  (formNumber, fill) => {
    it.each([
      [
        "12 Example Street\nSampleton, KS 66000",
        ["12 Example Street", "", "Sampleton", "KS", "66000", ""],
      ],
      [
        "12 Example Street, Sampleton, KS 66000",
        ["12 Example Street", "", "Sampleton", "KS", "66000", ""],
      ],
      [
        "12 Example Street, Apt 4B, Sampleton, ks 66000-1234",
        ["12 Example Street", "4B", "Sampleton", "KS", "66000", "1234"],
      ],
      [
        "12 Example Street\nUnit 7\nSan Sample KS 66000",
        ["12 Example Street", "7", "San Sample", "KS", "66000", ""],
      ],
    ])("writes %j into the boxes", async (typed, boxes) => {
      const form = await fillSyntheticForm(formNumber, fill, {
        address: typed,
      });

      expect(address(form)).toEqual(boxes);
      expect(_lastFillReport().notPlaced).toEqual([]);
    });

    it("uses the wizard's answer, not the saved profile's address", async () => {
      const form = await fillSyntheticForm(formNumber, fill, {
        ...PROFILE,
        address: "12 Example Street\nSampleton, KS 66000",
      });

      expect(address(form)).toEqual([
        "12 Example Street",
        "",
        "Sampleton",
        "KS",
        "66000",
        "",
      ]);
      expect(form.allText()).not.toMatch(/Imaginary|Elsewhere|64000/);
    });

    it.each([
      "12 Example Street Sampleton KS 66000",
      "12 Example Street, Sampleton, Kansas 66000",
      "12 Example Street, Sampleton, KS",
      "12 Example Street, Floor 2, Suite 9, Sampleton, KS 66000",
      "Sampleton, KS 66000",
    ])(
      "leaves the boxes blank and names the answer when %j cannot be split, with or without a profile",
      async (typed) => {
        for (const profile of [{}, PROFILE]) {
          const form = await fillSyntheticForm(formNumber, fill, {
            ...profile,
            address: typed,
          });

          expect(address(form)).toEqual(["", "", "", "", "", ""]);
          expect(_lastFillReport().notPlaced).toEqual(["Mailing address"]);
        }
      },
    );
  },
);

describe.each(ONE_ANSWER_FORMS)(
  "%s mailing address, whole or not at all",
  (formNumber, fill) => {
    it("uses the profile's address, whole, when the wizard gave none", async () => {
      const form = await fillSyntheticForm(formNumber, fill, PROFILE);

      expect(address(form)).toEqual([
        "42 Imaginary Lane",
        "4B",
        "Elsewhere",
        "MO",
        "64000",
        "",
      ]);
      expect(_lastFillReport().notPlaced).toEqual([]);
    });

    it("writes none of an address when one part does not fit its box", async () => {
      const form = await fillSyntheticForm(formNumber, fill, {
        address:
          "12 Example Street With A Very Long Name Indeed\nSampleton, KS 66000",
      });

      expect(address(form)).toEqual(["", "", "", "", "", ""]);
      expect(_lastFillReport().notPlaced).toEqual(["Mailing address"]);
    });

    it("says nothing about an address nobody gave", async () => {
      const form = await fillSyntheticForm(formNumber, fill, {
        veteranName: "Marlow Testwright",
      });

      expect(address(form)).toEqual(["", "", "", "", "", ""]);
      expect(_lastFillReport().notPlaced).toEqual([]);
    });
  },
);

describe("21-4142 telephone", () => {
  it("goes in item 7, the veteran's telephone number", async () => {
    const form = await fillSyntheticForm("21-4142", fillForm21_4142, {
      phone: "555-010-0200",
    });
    const real = realFields("21-4142");
    const items = Object.entries(form.filledByName()).map(([name, value]) => [
      itemNumberOf(real.get(name)),
      value,
    ]);

    expect(items).toEqual([
      [7, "555"],
      [7, "010"],
      [7, "0200"],
    ]);
  });
});

describe("the apartment box", () => {
  it.each([
    ["Apt 4B", "4B"],
    ["apt. 12", "12"],
    ["Unit 7", "7"],
    ["#3C", "3C"],
    ["Apt #9", "9"],
    ["4B", "4B"],
    ["Upper", "Upper"],
  ])("takes %s as %s", async (apt, written) => {
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, { apt });

    expect(form.text("apt")).toBe(written);
    expect(_lastFillReport().leftBlank).toEqual([]);
  });

  it("still reports one that is too long without its word", async () => {
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, {
      apt: "Apt 1204-B",
    });

    expect(form.text("apt")).toBe("");
    expect(_lastFillReport().leftBlank).toEqual(["1204-B"]);
  });
});

describe("answers that are not what the boxes take", () => {
  const filled = (data) => fillSyntheticForm("21-4138", fillForm21_4138, data);

  it.each(["12", "12345", "abcd"])(
    "leaves the Social Security boxes blank for %s and names them",
    async (ssn) => {
      const form = await filled({ ssn });

      expect(["ssn1", "ssn2", "ssn3"].map(form.text)).toEqual(["", "", ""]);
      expect(_lastFillReport().notPlaced).toEqual(["Social Security number"]);
    },
  );

  it.each(["13/45", "13/45/2015", "June 2015", "2015-02-40"])(
    "leaves the date boxes blank for %s and names them",
    async (dob) => {
      const form = await filled({ dob });

      expect(["dobMonth", "dobDay", "dobYear"].map(form.text)).toEqual([
        "",
        "",
        "",
      ]);
      expect(_lastFillReport().notPlaced).toEqual(["Date of birth"]);
    },
  );

  it.each(["9", "1234", "123456"])(
    "does not print ZIP %s, and names it",
    async (zip) => {
      const form = await filled({ zip });

      expect(["zip5", "zip4"].map(form.text)).toEqual(["", ""]);
      expect(_lastFillReport().notPlaced).toEqual(["ZIP code"]);
    },
  );

  it("prints a five-digit or nine-digit ZIP", async () => {
    expect((await filled({ zip: "66000" })).text("zip5")).toBe("66000");
    const nine = await filled({ zip: "66000-1234" });
    expect(["zip5", "zip4"].map(nine.text)).toEqual(["66000", "1234"]);
    expect(_lastFillReport().notPlaced).toEqual([]);
  });

  it("writes a VA file number as typed", async () => {
    const form = await filled({ vaFileNumber: "12" });

    expect(form.text("vaFileNumber")).toBe("12");
    expect(_lastFillReport().notPlaced).toEqual([]);
  });

  it("names what it left blank, never the value typed", async () => {
    await filled({ ssn: "12", dob: "13/45", zip: "9" });

    expect(_lastFillReport().notPlaced).toEqual([
      "Social Security number",
      "Date of birth",
      "ZIP code",
    ]);
  });

  it("reports nothing for answers nobody gave", async () => {
    await filled({ veteranName: "Marlow Testwright" });

    expect(_lastFillReport().notPlaced).toEqual([]);
  });
});
