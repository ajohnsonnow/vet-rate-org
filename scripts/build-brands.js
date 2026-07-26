/**
 * Multi-Brand Build Script
 * ========================
 *
 * Builds both VetRate and SupplyLocker versions from single codebase.
 *
 * Usage:
 *   node scripts/build-brands.js          # Build both
 *   node scripts/build-brands.js vetrate  # Build VetRate only
 *   node scripts/build-brands.js supplylocker # Build SupplyLocker only
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const BRANDS = {
  vetrate: {
    outDir: "dist",
    envVar: "VITE_BRAND_MODE=vetrate",
    description: "Vet-Rate.org (Free Version)",
  },
  supplylocker: {
    outDir: "dist-supplylocker",
    envVar: "VITE_BRAND_MODE=supplylocker",
    description: "Supply Locker (Supporter Version)",
  },
};

function buildBrand(brandKey) {
  const brand = BRANDS[brandKey];
  if (!brand) {
    console.error(`❌ Unknown brand: ${brandKey}`);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🏗️  Building: ${brand.description}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    // Set environment and build
    const isWindows = process.platform === "win32";
    const envPrefix = isWindows ? `set ${brand.envVar} &&` : `${brand.envVar}`;

    execSync(
      // nosemgrep: local.detect-child-process-strict,javascript.lang.security.detect-child-process.detect-child-process
      `${envPrefix} npx vite build --outDir ${brand.outDir}`,
      {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          VITE_BRAND_MODE: brandKey,
        },
      },
    );

    console.log(`\n✅ ${brand.description} built successfully!`);
    console.log(`   Output: ${brand.outDir}/\n`);

    return true;
  } catch (error) {
    console.error(`\n❌ Failed to build ${brand.description}`);
    console.error(error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Build both
    console.log("🚀 Building ALL brand versions...\n");

    let success = true;
    for (const brandKey of Object.keys(BRANDS)) {
      if (!buildBrand(brandKey)) {
        success = false;
      }
    }

    if (success) {
      console.log("\n" + "=".repeat(60));
      console.log("✅ ALL BUILDS COMPLETE!");
      console.log("=".repeat(60));
      console.log("\nOutput directories:");
      for (const [key, brand] of Object.entries(BRANDS)) {
        console.log(`  • ${brand.description}: ${brand.outDir}/`);
      }
    } else {
      process.exit(1);
    }
  } else {
    // Build specific brand
    const brandKey = args[0].toLowerCase();
    if (!BRANDS[brandKey]) {
      console.error(`❌ Unknown brand: ${brandKey}`);
      console.log("Available brands:", Object.keys(BRANDS).join(", "));
      process.exit(1);
    }

    if (!buildBrand(brandKey)) {
      process.exit(1);
    }
  }
}

main();
