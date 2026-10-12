import "./probe.js";

const { model } = window.__survey;
const probe = window.__probe;
const post = window.__post;
const MAX_TOKENS = 128;
const TIMEOUT_MS = 300_000;

const step = async (stage, fn) => {
  try {
    await post({ stage, ...(await fn()) });
  } catch (err) {
    await post({
      stage: `${stage}-failed`,
      error: String(err?.stack ?? err).slice(0, 600),
    });
  }
};

await step("adapter", async () =>
  navigator.gpu
    ? { adapterReport: await probe.adapterReport() }
    : { adapterReport: null },
);
await step("detector", async () => ({ detector: await probe.detect() }));

if (model && navigator.gpu) {
  await step("cached", async () => ({
    cachedBefore: await probe.isCached(model),
  }));
  await step("load", async () => ({ load: await probe.load(model, 8192) }));
  await step("warmup", async () => ({
    warmup: await probe.generate("short", 8, TIMEOUT_MS),
  }));
  await step("short", async () => ({
    short: await probe.generate("short", MAX_TOKENS, TIMEOUT_MS),
  }));
  await step("long", async () => ({
    long: await probe.generate("long", MAX_TOKENS, TIMEOUT_MS, 70),
  }));
  await step("device-events", async () => ({
    deviceEvents: probe.getDeviceEvents(),
  }));
  await probe.unload().catch(() => {});
}
await post({ stage: "done" });
document.getElementById("status").textContent = "done";
