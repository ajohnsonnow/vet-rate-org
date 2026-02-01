#!/usr/bin/env node
/**
 * VA API Pre-Demo Testing Script
 * 
 * Run this 1 hour before the demo to verify all APIs are accessible
 * Usage: node scripts/test-va-apis.js
 */

import 'dotenv/config';

const SANDBOX_BASE = 'https://sandbox-api.va.gov';

// Read from environment
const VA_API_KEY = process.env.VITE_VA_API_KEY;
const FACILITIES_KEY = process.env.VITE_VA_FACILITIES_API_KEY || VA_API_KEY;
const FORMS_KEY = process.env.VITE_VA_FORMS_API_KEY || VA_API_KEY;
const BENEFITS_KEY = process.env.VITE_VA_BENEFITS_REF_API_KEY || VA_API_KEY;

const results = {
  passed: [],
  failed: [],
};

async function testApiKey(name, url, apiKey) {
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      results.passed.push(name);
      console.log(`✅ ${name}: OK (${response.status})`);
      return { success: true, data };
    } else {
      results.failed.push(name);
      console.error(`❌ ${name}: FAIL (${response.status})`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    results.failed.push(name);
    console.error(`❌ ${name}: ERROR - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n🔍 VA API Pre-Demo Testing\n');
  console.log('Testing Open Data APIs (API Key Authentication)...\n');

  // Test Facilities API
  await testApiKey(
    'VA Facilities API',
    `${SANDBOX_BASE}/services/va_facilities/v1/facilities?zip=97217&per_page=5`,
    FACILITIES_KEY
  );

  // Test Forms API
  await testApiKey(
    'VA Forms API',
    `${SANDBOX_BASE}/services/va_forms/v0/forms?query=21-526EZ`,
    FORMS_KEY
  );

  // Test Benefits Reference Data API
  await testApiKey(
    'Benefits Reference Data API',
    `${SANDBOX_BASE}/services/benefits-reference-data/v1/disabilities`,
    BENEFITS_KEY
  );

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`✅ PASSED: ${results.passed.length}/3`);
  console.log(`❌ FAILED: ${results.failed.length}/3`);
  console.log('='.repeat(60));

  if (results.failed.length === 0) {
    console.log('\n✨ All Open Data APIs are ready for demo!\n');
    console.log('Next steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Open http://localhost:5173');
    console.log('3. Test OAuth flow with VA sandbox credentials\n');
  } else {
    console.log('\n⚠️  Some APIs failed. Check your API keys in .env.local\n');
    console.log('Failed APIs:', results.failed.join(', '));
    console.log('\nVerify keys at: https://developer.va.gov/explore\n');
    process.exit(1);
  }
}

main();
