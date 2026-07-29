/**
 * Native web-vitals capture — no npm dependency.
 *
 * Uses PerformanceObserver to measure the Core Web Vitals
 * (LCP, CLS, INP, FCP, TTFB) and ships them to a sink:
 *   - console.table when VITE_WEB_VITALS_LOG === "true" or in dev
 *   - window.__VITALS__ array (so e2e/devtools can introspect)
 *   - dispatchEvent on window: CustomEvent("web-vital", { detail })
 *
 * Why native instead of the `web-vitals` package? The thresholds and
 * observers are stable browser APIs; we don't need 6KB of polyfills for
 * legacy engines. If we ever need attribution data we can revisit.
 */

const VITALS = {};
const buffer = [];
if (typeof window !== "undefined") {
  window.__VITALS__ = buffer;
}

function emit(name, value, rating) {
  const entry = {
    name,
    value: Math.round(value * 1000) / 1000,
    rating,
    ts: Date.now(),
  };
  VITALS[name] = entry;
  buffer.push(entry);
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent("web-vital", { detail: entry }));
  }
  if (
    typeof console !== "undefined" &&
    (import.meta.env.DEV || import.meta.env.VITE_WEB_VITALS_LOG === "true")
  ) {
    const RATING_COLORS = {
      good: "color:green",
      "needs-improvement": "color:orange",
    };
    const color = RATING_COLORS[rating] || "color:red";
    // eslint-disable-next-line no-console
    console.log(`%c[web-vital] ${name} = ${entry.value} (${rating})`, color);
  }
}

function rate(name, value) {
  // Thresholds from web.dev/vitals (2024-Q4 baselines).
  const t = {
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  }[name];
  if (!t) return "unknown";
  if (value <= t[0]) return "good";
  if (value <= t[1]) return "needs-improvement";
  return "poor";
}

function observeLCP() {
  let last = 0;
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      last = entries[entries.length - 1].startTime;
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
    const finalize = () => {
      if (last > 0) emit("LCP", last, rate("LCP", last));
      po.disconnect();
    };
    addEventListener("visibilitychange", finalize, { once: true });
    addEventListener("pagehide", finalize, { once: true });
  } catch {
    /* observer unsupported — skip */
  }
}

function observeCLS() {
  let cls = 0;
  let sessionValue = 0;
  let sessionEntries = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const first = sessionEntries[0];
        const last = sessionEntries[sessionEntries.length - 1];
        if (
          sessionEntries.length &&
          (entry.startTime - last.startTime > 1000 ||
            entry.startTime - first.startTime > 5000)
        ) {
          sessionValue = 0;
          sessionEntries = [];
        }
        sessionValue += entry.value;
        sessionEntries.push(entry);
        if (sessionValue > cls) cls = sessionValue;
      }
    });
    po.observe({ type: "layout-shift", buffered: true });
    const finalize = () => {
      emit("CLS", cls, rate("CLS", cls));
      po.disconnect();
    };
    addEventListener("visibilitychange", finalize, { once: true });
    addEventListener("pagehide", finalize, { once: true });
  } catch {
    /* observer unsupported — skip */
  }
}

function observeINP() {
  let worst = 0;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > worst) worst = entry.duration;
      }
    });
    po.observe({ type: "event", buffered: true, durationThreshold: 16 });
    const finalize = () => {
      if (worst > 0) emit("INP", worst, rate("INP", worst));
      po.disconnect();
    };
    addEventListener("visibilitychange", finalize, { once: true });
    addEventListener("pagehide", finalize, { once: true });
  } catch {
    /* event timing unsupported — skip */
  }
}

function observeFCP() {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          emit("FCP", entry.startTime, rate("FCP", entry.startTime));
          po.disconnect();
        }
      }
    });
    po.observe({ type: "paint", buffered: true });
  } catch {
    /* paint observer unsupported — skip */
  }
}

function reportTTFB() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      const ttfb = nav.responseStart;
      emit("TTFB", ttfb, rate("TTFB", ttfb));
    }
  } catch {
    /* navigation timing unsupported — skip */
  }
}

export function initWebVitals() {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined"
  )
    return;
  observeLCP();
  observeCLS();
  observeINP();
  observeFCP();
  reportTTFB();
}

export function getVitals() {
  return { ...VITALS };
}
