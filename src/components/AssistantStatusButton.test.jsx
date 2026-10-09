import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const ai = vi.hoisted(() => ({ status: null, list: [] }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => ai.status,
}));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => ({ recommendedModels: ai.list }),
}));

import AssistantStatusButton from "./AssistantStatusButton";
import { APP_TRANSLATIONS } from "../i18n/translations";

const swarm = (model) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
  localModelName: "Local AI",
});
const NONE = { effectiveMode: null, swarmStatus: { model: null } };
const CLOUD = { effectiveMode: "cloud", cloudAvailable: true, swarmStatus: {} };

beforeEach(() => {
  ai.list = ["Qwen3.5-4B-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"];
});

const JARGON = /Warrant|DKB|100%|Wllama|llama\.cpp|💎|🔒|☁/;

describe.each([
  ["no AI", NONE, "No AI set up", "AI status: no AI set up. Open AI settings."],
  [
    "the 4B loaded",
    swarm("Qwen3.5-4B-q4f16_1-MLC"),
    "On-device AI",
    "AI status: on-device model Qwen 3.5 4B loaded. Open AI settings.",
  ],
  ["cloud AI", CLOUD, "Cloud AI", "AI status: cloud AI. Open AI settings."],
])("%s", (_n, status, label, name) => {
  it("shows the label and a plain accessible name", () => {
    ai.status = status;
    render(<AssistantStatusButton onClick={() => {}} />);
    const button = screen.getByRole("button", { name });
    expect(button.textContent).toBe(label);
    expect(button.getAttribute("aria-label")).not.toMatch(JARGON);
    expect(button.textContent).not.toMatch(JARGON);
  });
});

describe("limited models", () => {
  it("a small-class model reads On-device AI (limited)", () => {
    ai.status = swarm("Qwen3.5-2B-q4f16_1-MLC");
    render(<AssistantStatusButton onClick={() => {}} />);
    const button = screen.getByRole("button", {
      name: /on-device model Qwen 3\.5 2B loaded/,
    });
    expect(button.textContent).toBe("On-device AI (limited)");
  });

  it("a fallback to the Qwen2.5-3B reads limited and names the loaded model", () => {
    ai.status = swarm("Qwen2.5-3B-Instruct-q4f16_1-MLC");
    render(<AssistantStatusButton onClick={() => {}} />);
    const button = screen.getByRole("button", { name: /Qwen 2\.5 3B loaded/ });
    expect(button.textContent).toBe("On-device AI (limited)");
  });

  it("a fallback to a model that is not small-class still reads limited", () => {
    ai.list = ["Qwen3.5-4B-q4f16_1-MLC", "Llama-3.2-3B-Instruct-q4f32_1-MLC"];
    ai.status = swarm("Llama-3.2-3B-Instruct-q4f32_1-MLC");
    render(<AssistantStatusButton onClick={() => {}} />);
    expect(screen.getByRole("button").textContent).toBe(
      "On-device AI (limited)",
    );
  });
});

describe("other on-device engines and warm-up", () => {
  it("a Wllama engine is on-device AI without its internal name", () => {
    ai.status = {
      effectiveMode: "wllama",
      swarmStatus: {},
      localModelName: "Local AI",
    };
    render(<AssistantStatusButton onClick={() => {}} />);
    expect(screen.getByRole("button").textContent).toBe("On-device AI");
    expect(screen.getByRole("button").getAttribute("aria-label")).not.toMatch(
      JARGON,
    );
  });

  it("while loading it says the AI is starting", () => {
    ai.status = { ...NONE, localInitializing: true };
    render(<AssistantStatusButton onClick={() => {}} />);
    expect(screen.getByRole("button").textContent).toBe("Starting AI");
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "AI status: starting. Open AI settings.",
    );
  });
});

describe("the button", () => {
  it("is one 44px-tall button that opens the settings", () => {
    ai.status = NONE;
    const onClick = vi.fn();
    render(<AssistantStatusButton onClick={onClick} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].className).toMatch(/min-h-\[44px\]/);
    expect(buttons[0].querySelector("svg")).toBeTruthy();
    fireEvent.click(buttons[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a bare dot or empty box out of it: the label is visible text", () => {
    ai.status = NONE;
    render(<AssistantStatusButton onClick={() => {}} />);
    expect(screen.getByRole("button").className).not.toMatch(/nth-child/);
    expect(screen.getByText("No AI set up")).toBeTruthy();
  });
});

describe("translations", () => {
  it("every key has English, and a non-empty string in each shipped locale", () => {
    const section = APP_TRANSLATIONS.assistantStatus;
    expect(Object.keys(section).sort()).toEqual(
      [
        "labelCloud",
        "labelNone",
        "labelOnDevice",
        "labelOnDeviceLimited",
        "labelStarting",
        "nameCloud",
        "nameNone",
        "nameOnDevice",
        "nameOnDeviceLimited",
        "nameStarting",
      ].sort(),
    );
    for (const leaf of Object.values(section)) {
      for (const lang of ["en", "es", "tl", "vi", "ko"]) {
        expect(leaf[lang]?.trim().length).toBeGreaterThan(3);
      }
    }
    expect(section.nameOnDevice.en).toContain("{model}");
    for (const lang of ["es", "tl", "vi", "ko"]) {
      expect(section.nameOnDevice[lang]).toContain("{model}");
      expect(section.nameOnDeviceLimited[lang]).toContain("{model}");
    }
  });
});

describe("the label's contrast over the header gradient", () => {
  // The header runs from-blue-600 to-purple-600 (Tailwind 3 palette).
  const ENDS = { blue: [37, 99, 235], purple: [147, 51, 234] };
  const WHITE = [255, 255, 255];
  const lum = (rgb) => {
    const [r, g, b] = rgb
      .map((v) => v / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (top, alpha, under) =>
    top.map((v, i) => v * alpha + under[i] * (1 - alpha));
  const layer = (className, prefix) => {
    const match = new RegExp(String.raw`${prefix}-(black|white)/(\d+)`).exec(
      className,
    );
    return match
      ? {
          rgb: match[1] === "black" ? [0, 0, 0] : WHITE,
          alpha: Number(match[2]) / 100,
        }
      : null;
  };

  it.each([
    ["no AI", NONE],
    ["on-device", swarm("Qwen3.5-4B-q4f16_1-MLC")],
    ["limited", swarm("Qwen3.5-2B-q4f16_1-MLC")],
    ["cloud", CLOUD],
  ])("%s: white text is at least 4.5:1 at both gradient ends", (_n, status) => {
    ai.status = status;
    render(<AssistantStatusButton onClick={() => {}} />);
    const { className } = screen.getByRole("button");
    expect(className).toMatch(/\btext-white\b/);
    const backing = layer(className, "bg");
    for (const [end, rgb] of Object.entries(ENDS)) {
      const behind = backing ? over(backing.rgb, backing.alpha, rgb) : rgb;
      expect(ratio(WHITE, behind), `${end} end`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a visible border: at least 3:1 against its own backing at both ends", () => {
    ai.status = NONE;
    render(<AssistantStatusButton onClick={() => {}} />);
    const { className } = screen.getByRole("button");
    const border = layer(className, "border");
    const backing = layer(className, "bg");
    expect(border).toBeTruthy();
    for (const rgb of Object.values(ENDS)) {
      const behind = backing ? over(backing.rgb, backing.alpha, rgb) : rgb;
      expect(
        ratio(over(border.rgb, border.alpha, behind), behind),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
