/**
 * Admin PIN Hash Generator for Vet-Rate.org
 * 
 * SECURITY: This script generates SHA-256 hashes for admin PINs.
 * Run this locally to generate a hash, then store it in your environment variables.
 * 
 * Usage:
 *   node scripts/generate-admin-pin-hash.js YOUR_PIN
 * 
 * Example:
 *   node scripts/generate-admin-pin-hash.js 123456
 * 
 * Then add to your .env.local or production environment:
 *   VITE_ADMIN_PIN_HASH=generated_hash_here
 */

const crypto = require('crypto');

// Salt should match the one in AdminAuthContext.jsx
const SALT = 'VetRate-Admin-2024-Secure';

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);
  const hashBuffer = await crypto.webcrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const pin = process.argv[2];

if (!pin) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🔐 Admin PIN Hash Generator                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:                                                      ║
║    node scripts/generate-admin-pin-hash.js YOUR_PIN          ║
║                                                              ║
║  Example:                                                    ║
║    node scripts/generate-admin-pin-hash.js 123456            ║
║                                                              ║
║  Security Tips:                                              ║
║    • Use a PIN of at least 6 digits                          ║
║    • Don't use obvious patterns (123456, 000000)             ║
║    • Store the hash in environment variables only            ║
║    • Never commit the hash to version control                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

if (!/^\d{4,10}$/.test(pin)) {
  console.error('❌ PIN must be 4-10 digits');
  process.exit(1);
}

hashPin(pin).then(hash => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🔐 Admin PIN Hash Generated                        ║
╠══════════════════════════════════════════════════════════════╣

  ✅ Your hashed PIN:
  
  ${hash}

╠══════════════════════════════════════════════════════════════╣
║  Next Steps:                                                 ║
╠══════════════════════════════════════════════════════════════╣

  1. Create a .env.local file in the project root (if not exists)
  
  2. Add this line to .env.local:
     VITE_ADMIN_PIN_HASH=${hash}
  
  3. For production (Render.com), add the environment variable:
     - Name:  VITE_ADMIN_PIN_HASH
     - Value: ${hash}

  4. Restart your development server or redeploy

╠══════════════════════════════════════════════════════════════╣
║  ⚠️  SECURITY WARNINGS                                       ║
╠══════════════════════════════════════════════════════════════╣

  • Never commit .env.local to git
  • Never share your PIN or hash publicly
  • This hash is one-way (cannot recover PIN from it)
  • Access admin panel with: Ctrl+Shift+A

╚══════════════════════════════════════════════════════════════╝
  `);
}).catch(err => {
  console.error('Error generating hash:', err);
  process.exit(1);
});
