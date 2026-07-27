#!/usr/bin/env node
/**
 * fetch-m21-1.mjs — fetch the VA M21-1 Adjudication Procedures Manual (S31).
 *
 * Source: KnowVA VA Self-Service portal. The public site is a client-side
 * Angular SPA (a plain fetch() of the page HTML returns only a "JavaScript is
 * not enabled" shell — see S25's knowledge-sources.yaml note), so the old
 * fetch()+regex scaffold got ZERO content.
 *
 * S31 resolution: the SPA is backed by a clean, undocumented-but-stable JSON
 * content API (the KANA/Verint "Self Service" v11 web services). We drive that
 * API directly with plain fetch() — no headless browser at runtime — which is
 * the reverse-engineered-content-API path the S27-S40 plan preferred over adding
 * a Puppeteer/Playwright dependency:
 *
 *   Topic tree (parts → chapters → sections):
 *     GET /system/ws/v11/ss/topic/{topicId}
 *         ?$attribute=name,id,parentTopicId,totalArticleCount,articleCount,
 *         &$lang=en-us&$level=2&$pagenum=0&$pagesize=1000
 *         &portalId={PORTAL_ID}&usertype=customer
 *     → { topicTree: [ { topic:{...}, topicTree:[ {topic:{...}}, … ] } ] }
 *     $level=2 returns the node + one level of children; the /topic/{id}
 *     endpoint rejects deep levels, so we BFS one level at a time.
 *
 *   Article bodies (the real M21-1 text):
 *     GET /system/ws/v11/ss/article
 *         ?$attribute=name,id,lastModifiedDate,contentText
 *         &$lang=en-us&$rangesize=50&$rangestart=N
 *         &portalId={PORTAL_ID}&topicId={leafTopicId}&usertype=customer
 *     → { article: [ { id, name, contentText(HTML), lastModifiedDate } ], pagingInfo }
 *
 * Output: scripts/legal-ingestion/.work/m21-1.jsonl (one makeRecord per line).
 * That file is chunked+embedded into the M21-1 SHARD (public/dkb-index/m21_1/)
 * by build-m21-1-shard.mjs — NOT folded into the eCFR legal-index monolith, so
 * "Ask the Regs" retrieval stays regression-free (S29). M21-1 is reachable
 * through knowledgeQuery.queryCorpus (S30) once its shard is registered.
 *
 * Env knobs:
 *   M21_MAX_ARTICLES=<n>   cap total articles (bounded verification runs)
 *   M21_MIN_ARTICLES=<n>   coverage floor for a FULL run (default 600; the root
 *                          reports ~785 — a floor guards against silent
 *                          under-fetch without being brittle to normal churn)
 *   M21_THROTTLE_MS=<n>    per-request delay (default 350) — be a good citizen
 *   M21_PORTAL_ID / M21_ROOT_TOPIC   override IDs if the portal reorganizes
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const BASE = "https://www.knowva.ebenefits.va.gov";
const PORTAL_ID = process.env.M21_PORTAL_ID || "554400000001018";
const ROOT_TOPIC = process.env.M21_ROOT_TOPIC || "554400000004049";
const LANG = "en-us";
const ARTICLE_PAGE_SIZE = 50;
const THROTTLE_MS = Number(process.env.M21_THROTTLE_MS) || 350;
const MAX_ARTICLES = Number(process.env.M21_MAX_ARTICLES) || 0; // 0 = unlimited
const MIN_ARTICLES = Number(process.env.M21_MIN_ARTICLES) || 600;
const MAX_TOPIC_FETCHES = 4000; // runaway guard for the BFS

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiJson(pathAndQuery) {
  const url = `${BASE}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`m21-1 ${url} → HTTP ${res.status}`);
  return res.json();
}

/**
 * Pull the direct child topics out of a /topic/{id}?$level=2 response.
 * Shape: { topicTree: [ { topic:{root}, topicTree:[ {topic:child}, … ] } ] }.
 * Pure — unit-tested without network.
 * @param {Object} json
 * @returns {Array<Object>} child topic objects
 */
