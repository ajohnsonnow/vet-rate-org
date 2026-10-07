/**
 * A throwing BroadcastChannel constructor (e.g. Firefox with cookies/site
 * storage blocked - SecurityError) used to propagate straight out of this
 * module's top-level `installListener()` call. safetyRedirect.js - the panic
 * key - does a side-effect-only `import "./dataWipeChannel"`, so an uncaught
 * throw here failed THAT module's evaluation too: the panic key went dead
 * along with the wipe broadcast, in exactly the browser configuration a
 * privacy-conscious veteran is most likely to be running.
 *
 * dataWipeChannel.js self-initializes on import as a side effect, so each
 * test here needs its own fresh module instance (vi.resetModules() + a
 * dynamic import) to observe a different BroadcastChannel global - kept in
 * its own file (see dataWipeChannelReceive.test.js for the receiving-side
 * behavior) because each fresh import also leaves a `window` "storage"
 * listener behind that nothing ever removes, and stacking several of those
 * in one file would make an exact call-count assertion elsewhere in the file
 * see more firings than a single real tab ever would.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../utils/beforeUnloadGuard.js", () => ({
  clearBeforeUnloadWarning: () => {},
}));
vi.mock("../../utils/autoBackup.js", () => ({
  stopAutoBackup: () => {},
}));

const originalBroadcastChannel = globalThis.BroadcastChannel;

afterEach(() => {
  globalThis.BroadcastChannel = originalBroadcastChannel;
  vi.resetModules();
});

function installThrowingBroadcastChannel() {
  globalThis.BroadcastChannel = class {
    constructor() {
      throw new Error("The operation is insecure.");
    }
  };
}

describe("dataWipeChannel survives a throwing BroadcastChannel constructor", () => {
  it("does not throw on import", async () => {
    installThrowingBroadcastChannel();
    await expect(
      import("../../utils/dataWipeChannel.js"),
    ).resolves.toBeDefined();
  });

  it("broadcastDataWipe falls back to the storage-event ping", async () => {
    installThrowingBroadcastChannel();
    const mod = await import("../../utils/dataWipeChannel.js");
    const setItemSpy = vi.spyOn(localStorage, "setItem");

    expect(() => mod.broadcastDataWipe()).not.toThrow();

    expect(setItemSpy).toHaveBeenCalledWith(
      "vetrate_data_wipe_broadcast",
      expect.any(String),
    );
  });
});
