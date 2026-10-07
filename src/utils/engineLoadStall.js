// The WebLLM library reports download progress once per finished weight shard
// (no byte-level progress), several shards at a time, so "no progress" means
// "no whole shard finished". The window is sized for a slow connection and
// grows after each stall: shards that did finish are cached, so a retry only
// needs the rest, but a single shard may still need longer than the last try.
export const ENGINE_LOAD_STALL_MS = 600_000;
const MAX_WINDOW_DOUBLINGS = 2;

let stallsSinceLastSuccess = 0;

export function currentEngineLoadStallMs() {
  return (
    ENGINE_LOAD_STALL_MS *
    2 ** Math.min(stallsSinceLastSuccess, MAX_WINDOW_DOUBLINGS)
  );
}

export function resetEngineLoadStallBudget() {
  stallsSinceLastSuccess = 0;
}

export class EngineLoadStalledError extends Error {
  constructor(stallMs = ENGINE_LOAD_STALL_MS) {
    const minutes = Math.max(1, Math.round(stallMs / 60_000));
    super(
      `Loading the on-device AI stopped making progress for ${minutes} minute(s). ` +
        "Check your connection, then try again. Parts already downloaded are " +
        "kept, and the next try waits longer before giving up.",
    );
    this.name = "EngineLoadStalledError";
  }
}

// Runs startLoad(noteProgress) and rejects, after calling onStall, when
// noteProgress sees nothing new for the current window. Every change re-arms
// the timer; there is no total cap.
export function loadWithStallWatchdog(startLoad, onStall) {
  const stallMs = currentEngineLoadStallMs();
  return new Promise((resolve, reject) => {
    let timer = null;
    let lastSeen = null;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stallsSinceLastSuccess += 1;
        onStall();
        reject(new EngineLoadStalledError(stallMs));
      }, stallMs);
    };
    const noteProgress = (report) => {
      const seen = `${report?.progress}|${report?.text}`;
      if (seen === lastSeen) return;
      lastSeen = seen;
      arm();
    };
    arm();
    startLoad(noteProgress).then(
      (value) => {
        clearTimeout(timer);
        resetEngineLoadStallBudget();
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
