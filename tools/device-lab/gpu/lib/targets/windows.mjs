import { launchBrowser } from "../browser.mjs";
import { startWindowsSampler } from "../memory.mjs";

export function windowsTarget(adapter, options) {
  return {
    platform: "windows",
    label: adapter.name,
    cellInfo: { adapterDeviceId: adapter.deviceIdHex },
    adapterMatches(info) {
      if (!info) return false;
      const want = adapter.name.replace(/^NVIDIA /, "");
      return (
        info.description?.includes(want) &&
        info.device?.toLowerCase() === adapter.deviceIdHex
      );
    },
    launch: (profileDir) =>
      launchBrowser({
        adapter,
        profileDir,
        headed: options.headed,
        screenWidth: options.screenWidth,
      }),
    startSampler: () => startWindowsSampler(adapter),
  };
}
