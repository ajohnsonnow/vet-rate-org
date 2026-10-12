const MIB = 1024 * 1024;
const buffers = [];
let device = null;
let keepAlive = null;

async function init() {
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  device.lost.then((info) => {
    window.__ballastLost = `${info.reason}: ${info.message}`;
  });
  return {
    description: adapter.info.description,
    device: adapter.info.device,
  };
}

// 256 MiB is the default maxBufferSize, so no limits need requesting.
async function alloc(mib) {
  const buffer = device.createBuffer({
    size: mib * MIB,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const encoder = device.createCommandEncoder();
  encoder.clearBuffer(buffer);
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  buffers.push(buffer);
  return buffers.length;
}

// Touching every buffer on a timer keeps the allocations in use so Windows has
// less reason to demote them to system memory while the probe runs.
function startKeepAlive() {
  keepAlive = setInterval(() => {
    const encoder = device.createCommandEncoder();
    for (const b of buffers) encoder.clearBuffer(b, 0, 4);
    device.queue.submit([encoder.finish()]);
  }, 250);
}

function status() {
  return {
    buffers: buffers.length,
    totalMiB: buffers.reduce((n, b) => n + b.size / MIB, 0),
    lost: window.__ballastLost ?? null,
  };
}

function release() {
  clearInterval(keepAlive);
  for (const b of buffers) b.destroy();
  buffers.length = 0;
}

window.__ballast = { init, alloc, startKeepAlive, status, release };
window.__ballastReady = true;
