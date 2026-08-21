import { useState, useEffect } from "react";
import { detectDeviceCapabilities } from "../utils/deviceCapabilityDetector";
import {
  AI_WARMUP,
  AI_REQUIREMENTS,
  AI_CHUNK_RATE,
  estimateTotalTime,
} from "../data/aiPerformanceProfile";

/**
 * Strips ANGLE/driver wrapper from WebGPU adapter description strings.
 * "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 SUPER Direct3D11 ...)" → "NVIDIA GeForce RTX 4080 SUPER"
 */
function friendlyGpuName(desc) {
  if (!desc) return null;
  // Apple Silicon: bare "Apple M1" / "Apple M2 Pro" - no ANGLE wrapper
  if (/^Apple M\d/i.test(desc)) return desc.trim().slice(0, 50);
  // Windows/Linux: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 SUPER Direct3D11...)"
  const angleMatch = desc.match(
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- character classes ([^,]) and stop-alternatives don't overlap, so backtracking is bounded; rewriting risks mis-parsing real-world GPU description strings
    /ANGLE\s*\([^,]+,\s*([^,]+?)(?:\s+Direct3D|\s+Metal|\s+Vulkan|\s+vs_|\s*Direct|\s*,)/i,
  );
  if (angleMatch) return angleMatch[1].trim();
  return (
    desc
      // eslint-disable-next-line sonarjs/slow-regex -- \s and \S are disjoint character classes with no overlap, so this cannot backtrack catastrophically
      .replace(/\s*(Direct3D|Metal|Vulkan|OpenGL)\S*/gi, "")
      .trim()
      .slice(0, 50) || null
  );
}

/**
 * Inline system requirements and timing notice for any AI-powered tool.
 *
 * Props:
 *   compact    - single-line variant (default false = full card)
 *   fileSizeMB - if provided, shows a file-specific time estimate
 *   toolName   - short label shown in blocked states ("C-File Analyzer", etc.)
 */
export default function SystemRequirementsNotice({
  compact = false,
  fileSizeMB = null,
  toolName = "this tool",
  supportsExtractionOnly = true,
}) {
  const [profile, setProfile] = useState(null);
  const [showWhy, setShowWhy] = useState(false);
  const [showReqs, setShowReqs] = useState(false);

  useEffect(() => {
    detectDeviceCapabilities().then(setProfile);
  }, []);

  if (!profile) return null;

  const blocked = profile.isMobile || profile.isTablet || !profile.hasWebGPU;
  const limited = !blocked && profile.tier === "laptop";
  const noWebGpu = !profile.hasWebGPU && !profile.isMobile && !profile.isTablet;

  const gpuName = friendlyGpuName(profile.gpuDescription);
  const tierRate =
    AI_CHUNK_RATE[profile.isAppleSilicon ? "apple-silicon" : profile.tier] ??
    AI_CHUNK_RATE[profile.tier];
  const warmup = profile.isAppleSilicon
    ? AI_WARMUP.firstRunAppleSilicon
    : AI_WARMUP.firstRun;
  const timeEstimate = fileSizeMB
    ? estimateTotalTime(fileSizeMB, profile.tier)
    : null;

  // ── Compact single-line variant ──────────────────────────────────────────
  if (compact) {
    return (
      <CompactNotice
        profile={profile}
        noWebGpu={noWebGpu}
        limited={limited}
        gpuName={gpuName}
        warmup={warmup}
      />
    );
  }

  // ── Full card variant ────────────────────────────────────────────────────

  // Blocked: mobile / tablet / no WebGPU
  if (blocked) {
    return (
      <BlockedNotice
        profile={profile}
        toolName={toolName}
        supportsExtractionOnly={supportsExtractionOnly}
      />
    );
  }

  // Warning: laptop / integrated GPU
  if (limited) {
    return (
      <LimitedNotice
        gpuName={gpuName}
        tierRate={tierRate}
        timeEstimate={timeEstimate}
        warmup={warmup}
        showWhy={showWhy}
        setShowWhy={setShowWhy}
        showReqs={showReqs}
        setShowReqs={setShowReqs}
      />
    );
  }

  // Compatible: desktop-mid or desktop-high
  return (
    <CompatibleNotice
      profile={profile}
      gpuName={gpuName}
      warmup={warmup}
      timeEstimate={timeEstimate}
      showWhy={showWhy}
      setShowWhy={setShowWhy}
      showReqs={showReqs}
      setShowReqs={setShowReqs}
    />
  );
}

function CompactNotice({ profile, noWebGpu, limited, gpuName, warmup }) {
  if (profile.isMobile || profile.isTablet) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        <span aria-hidden="true">🚫</span>
        <span>
          On-device AI requires a desktop or laptop with a dedicated GPU. Phones
          and tablets are not supported.
        </span>
      </div>
    );
  }
  if (noWebGpu) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        <span aria-hidden="true">🚫</span>
        <span>
          WebGPU not available. Use Chrome 113+ or Edge 113+ for on-device AI.
        </span>
      </div>
    );
  }
  if (limited) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-300">
        <span aria-hidden="true">⚠</span>
        <span>
          Limited GPU capacity - processing uses CPU fallback (WASM). Large
          files will be slow.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-300">
      <span aria-hidden="true">✓</span>
      <span>
        {gpuName ? `Compatible - ${gpuName}` : "Compatible GPU detected"}
        {" · "}First run: {warmup.minMin}-{warmup.maxMin} min browser setup
      </span>
    </div>
  );
}

