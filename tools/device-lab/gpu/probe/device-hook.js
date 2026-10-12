const channel = new BroadcastChannel("device-lab-gpu");
const proto = globalThis.GPUAdapter?.prototype;
if (proto && !proto.__deviceLabHooked) {
  const original = proto.requestDevice;
  proto.requestDevice = async function (...args) {
    const device = await original.apply(this, args);
    channel.postMessage({ kind: "device-created", t: Date.now() });
    device.lost.then((info) => {
      channel.postMessage({
        kind: "device-lost",
        t: Date.now(),
        reason: info.reason,
        message: info.message,
      });
    });
    device.addEventListener("uncapturederror", (e) => {
      channel.postMessage({
        kind: "uncaptured-error",
        t: Date.now(),
        message: e.error?.message ?? String(e.error),
      });
    });
    return device;
  };
  proto.__deviceLabHooked = true;
}
