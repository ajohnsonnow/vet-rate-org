export type Basis = "measured" | "documented" | "estimate";

export interface GpuAdapterSpec {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  limits: {
    maxBufferSize: number;
    maxStorageBufferBindingSize: number;
    [limit: string]: number;
  };
}

export interface NetworkSpec {
  downloadKbps: number;
  uploadKbps: number;
  latencyMs: number;
}

export interface DeviceProfile {
  name: string;
  deviceClass: string;
  source: string;
  basis: {
    screen: Basis;
    userAgent: Basis;
    memoryAndCores: Basis;
    gpu: Basis;
    cpuThrottleRate: Basis;
    network?: Basis;
  };
  viewport: { width: number; height: number };
  screen: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent: string;
  /** null = the browser has no navigator.userAgentData (Safari, Firefox). */
  userAgentData: { mobile: boolean; platform: string } | null;
  /** null = the browser has no navigator.deviceMemory (Safari, Firefox). */
  deviceMemory: number | null;
  hardwareConcurrency: number;
  cpuThrottleRate: number;
  network?: NetworkSpec | null;
  /**
   * null: navigator.gpu is removed (browser without WebGPU).
   * { adapter: null }: navigator.gpu exists and requestAdapter() resolves null.
   * { adapter: {...} }: requestAdapter() resolves an adapter-like object.
   */
  gpu: { adapter: GpuAdapterSpec | null } | null;
}

export interface AppliedState {
  profile: string;
  cdp: boolean;
  cpuThrottleRate: number | null;
  network: NetworkSpec | null;
}