export function extractChildTopics(json) {
  const root = json?.topicTree?.[0];
  if (!root || !Array.isArray(root.topicTree)) return [];
  return root.topicTree.map((n) => n.topic).filter(Boolean);
}

/**
 * Pull articles out of a /article response. `article` may be an array or a
 * single object depending on count. Pure — unit-tested without network.
 * @param {Object} json
 * @returns {Array<Object>}
 */
export function extractArticles(json) {
  const a = json?.article;
  if (Array.isArray(a)) return a;
  if (a && typeof a === "object") return [a];
  return [];
}

/**
 * Derive an M21-1 citation. Article/section names in this manual usually begin
 * with the reference itself (e.g. "III.iv.4.B - Evaluating …"); prefer that,
 * else fall back to a truncated title so a record is never citation-less.
 * @param {string} name
 * @returns {string}
 */
export function citationFor(name) {
  const s = String(name || "").trim();
  const m = /\b([IVX]+(?:\.[A-Za-z0-9]+){1,4})\b/.exec(s);
  if (m) return `M21-1 ${m[1]}`;
  return s ? `M21-1 — ${s.slice(0, 80)}` : "M21-1";
}

/**
 * Canonical veteran-facing deep link for an article (va.gov domain, so it
 * survives the sanitizer's gov-URL allow-list and renders as a real citation).
 * @param {string|number} articleId
 * @returns {string}
 */
export function articlePortalUrl(articleId) {
  return (
    `${BASE}/system/templates/selfservice/va_ssnew/help/customer/locale/` +
    `en-US/portal/${PORTAL_ID}/article/${articleId}`
  );
}

/** GET one level of child topics for a topic id. */
async function fetchChildren(topicId) {
  const q =
    `/system/ws/v11/ss/topic/${topicId}` +
    `?$attribute=name,id,parentTopicId,totalArticleCount,articleCount,` +
    `&$lang=${LANG}&$level=2&$pagenum=0&$pagesize=1000` +
    `&portalId=${PORTAL_ID}&usertype=customer`;
  return extractChildTopics(await apiJson(q));
}

/** GET all articles (paginated) for a leaf topic id, with contentText. */
async function fetchArticles(topicId) {
  const out = [];
  for (let start = 0; ; start += ARTICLE_PAGE_SIZE) {
    const q =
      `/system/ws/v11/ss/article` +
      `?$attribute=name,id,lastModifiedDate,contentText` +
      `&$lang=${LANG}&$rangesize=${ARTICLE_PAGE_SIZE}&$rangestart=${start}` +
      `&portalId=${PORTAL_ID}&topicId=${topicId}&usertype=customer`;
    const json = await apiJson(q);
    const page = extractArticles(json);
    out.push(...page);
    const total = Number(json?.pagingInfo?.maxRange ?? 0);
    if (page.length < ARTICLE_PAGE_SIZE || (total && start + page.length >= total))
      break;
    await sleep(THROTTLE_MS);
  }
  return out;
}

/**
 * Sort one topic's children into article-bearing leaves and further-crawl ids.
 * @param {Array<Object>} children
 * @param {{visited:Set, queue:Array, leaves:Array}} state
 */
function classifyChildren(children, { visited, queue, leaves }) {
  for (const t of children) {
    if (!t?.id) continue;
    if (Number(t.articleCount) > 0) {
      leaves.push({ id: t.id, name: t.name, articleCount: Number(t.articleCount) });
    }
    if (Number(t.childCount) > 0 && !visited.has(t.id)) queue.push(t.id);
  }
}

/**
 * BFS the topic tree from the root, collecting every topic that owns articles
 * (articleCount > 0). Bounded by a visited set and a hard fetch cap.
 * @returns {Promise<Array<{id:string,name:string,articleCount:number}>>}
 */
