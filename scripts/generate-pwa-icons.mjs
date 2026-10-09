/**
 * Generate the PWA icon set from a source logo.
 *
 * The web app manifest (public/manifest.json) needs square PNGs at the install
 * sizes plus dedicated "maskable" variants (logo inside the inner-80% safe zone
 * on a solid background) so Android/Chrome don't crop the emblem under their
 * icon mask. These are committed binary assets; this script exists so they can
 * be regenerated deterministically (e.g. for the supply-locker brand, point
 * SOURCE at /images/supply-locker-logo.png).
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/images/Vet-Rate-org-logo-official.png");
const OUT = join(root, "public/images");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Square "any"-purpose icon: the logo fit onto a white square at `size`. */
async function anyIcon(size, name) {
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: WHITE })
    .png()
    .toFile(join(OUT, name));
  return name;
}

/** Maskable icon: logo scaled to the inner 80% safe zone, centered on white. */
async function maskableIcon(size, name) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(OUT, name));
  return name;
}

const written = await Promise.all([
  anyIcon(192, "logo192.png"),
  anyIcon(512, "logo512.png"),
  anyIcon(180, "apple-touch-icon-180.png"),
  maskableIcon(192, "logo-maskable-192.png"),
  maskableIcon(512, "logo-maskable-512.png"),
]);

console.log("Generated PWA icons:", written.join(", "));
