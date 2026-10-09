import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import AppModals from "./AppModals";
import AppProviders from "../providers/AppProviders";
import { ThemeProvider } from "../../contexts/ThemeContext";
import { VaAuthProvider } from "../../contexts/VaAuthContext";
import { readVeteranProfileQuiet } from "../../utils/veteranProfile";
import { TOOL_EVENT_MAP } from "../../utils/dispatchToolById";
import { TOOLS as MATRIX_TOOLS } from "../../../tests/e2e/tool-launch-matrix.data";

globalThis.DOMMatrix ??= class DOMMatrix {};

const PROFILE_KEY = "vet_rate_veteran_profile";
// The one line the app writes by design when the profile is unreadable (it
// carries a neutral code, never stored text), plus the two lines jsdom causes
// for every tool that touches IndexedDB or fetch, which jsdom does not provide,
// plus the service-history reader's own report of a wrong-type value.
const EXPECTED_CONSOLE =
  /^(The saved profile could not be read \(PROFILE_[A-Z_]+\)\.|Error opening VKB database:|Error reading service history:|Error loading publications:|Storage getItem error:|Error getting cache stats:|Failed to get all packet documents:)$/;

// pdf.js warns once, on its first import under Node.
const EXPECTED_WARN =
  /^Warning: Please use the `legacy` build in Node\.js environments\.$/;

const seed = (key, value) => () => {
  localStorage.setItem(key, value);
  return { key, value };
};

// Each arrange function may return the stored { key, value } it seeded, which
// must still be byte-for-byte the same after the tool opened.
const SCENARIOS = [
  [
    "the profile read throws",
    () => {
      const real = localStorage.getItem.bind(localStorage);
      vi.spyOn(localStorage, "getItem").mockImplementation((k) => {
        if (k === PROFILE_KEY) throw new Error("storage blocked");
        return real(k);
      });
    },
  ],
  ["the profile is invalid JSON", seed(PROFILE_KEY, "{not json")],
  ["the profile is the wrong type", seed(PROFILE_KEY, "[1,2]")],
  ["the saved ratings are the wrong type", seed("vet_rate_my_ratings", "{}")],
  ["the saved claims are the wrong type", seed("vet_rate_saved_claims", "{}")],
  [
    "the service history is the wrong type",
    seed("vet_rate_service_history", '[{"id":"p1","branch":"Army"}]'),
  ],
];

// The 48 user-facing tools named in the e2e launch matrix plus every event the
// workflow dispatcher knows, so neither list can leave a tool unopened here.
const TOOL_EVENTS = [
  ...new Set([
    ...Object.values(TOOL_EVENT_MAP),
    ...MATRIX_TOOLS.map((t) => t.event),
  ]),
].map((eventName) => [eventName]);
const PROPS = {
  getAppState: () => ({}),
  updateBanner: null,
  whatsNewModal: null,
};

let errorSpy;
let warnSpy;

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  localStorage.clear();
  sessionStorage.clear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.classList.remove("modal-open");
});

describe.each(SCENARIOS)("with %s", (label, arrange) => {
  it.each(TOOL_EVENTS)(
    "event %s opens its dialog and nothing but the known notice reaches the console",
    async (eventName) => {
      const seeded = arrange();
      if (label.startsWith("the profile")) {
        expect(readVeteranProfileQuiet().status).toBe("unreadable");
      }
      render(
        <ThemeProvider>
          <AppProviders>
            <VaAuthProvider>
              <AppModals {...PROPS} />
            </VaAuthProvider>
          </AppProviders>
        </ThemeProvider>,
      );
      await act(async () => {
        window.dispatchEvent(new CustomEvent(eventName));
      });
      const dialogs = await screen.findAllByRole(
        "dialog",
        {},
        { timeout: 8000 },
      );
      expect(dialogs).not.toHaveLength(0);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      if (seeded) expect(localStorage.getItem(seeded.key)).toBe(seeded.value);
      expect(screen.queryByTestId("error-boundary-fallback")).toBeNull();
      const unexpected = errorSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => !EXPECTED_CONSOLE.test(m));
      expect(unexpected).toEqual([]);
      const unexpectedWarn = warnSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => !EXPECTED_WARN.test(m));
      expect(unexpectedWarn).toEqual([]);
    },
    20000,
  );
});
