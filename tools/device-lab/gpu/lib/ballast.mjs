import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchBrowser, PROBE_ORIGIN } from "./browser.mjs";
import { nvidiaMemory } from "./memory.mjs";

const TOLERANCE_MIB = 300;

/**
 * Fills VRAM on one NVIDIA card (through a second browser holding WebGPU
 * buffers on that same adapter) until nvidia-smi reports about targetFreeMiB
 * free. Throws if nvidia-smi does not confirm the target.
 */
export async function startBallast(adapter, targetFreeMiB) {
  if (!adapter.isNvidia || adapter.nvidiaIndex === null)
    throw new Error(
      "ballast needs an NVIDIA adapter so nvidia-smi can verify it",
    );
  const before = nvidiaMemory(adapter.nvidiaIndex);
  if (before.freeMiB < targetFreeMiB)
    throw new Error(
      `card already has only ${before.freeMiB} MiB free, below the ${targetFreeMiB} MiB target`,
    );
  const profileDir = mkdtempSync(join(tmpdir(), "device-lab-ballast-"));
  const { context, page } = await launchBrowser({
    adapter,
    profileDir,
    headed: false,
    screenWidth: 1280,
  });
  const close = async () => {
    await context.close().catch(() => {});
    rmSync(profileDir, { recursive: true, force: true });
  };
  try {
    await page.goto(`${PROBE_ORIGIN}/tools/device-lab/gpu/probe/ballast.html`);
    await page.waitForFunction(() => window.__ballastReady, null, {
      timeout: 120_000,
    });
    const info = await page.evaluate(() => window.__ballast.init());
    if (!info.description.includes(adapter.name.replace(/^NVIDIA /, "")))
      throw new Error(
        `ballast landed on "${info.description}", not ${adapter.name}`,
      );
    for (let i = 0; i < 200; i++) {
      const free = nvidiaMemory(adapter.nvidiaIndex).freeMiB;
      const need = free - targetFreeMiB;
      if (need <= TOLERANCE_MIB / 3) break;
      await page.evaluate(
        (mib) => window.__ballast.alloc(mib),
        Math.min(256, need),
      );
    }
    await page.evaluate(() => window.__ballast.startKeepAlive());
    await new Promise((r) => setTimeout(r, 1500));
    const after = nvidiaMemory(adapter.nvidiaIndex);
    const status = await page.evaluate(() => window.__ballast.status());
    const verified =
      Math.abs(after.freeMiB - targetFreeMiB) <= TOLERANCE_MIB && !status.lost;
    if (!verified) {
      await close();
      throw new Error(
        `ballast not verified: target ${targetFreeMiB} MiB free, nvidia-smi says ${after.freeMiB} MiB (lost: ${status.lost})`,
      );
    }
    return {
      targetFreeMiB,
      freeBeforeMiB: before.freeMiB,
      freeAfterMiB: after.freeMiB,
      heldMiB: status.totalMiB,
      verified,
      close,
    };
  } catch (err) {
    await close();
    throw err;
  }
}