async function crawlLeafTopics() {
  const queue = [ROOT_TOPIC];
  const visited = new Set();
  const leaves = [];
  let fetches = 0;
  while (queue.length && fetches < MAX_TOPIC_FETCHES) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    fetches += 1;
    try {
      classifyChildren(await fetchChildren(id), { visited, queue, leaves });
    } catch (e) {
      console.warn(`[m21-1] topic ${id} children failed: ${e.message}`);
      continue;
    }
    await sleep(THROTTLE_MS);
  }
  return leaves;
}

/**
 * Fetch a leaf topic's articles and turn the non-empty, not-yet-seen ones into
 * canonical records. Dedup is tracked in the shared `seenArticleIds` set;
 * `limit` (0 = unlimited) caps how many this leaf contributes.
 * @param {{id:string}} leaf
 * @param {Set<string>} seenArticleIds
 * @param {number} limit
 * @returns {Promise<Array<Object>>}
 */
async function recordsForLeaf(leaf, seenArticleIds, limit) {
  let articles;
  try {
    articles = await fetchArticles(leaf.id);
  } catch (e) {
    console.warn(`[m21-1] articles for topic ${leaf.id} failed: ${e.message}`);
    return [];
  }
  const specs = [];
  for (const art of articles) {
    if (limit && specs.length >= limit) break;
    if (!art?.id || seenArticleIds.has(art.id)) continue;
    const body = String(art.contentText || "");
    if (body.trim().length === 0) continue; // skip empty stubs (never silently)
    seenArticleIds.add(art.id);
    specs.push({
      source: "m21-1",
      jurisdiction: "va",
      citation: citationFor(art.name),
      title: String(art.name || "").trim() || `M21-1 article ${art.id}`,
      body,
      source_url: articlePortalUrl(art.id),
    });
  }
  return Promise.all(specs.map(async (s) => makeRecord(s)));
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });

  console.log(
    `[m21-1] crawling topic tree from root ${ROOT_TOPIC} (portal ${PORTAL_ID})…`,
  );
  const leaves = await crawlLeafTopics();
  if (leaves.length === 0) {
    throw new Error(
      "M21-1 topic crawl found ZERO article-bearing topics — the content API " +
        "shape or portal/topic IDs may have changed (verify against the live portal)",
    );
  }
  const claimed = leaves.reduce((s, l) => s + l.articleCount, 0);
  console.log(
    `[m21-1] ${leaves.length} article-bearing topics found (~${claimed} articles claimed)`,
  );

  const records = [];
  const seenArticleIds = new Set();
  for (const leaf of leaves) {
    const remaining = MAX_ARTICLES ? MAX_ARTICLES - records.length : 0;
    if (MAX_ARTICLES && remaining <= 0) break;
    const leafRecords = await recordsForLeaf(leaf, seenArticleIds, remaining);
    records.push(...leafRecords);
    await sleep(THROTTLE_MS);
  }

  if (records.length === 0) {
    throw new Error("M21-1 fetch produced ZERO records with non-empty content");
  }

  // Coverage floor — only on a full (uncapped) run. A bounded verification run
  // (M21_MAX_ARTICLES set) is exempt so testing doesn't false-alarm.
  if (!MAX_ARTICLES && records.length < MIN_ARTICLES) {
    throw new Error(
      `M21-1 coverage floor: got ${records.length} articles, expected ≥ ${MIN_ARTICLES}. ` +
        `Likely a partial upstream outage or an API-shape change — not promoting a thin index.`,
    );
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "m21-1.jsonl");
  writeFileSync(outPath, out);
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  const cap = MAX_ARTICLES ? ` (capped at ${MAX_ARTICLES})` : "";
  console.log(`[m21-1] wrote ${records.length} article records → ${rel}${cap}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[m21-1] FAILED: ${e.message}`);
    process.exit(1);
  });
}