function BlockedNotice({ profile, toolName, supportsExtractionOnly }) {
  const reason =
    profile.isMobile || profile.isTablet
      ? "Phone and tablet detected - on-device AI requires a desktop or laptop computer with a dedicated GPU."
      : "Your browser does not expose a WebGPU adapter. On-device AI requires Chrome 113+ or Edge 113+.";

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5" aria-hidden="true">
          🚫
        </span>
        <div className="flex-1">
          <p className="font-semibold text-red-800 dark:text-red-200 text-sm">
            On-device AI not available on this device
          </p>
          <p className="text-red-700 dark:text-red-300 text-xs mt-1">
            {reason}
          </p>
          <p className="text-red-700 dark:text-red-300 text-xs mt-2">
            {supportsExtractionOnly ? (
              <>
                {toolName} still works in <strong>extraction-only mode</strong>{" "}
                (no AI, text and fields extracted directly from your PDF) or
                with a <strong>cloud API key</strong> (Gemini). Switch modes
                using the AI selector at the top of the page.
              </>
            ) : (
              <>
                {toolName} requires a loaded AI model to run. You can still use
                it with a <strong>cloud API key</strong> (Gemini) instead of
                on-device AI — switch modes using the AI selector at the top of
                the page.
              </>
            )}
          </p>
        </div>
      </div>
      <RequirementsList />
    </div>
  );
}

function LimitedNotice({
  gpuName,
  tierRate,
  timeEstimate,
  warmup,
  showWhy,
  setShowWhy,
  showReqs,
  setShowReqs,
}) {
  return (
    <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5" aria-hidden="true">
          ⚠
        </span>
        <div className="flex-1">
          <p className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm">
            Limited GPU - WASM fallback mode
            {gpuName && (
              <span className="font-normal ml-2 text-yellow-700 dark:text-yellow-400">
                ({gpuName})
              </span>
            )}
          </p>
          <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
            Your integrated or low-end GPU doesn't meet the 6 GB VRAM minimum
            for on-device inference. Processing will run on your CPU -
            significantly slower. Large C-Files (300 MB+) may take
            {tierRate
              ? ` ${Math.round(tierRate.p50 / 60)}-${Math.round(tierRate.p90 / 60)} min per section`
              : " many hours"}
            .
          </p>
          {timeEstimate && (
            <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1 font-medium">
              Estimated for this file: {timeEstimate}
            </p>
          )}
          <WarnKeepTabOpen />
        </div>
      </div>
      <ExpandSection
        label="Why does this take so long?"
        open={showWhy}
        onToggle={() => setShowWhy((v) => !v)}
      >
        <WhyExplanation warmup={warmup} />
      </ExpandSection>
      <ExpandSection
        label="Minimum requirements"
        open={showReqs}
        onToggle={() => setShowReqs((v) => !v)}
      >
        <RequirementsList />
      </ExpandSection>
    </div>
  );
}

