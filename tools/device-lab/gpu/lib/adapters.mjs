/* eslint-disable sonarjs/no-os-command-from-path -- dev-workstation tool: nvidia-smi, powershell and taskkill are resolved from the system PATH on purpose */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;

export function luidHex(a) {
  const hex = (n) =>
    "0x" + (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `${hex(a.luidHigh)}_${hex(a.luidLow)}`;
}

function nvidiaSmiRows() {
  try {
    const out = execFileSync(
      "nvidia-smi",
      [
        "--query-gpu=index,name,pci.device_id,memory.total",
        "--format=csv,noheader,nounits",
      ],
      { encoding: "utf8" },
    );
    return out
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(",").map((s) => s.trim()))
      .map(([index, name, pciId, total]) => ({
        index: Number(index),
        name,
        deviceId: parseInt(pciId.slice(2, 6), 16),
        totalMiB: Number(total),
      }));
  } catch {
    return [];
  }
}

export function listAdapters() {
  const raw = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(here, "list-adapters.ps1"),
    ],
    { encoding: "utf8" },
  );
  const smi = nvidiaSmiRows();
  return JSON.parse(raw)
    .filter((a) => (a.flags & 2) === 0)
    .map((a) => {
      const match =
        a.vendorId === 0x10de
          ? smi.find((s) => s.deviceId === a.deviceId)
          : null;
      return {
        name: a.name,
        vendorId: a.vendorId,
        deviceId: a.deviceId,
        deviceIdHex: "0x" + a.deviceId.toString(16).padStart(4, "0"),
        luidArg: `${a.luidHigh},${a.luidLow}`,
        luidHex: luidHex(a),
        dedicatedMiB: Math.round(a.dedicatedBytes / MIB),
        isNvidia: a.vendorId === 0x10de,
        nvidiaIndex: match ? match.index : null,
      };
    });
}

const ALIASES = {
  radeon: (a) => a.vendorId === 0x1002,
  igpu: (a) => a.vendorId === 0x1002,
  4080: (a) => /4080/.test(a.name),
  4070: (a) => /4070/.test(a.name),
  5060: (a) => /5060/.test(a.name),
  4060: (a) => /4060/.test(a.name),
};

export function resolveAdapter(spec, adapters) {
  const key = String(spec)
    .toLowerCase()
    .replace(/[\s_-]|ti|super|rtx/g, "");
  const nv = /^nvidia:(\d+)$/i.exec(String(spec));
  let hits;
  if (nv) hits = adapters.filter((a) => a.nvidiaIndex === Number(nv[1]));
  else if (ALIASES[key]) hits = adapters.filter(ALIASES[key]);
  else
    hits = adapters.filter((a) =>
      a.name.toLowerCase().includes(String(spec).toLowerCase()),
    );
  if (hits.length !== 1) {
    const names = adapters.map((a) => a.name).join("; ");
    throw new Error(
      `--adapter "${spec}" matched ${hits.length} adapters (need exactly 1). Available: ${names}. Aliases: radeon, 4080, 4070, 5060, 4060, nvidia:<index>.`,
    );
  }
  return hits[0];
}
