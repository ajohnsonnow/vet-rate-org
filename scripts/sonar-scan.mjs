#!/usr/bin/env node
/**
 * Scan the repo with the local SonarQube server (docker-compose.sonar.yml)
 * and print the quality-gate status plus open-issue counts.
 *
 *   npm run sonar:up      # once per boot
 *   SONAR_TOKEN=... npm run sonar:scan
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SONAR_HOST_URL || "http://127.0.0.1:9000";
const TOKEN = process.env.SONAR_TOKEN;
const PROJECT = "vet-rate-org";
const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));

if (!TOKEN) {
  console.error(
    "SONAR_TOKEN is not set. Create a Global Analysis token at " +
      `${HOST}/account/security and export it first (see docs/SONARQUBE.md).`,
  );
  process.exit(2);
}

const scan = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--network",
    "host",
    "-e",
    `SONAR_HOST_URL=${HOST}`,
    "-e",
    "SONAR_TOKEN",
    "-v",
    `${REPO}:/usr/src`,
    "sonarsource/sonar-scanner-cli",
  ],
  { stdio: "inherit", env: { ...process.env, SONAR_TOKEN: TOKEN } },
);
if (scan.status !== 0) process.exit(scan.status ?? 1);

const auth = { Authorization: `Bearer ${TOKEN}` };
const api = async (path) => {
  const res = await fetch(`${HOST}/api/${path}`, { headers: auth });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
};

// The server processes the report asynchronously after the scanner exits.
for (let i = 0; i < 60; i++) {
  const { queue } = await api(`ce/component?component=${PROJECT}`);
  if (queue.length === 0) break;
  await new Promise((r) => setTimeout(r, 5000));
}

const gate = await api(`qualitygates/project_status?projectKey=${PROJECT}`);
const issues = await api(
  `issues/search?components=${PROJECT}&issueStatuses=OPEN,CONFIRMED&ps=1` +
    "&facets=impactSoftwareQualities,impactSeverities",
);
console.log(`\nQuality gate: ${gate.projectStatus.status}`);
console.log(`Open issues: ${issues.total}`);
for (const facet of issues.facets) {
  const counts = facet.values
    .filter((v) => v.count > 0)
    .map((v) => `${v.val}=${v.count}`)
    .join(" ");
  console.log(`  ${facet.property}: ${counts}`);
}
console.log(`Dashboard: ${HOST}/dashboard?id=${PROJECT}`);