function CompatibleNotice({
  profile,
  gpuName,
  warmup,
  timeEstimate,
  showWhy,
  setShowWhy,
  showReqs,
  setShowReqs,
}) {
  const isHigh = profile.tier === "desktop-high";
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5" aria-hidden="true">
          {isHigh ? "✅" : "✓"}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-green-800 dark:text-green-200 text-sm">
            Compatible{isHigh ? " - high-performance GPU" : " - mid-range GPU"}
            {gpuName && (
              <span className="font-normal ml-2 text-green-700 dark:text-green-400">
                ({gpuName})
              </span>
            )}
          </p>
          <p className="text-green-700 dark:text-green-300 text-xs mt-1">
            On-device AI is supported. No data leaves your device.
          </p>
          <p className="text-green-700 dark:text-green-300 text-xs mt-1">
            <strong>First run:</strong> allow {warmup.minMin}-{warmup.maxMin}{" "}
            minutes for one-time browser setup (compiling GPU programs +
            downloading the {AI_REQUIREMENTS.model.sizeGB} GB AI model).{" "}
            <strong>After that:</strong> {AI_WARMUP.subsequentRun.minMin}-
            {AI_WARMUP.subsequentRun.maxMin} min to start each session.
          </p>
          {timeEstimate && (
            <p className="text-green-700 dark:text-green-300 text-xs mt-1 font-medium">
              Estimated for this file: {timeEstimate}
            </p>
          )}
          <WarnKeepTabOpen />
        </div>
      </div>
      <ExpandSection
        label="Why does this take so long?"
        open={showWhy}
        onToggle={() => setShowWhy((v) => !v)}
      >
        <WhyExplanation />
      </ExpandSection>
      <ExpandSection
        label="Minimum requirements"
        open={showReqs}
        onToggle={() => setShowReqs((v) => !v)}
      >
        <RequirementsList />
      </ExpandSection>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ExpandSection({ label, open, onToggle, children }) {
  return (
    <div className="border-t border-current/10 pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
        aria-expanded={open}
      >
        <span
          className="transition-transform"
          style={{
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "none",
          }}
        >
          ▶
        </span>
        {label}
      </button>
      {open && (
        <div className="mt-2 text-xs space-y-1 opacity-80">{children}</div>
      )}
    </div>
  );
}

function WarnKeepTabOpen() {
  return (
    <p className="text-xs mt-2 opacity-70">
      Keep this browser tab open and active throughout processing - closing or
      minimizing may pause the GPU.
    </p>
  );
}

function WhyExplanation({ warmup }) {
  return (
    <div className="space-y-2">
      <p>
        WebLLM runs a {AI_REQUIREMENTS.model.sizeGB} GB AI model entirely inside
        your browser using your GPU - your documents never leave your device.
      </p>
      <p>
        <strong>
          First-run setup ({warmup.minMin}-{warmup.maxMin} min, one time only):
        </strong>{" "}
        {warmup.reason} After this, subsequent sessions skip compilation
        entirely.
      </p>
      <p>
        <strong>
          Per-session load ({AI_WARMUP.subsequentRun.minMin}-
          {AI_WARMUP.subsequentRun.maxMin} min):
        </strong>{" "}
        {AI_WARMUP.subsequentRun.reason}
      </p>
      <p>
        Large C-Files are split into sections (chunks) and analyzed one at a
        time. Each section takes{" "}
        {Math.round(AI_CHUNK_RATE["desktop-high"].p50 / 60)}-
        {Math.round(AI_CHUNK_RATE["desktop-high"].p90 / 60)} minutes on a
        high-end GPU. A 300 MB C-File has roughly 300 sections.
      </p>
    </div>
  );
}

function RequirementsList() {
  return (
    <ul className="space-y-1">
      <li>
        <strong>Device:</strong> {AI_REQUIREMENTS.formFactor}
      </li>
      <li>
        <strong>GPU:</strong> {AI_REQUIREMENTS.gpu.minDesc} (minimum 6 GB VRAM)
      </li>
      <li>
        <strong>Recommended GPU:</strong> {AI_REQUIREMENTS.gpu.recDesc}
      </li>
      <li>
        <strong>RAM:</strong> {AI_REQUIREMENTS.ram.recGB} GB recommended (
        {AI_REQUIREMENTS.ram.minGB} GB minimum)
      </li>
      <li>
        <strong>Browser:</strong> {AI_REQUIREMENTS.browser.join(" or ")}
      </li>
      <li>
        <strong>Note:</strong> {AI_REQUIREMENTS.browserNote}
      </li>
      <li>
        <strong>First-time download:</strong> {AI_REQUIREMENTS.model.sizeGB} GB
        - {AI_REQUIREMENTS.model.note}
      </li>
    </ul>
  );
}
