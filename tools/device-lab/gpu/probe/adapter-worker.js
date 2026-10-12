self.onmessage = async () => {
  try {
    const a = await navigator.gpu.requestAdapter();
    const i = a.info;
    self.postMessage({
      vendor: i.vendor,
      architecture: i.architecture,
      device: i.device,
      description: i.description,
      maxBufferSize: a.limits.maxBufferSize,
      maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
    });
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
