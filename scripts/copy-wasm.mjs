/**
 * Copies wllama WASM binary to public/wasm/ after npm install.
 * Run automatically via postinstall, or manually: node scripts/copy-wasm.mjs
 */
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const copies = [
  {
    src: resolve(root, "node_modules/@wllama/wllama/esm/wasm/wllama.wasm"),
    dest: resolve(root, "public/wasm/wllama.wasm"),
  },
];

for (const { src, dest } of copies) {
  if (!existsSync(src)) {
    console.warn(`[copy-wasm] Source not found, skipping: ${src}`);
    continue;
  }
  await mkdir(resolve(dest, ".."), { recursive: true });
  await copyFile(src, dest);
  const kb = Math.round(
    (await import("node:fs")).default.statSync(dest).size / 1024,
  );
  console.log(`[copy-wasm] ${dest} (${kb} KB)`);
}
