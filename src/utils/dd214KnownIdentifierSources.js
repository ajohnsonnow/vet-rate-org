/**
 * Gathers every place the app already holds identifiers about the veteran, so
 * a model-written value can be compared against all of them (ADR-009 section
 * 3): the saved profile, the service history, the knowledge base's personal
 * block, and the structured data stored with every My Packet document.
 *
 * Each read is bounded. A source that cannot be read within the limit, or
 * whose read fails, makes the set incomplete: the caller then fails closed and
 * drops every date and all free text the model wrote for that reading, because
 * a birth date or a name the app holds cannot be checked for.
 */
import { getVeteranProfile, getServiceHistory } from "./veteranProfile";
import { loadVKB } from "./veteranKnowledgeBase";
import { getAllExtractedData } from "./myPacketManager";

const SOURCE_READ_LIMIT_MS = 4000;

// The readers otherwise swallow their own errors and return an empty value,
// which would read here as "nothing known" instead of "could not read".
const STRICT = { strict: true };

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
    return { ok: true, value: await withLimit(Promise.resolve().then(read)) };
  } catch {
    return { ok: false, value: null };
  }
}

function packetSources(extracted) {
  if (!extracted || typeof extracted !== "object") return [];
  return Object.values(extracted)
    .filter(Array.isArray)
    .flat()
    .flatMap((entry) => [entry?.extractedData, entry?.aiAnalysis]);
}

/**
 * `{ sources, complete }`: `complete` is false when any of the four reads
 * rejected or timed out.
 */
export async function loadKnownIdentifierSourcesChecked() {
  const reads = await Promise.all([
    readSource(() => getVeteranProfile(STRICT)),
    readSource(() => getServiceHistory(STRICT)),
    readSource(() => loadVKB(STRICT)),
    readSource(() => getAllExtractedData(STRICT)),
  ]);
  const [profile, history, vkb, packet] = reads.map((read) => read.value);
  const sources = [
    profile,
    history,
    vkb?.personal,
    vkb?.serviceHistory,
    ...packetSources(packet),
  ].filter((source) => source && typeof source === "object");
  return { sources, complete: reads.every((read) => read.ok) };
}

export async function loadKnownIdentifierSources() {
  return (await loadKnownIdentifierSourcesChecked()).sources;
}
