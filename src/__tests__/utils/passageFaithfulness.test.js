/**
 * The strict rules a rewording of a veteran's own passage has to meet. One
 * rule per group, each with the real example that showed the need for it
 * where there is one. When in doubt the rule rejects and the typed words
 * stand.
 */
import { describe, it, expect } from "vitest";
import { faithfulnessProblems } from "../../utils/passageFaithfulness";

const problems = (original, rewrite) =>
  faithfulnessProblems(original, rewrite).join("; ");
describe("every main word of the passage survives", () => {
  it("rejects a dropped verb: the waking in 'Nightmares wake me'", () => {
    expect(
      problems(
        "Nightmares wake me and I stop breathing in my sleep more often on those nights",
        "I have nightmares and I stop breathing in my sleep more often on those nights.",
      ),
    ).toMatch(/drops "wake"/);
  });

  it("rejects a dropped short word that carries meaning", () => {
    expect(
      problems("Lights off at the desk", "I keep the lights at the desk."),
    ).toMatch(/drops "off"/);
    expect(problems("I can not lift my arm", "I can lift my arm.")).toMatch(
      /drops "not"/,
    );
    expect(problems("I can't lift my arm", "I can lift my arm.")).toMatch(
      /drops "not"/,
    );
  });

  it("lets a word change its ending", () => {
    expect(
      problems(
        "Numb fingers, dropping tools, trouble with buttons",
        "I have numb fingers, drop tools, and have trouble with buttons.",
      ),
    ).toBe("");
  });
});

describe("no main word is added", () => {
  it.each([
    [
      "shoulder gave out lifting a crate",
      "My shoulder gave out when I tried to lift a crate.",
      /adds "when", "tried"/,
    ],
    [
      "neck locked for three days",
      "My neck remained locked for three days.",
      /adds "remained"/,
    ],
    [
      "Lights off at the desk, sunglasses indoors",
      "I turned off the lights at the desk and wore sunglasses indoors.",
      /adds "turned", "wore"/,
    ],
    ["I lift my arm", "I can not lift my arm.", /adds "can", "not"/],
    [
      "I miss two shifts a month",
      "To put it plainly, I miss two shifts a month.",
      /adds "put", "plainly"/,
    ],
  ])("rejects %s -> %s", (original, rewrite, reason) => {
    expect(problems(original, rewrite)).toMatch(reason);
  });

  it("lets joining words in: a subject, 'and', 'while', an article", () => {
    expect(
      problems(
        "14 June 2019 - shoulder gave out lifting a crate, neck locked for three days",
        "On 14 June 2019, my shoulder gave out while lifting a crate, and my neck locked for three days.",
      ),
    ).toBe("");
    expect(
      problems(
        "Startle at engine noise, Broken sleep",
        "I startle at engine noise and I have broken sleep.",
      ),
    ).toBe("");
  });
});

describe("cause and contrast words are kept, and none is added", () => {
  const original = "Favouring the bad shoulder, so the neck takes the strain";

  it("rejects 'so' turned into 'and'", () => {
    expect(
      problems(
        original,
        "I am favouring the bad shoulder, and the neck takes the strain.",
      ),
    ).toMatch(/loses "so"/);
  });

  it.each(["because", "but", "after", "until", "before", "since", "although"])(
    "rejects a passage's '%s' that is gone",
    (word) => {
      expect(
        problems(
          `I stopped driving ${word} the pain in my neck`,
          "I stopped driving and have pain in my neck.",
        ),
      ).toMatch(new RegExp(`loses "${word}"`));
    },
  );

  it("rejects a cause the passage did not state", () => {
    expect(
      problems(
        "I stopped driving, pain in my neck",
        "I stopped driving because of pain in my neck.",
      ),
    ).toMatch(/adds "because"/);
  });

  it("keeps 'so' when it is kept", () => {
    expect(
      problems(
        original,
        "I am favouring the bad shoulder, so the neck takes the strain.",
      ),
    ).toBe("");
  });
});

describe("tense does not move", () => {
  it.each([
    [
      "Slower on the assembly line at the Placeholder plant",
      "I was slower on the assembly line at the Placeholder plant.",
    ],
    [
      "Numb fingers, dropping tools, trouble with buttons",
      "My fingers were numb, I dropped tools, and I had trouble with buttons.",
    ],
    [
      "Fewer shifts and no overtime",
      "I have had fewer shifts and no overtime.",
    ],
    ["I drop tools every day", "I dropped tools every day."],
  ])(
    "rejects the present, or no tense, moved to the past: %s",
    (original, rewrite) => {
      expect(problems(original, rewrite)).toMatch(/moves .* to the past/);
    },
  );

  it.each([
    ["I fell from the cargo ramp", "I have fallen from the cargo ramp."],
    ["My neck locked for three days", "My neck is locked for three days."],
  ])("rejects the past moved to the present: %s", (original, rewrite) => {
    expect(problems(original, rewrite)).toMatch(/moves .* to the present|adds/);
  });

  it("rejects a past form made present", () => {
    expect(problems("I dropped the crate", "I drop the crate.")).toMatch(
      /changes the form of "dropped"/,
    );
  });

  it("lets a fragment with no tense take the present", () => {
    expect(
      problems(
        "Slower on the assembly line at the Placeholder plant",
        "I am slower on the assembly line at the Placeholder plant.",
      ),
    ).toBe("");
  });

  it("lets a past passage stay past", () => {
    expect(
      problems(
        "fell from the cargo ramp, hurt my back",
        "I fell from the cargo ramp and hurt my back.",
      ),
    ).toBe("");
  });
});

describe("a word does not change its part", () => {
  it("rejects a verb made into a noun", () => {
    expect(
      problems("dropping tools at work", "My dropping of tools is at work."),
    ).toMatch(/turns "dropping" into a noun/);
  });

  it("rejects 'neck locked' made into 'a neck lock'", () => {
    expect(
      problems(
        "neck locked for three days",
        "I had a neck lock for three days.",
      ),
    ).toMatch(/changes the form of "locked"/);
  });
});

describe("the subject is not moved onto the writer", () => {
  it("rejects 'I' as subject where the passage had only 'me'", () => {
    expect(
      problems(
        "left the line mid-shift, sick in the car park, driven home by me",
        "I left the line mid-shift, was sick in the car park, and was driven home by me.",
      ),
    ).toMatch(/makes "I" the subject/);
  });

  it("lets 'I' stay where the passage already had it", () => {
    expect(
      problems(
        "I miss two shifts a month, my back",
        "My back, and I miss two shifts a month.",
      ),
    ).toBe("");
  });
});
