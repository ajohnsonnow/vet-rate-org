/**
 * Vet-Rate.org - Visual Ribbon Component
 * =======================================
 *
 * Renders a single military ribbon with dynamic device overlays.
 * Devices (stars, oak leaf clusters, V device) are positioned using CSS.
 *
 * Usage:
 *   <VisualRibbon award={award} devices={devices} size="md" />
 */

import { useLanguage } from "../contexts/LanguageContext";

// Standard ribbon dimensions (scaled by size)
const SIZES = {
  sm: { width: 72, height: 27, deviceSize: 8 },
  md: { width: 96, height: 36, deviceSize: 10 },
  lg: { width: 120, height: 45, deviceSize: 12 },
};

// Device colors
const DEVICE_COLORS = {
  bronze_star: "#CD7F32",
  silver_star: "#C0C0C0",
  gold_star: "#FFD700",
  bronze_olc: "#CD7F32",
  silver_olc: "#C0C0C0",
  v_device: "#CD7F32",
  c_device: "#CD7F32",
  r_device: "#CD7F32",
  m_device: "#CD7F32",
  arrowhead: "#CD7F32",
};

function renderStarDevice(device, index, deviceSize, color) {
  return (
    <div
      key={index}
      className="absolute flex items-center justify-center"
      style={{
        left: device.x,
        top: device.y,
        width: deviceSize,
        height: deviceSize,
      }}
      aria-label={device.type.replace(/_/g, " ")}
    >
      <span
        style={{
          color,
          fontSize: deviceSize * 1.2,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        ★
      </span>
    </div>
  );
}

function renderOlcDevice(device, index, deviceSize, color) {
  return (
    <div
      key={index}
      className="absolute flex items-center justify-center"
      style={{
        left: device.x,
        top: device.y,
        width: deviceSize,
        height: deviceSize,
      }}
      aria-label={
        device.type === "bronze_olc"
          ? "Bronze Oak Leaf Cluster"
          : "Silver Oak Leaf Cluster"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width={deviceSize}
        height={deviceSize}
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M12 2C8 2 6 5 6 8c0 2 1 4 3 5l-1 7h8l-1-7c2-1 3-3 3-5 0-3-2-6-6-6z"
          fill={color}
          stroke="#000"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

function renderLetterDevice(
  device,
  index,
  deviceSize,
  color,
  letter,
  ariaLabel,
) {
  return (
    <div
      key={index}
      className="absolute flex items-center justify-center font-bold"
      style={{
        left: device.x,
        top: device.y,
        width: deviceSize,
        height: deviceSize,
        color: color,
        fontSize: deviceSize * 0.8,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
      aria-label={ariaLabel}
    >
      {letter}
    </div>
  );
}

function renderArrowheadDevice(device, index, deviceSize, color) {
  return (
    <div
      key={index}
      className="absolute flex items-center justify-center"
      style={{
        left: device.x,
        top: device.y,
        width: deviceSize,
        height: deviceSize,
        color: color,
        fontSize: deviceSize * 0.9,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
      aria-label="Arrowhead Device"
    >
      ▲
    </div>
  );
}

// Calculate device positions for horizontal centering
function getDevicePositions(deviceList, width, height, deviceSize) {
  if (!deviceList || deviceList.length === 0) return [];

  const totalDevices = deviceList.length;
  const spacing = deviceSize + 2;
  const totalWidth = totalDevices * spacing;
  const startX = (width - totalWidth) / 2 + spacing / 2;

  return deviceList.map((device, index) => ({
    ...device,
    x: startX + index * spacing,
    y: (height - deviceSize) / 2,
  }));
}

// Render individual device
function renderDevice(device, index, deviceSize) {
  const color = DEVICE_COLORS[device.type] || "#CD7F32";

  switch (device.type) {
    case "bronze_star":
    case "silver_star":
    case "gold_star":
      return renderStarDevice(device, index, deviceSize, color);

    case "bronze_olc":
    case "silver_olc":
      return renderOlcDevice(device, index, deviceSize, color);

    case "v_device":
      return renderLetterDevice(
        device,
        index,
        deviceSize,
        color,
        "V",
        "V Device (Valor)",
      );

    case "c_device":
      return renderLetterDevice(
        device,
        index,
        deviceSize,
        color,
        "C",
        "C Device (Combat)",
      );

    case "r_device":
      return renderLetterDevice(
        device,
        index,
        deviceSize,
        color,
        "R",
        "R Device (Remote)",
      );

    // FIX-4: detectDevices (ribbonRackData.js) extracts m_device
    // (Mobilization, e.g. AFRM / Oregon NG OR-FSR) but no case existed to
    // render it, so it silently never appeared on the ribbon.
    case "m_device":
      return renderLetterDevice(
        device,
        index,
        deviceSize,
        color,
        "M",
        "M Device (Mobilization)",
      );

    case "arrowhead":
      return renderArrowheadDevice(device, index, deviceSize, color);

    default:
      return null;
  }
}

/**
 * Visual Ribbon Component
 *
 * @param {Object} props
 * @param {Object} props.award - Award object with id, name, ribbonColor
 * @param {Array} props.devices - Array of { type, position } device objects
 * @param {string} props.size - Size: 'sm', 'md', 'lg'
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showName - Show award name below ribbon
 */
const VisualRibbon = ({
  award,
  devices = [],
  size = "md",
  className = "",
  showName = false,
}) => {
  const { _t } = useLanguage();
  const dimensions = SIZES[size] || SIZES.md;
  const { width, height, deviceSize } = dimensions;

  const positionedDevices = getDevicePositions(
    devices,
    width,
    height,
    deviceSize,
  );

  return (
    <div className={`inline-block ${className}`}>
      {/* Ribbon container */}
      <div
        className="relative rounded-sm shadow-md border border-gray-400"
        style={{ width, height }}
      >
        {/* Ribbon background - using gradients if no image */}
        <div
          className={`absolute inset-0 rounded-sm ${award?.ribbonColor || "bg-gray-400"}`}
          style={{
            backgroundImage: award?.assetFilename
              ? `url(/images/ribbons/${award.assetFilename})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Device overlay layer */}
        {positionedDevices.map((device, index) =>
          renderDevice(device, index, deviceSize),
        )}
      </div>

      {/* Award name (optional) */}
      {showName && award?.name && (
        <div
          className="text-center text-xs mt-1 text-gray-700 dark:text-gray-300 truncate"
          style={{ maxWidth: width + 20 }}
          aria-label={award.name}
        >
          {award.name}
        </div>
      )}
    </div>
  );
};

/**
 * Ribbon Rack Component - Displays multiple ribbons in proper military formation
 */
export const RibbonRackDisplay = ({
  awards = [],
  ribbonsPerRow = 3,
  size = "md",
  showNames = false,
}) => {
  const dimensions = SIZES[size] || SIZES.md;
  const { width } = dimensions;
  const gap = 2;

  // Calculate rows
  const totalRibbons = awards.length;
  const _fullRows = Math.floor(totalRibbons / ribbonsPerRow);
  const remainder = totalRibbons % ribbonsPerRow;

  const rows = [];
  let index = 0;

  // Top row (partial, centered)
  if (remainder > 0) {
    rows.push({
      ribbons: awards.slice(index, index + remainder),
      isPartial: true,
    });
    index += remainder;
  }

  // Full rows
  while (index < totalRibbons) {
    rows.push({
      ribbons: awards.slice(index, index + ribbonsPerRow),
      isPartial: false,
    });
    index += ribbonsPerRow;
  }

  // Calculate row width for centering
  const fullRowWidth = ribbonsPerRow * width + (ribbonsPerRow - 1) * gap;

  return (
    <div
      className="inline-flex flex-col items-center gap-0.5 p-2 bg-gray-800 rounded-lg"
      style={{ minWidth: fullRowWidth + 16 }}
    >
      {rows.map((row, rowIndex) => {
        const rowWidth =
          row.ribbons.length * width + (row.ribbons.length - 1) * gap;
        return (
          <div
            key={rowIndex}
            className="flex gap-0.5"
            style={{
              width: row.isPartial ? rowWidth : fullRowWidth,
              justifyContent: row.isPartial ? "center" : "flex-start",
            }}
          >
            {row.ribbons.map((awardData, ribbonIndex) => (
              <VisualRibbon
                key={awardData.awardId || ribbonIndex}
                award={awardData.award}
                devices={awardData.devices}
                size={size}
                showName={showNames}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default VisualRibbon;
