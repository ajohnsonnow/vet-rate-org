/**
 * Gathers every place the app already holds identifiers about the veteran, so
 * a model-written value can be compared against all of them (ADR-009 section
 * 3): the saved profile, the service history, the knowledge base's personal
 * block, and the structured data stored with every My Packet document.
 *
 * Each read is bounded and best-effort. A source that cannot be read within
 * the limit is skipped and the analysis continues with what could be read; the
 * type and shape checks on model output still apply either way.
 */
import { getVeteranProfile, getServiceHistory } from "./veteranProfile";
import { loadVKB } from "./veteranKnowledgeBase";
import { getAllExtractedData } from "./myPacketManager";

const SOURCE_READ_LIMIT_MS = 4000;

function withLimit(promise) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("identifier source read timed out")),
      SOURCE_READ_LIMIT_MS,
    );
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function readSource(read) {
  try {
    return await withLimit(Promise.resolve().then(read));
  } catch {
    return null;
  }
}

function packetSources(extracted) {
  if (!extracted || typeof extracted !== "object") return [];
  return Object.values(extracted)
    .filter(Array.isArray)
    .flat()
    .flatMap((entry) => [entry?.extractedData, entry?.aiAnalysis]);
}

export async function loadKnownIdentifierSources() {
  const [profile, history, vkb, packet] = await Promise.all([
    readSource(() => getVeteranProfile()),
    readSource(() => getServiceHistory()),
    readSource(() => loadVKB()),
    readSource(() => getAllExtractedData()),
  ]);
  return [
    profile,
    history,
    vkb?.personal,
    vkb?.serviceHistory,
    ...packetSources(packet),
  ].filter((source) => source && typeof source === "object");
}
