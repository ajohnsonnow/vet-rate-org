import { describeDeviceClass, useDeviceProfile } from "../utils/deviceLabels";

export default function DeviceCapabilityCard({ webGPUStatus }) {
  const { label } = describeDeviceClass(useDeviceProfile());
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <span>📱</span> Device Capability
      </h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-white p-3 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500">Device</p>
          <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
        </div>
        <div className="rounded-lg bg-white p-3 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500">WebGPU</p>
          <p
            className={`font-semibold ${webGPUStatus.supported ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {webGPUStatus.supported ? "✅ Supported" : "❌ Not Available"}
          </p>
        </div>
        {webGPUStatus.supported && webGPUStatus.device && (
          <div className="col-span-2 rounded-lg bg-white p-3 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500">Active GPU</p>
            <p className="font-semibold text-cyan-600 dark:text-cyan-400">
              {webGPUStatus.device}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
