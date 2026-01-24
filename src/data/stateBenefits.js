/**
 * STATE BENEFITS DATABASE
 * ======================
 * 
 * ✅ STATUS: LIVE DATA FROM STATE SCRAPERS (178 benefits across 51 states)
 * 
 * This database contains veteran benefits scraped from official state sources.
 * Last major update: 2026-01-24
 * 
 * DATA QUALITY STATUS:
 * - High Quality (Verified): TX, CA, FL (3 states)
 * - Template-Generated (Needs Verification): 48 states
 * 
 * See: scripts/state-benefits-scraper/FINAL_REPORT.md for details
 */

// Import all state benefit files
import txBenefits from './states/tx_benefits_camel.json';
import caBenefits from './states/ca_benefits_camel.json';
import flBenefits from './states/fl_benefits_camel.json';
import vaBenefits from './states/va_benefits_camel.json';
import ncBenefits from './states/nc_benefits_camel.json';
import gaBenefits from './states/ga_benefits_camel.json';
import waBenefits from './states/wa_benefits_camel.json';
import paBenefits from './states/pa_benefits_camel.json';
import azBenefits from './states/az_benefits_camel.json';
import ohBenefits from './states/oh_benefits_camel.json';
import miBenefits from './states/mi_benefits_camel.json';
import coBenefits from './states/co_benefits_camel.json';
import tnBenefits from './states/tn_benefits_camel.json';
import inBenefits from './states/in_benefits_camel.json';
import maBenefits from './states/ma_benefits_camel.json';
import mdBenefits from './states/md_benefits_camel.json';
import scBenefits from './states/sc_benefits_camel.json';
import moBenefits from './states/mo_benefits_camel.json';
import wiBenefits from './states/wi_benefits_camel.json';
import mnBenefits from './states/mn_benefits_camel.json';
import orBenefits from './states/or_benefits_camel.json';
import alBenefits from './states/al_benefits_camel.json';
import laBenefits from './states/la_benefits_camel.json';
import kyBenefits from './states/ky_benefits_camel.json';
import okBenefits from './states/ok_benefits_camel.json';
import nyBenefits from './states/ny_benefits_camel.json';
import ilBenefits from './states/il_benefits_camel.json';
import njBenefits from './states/nj_benefits_camel.json';
import ctBenefits from './states/ct_benefits_camel.json';
import arBenefits from './states/ar_benefits_camel.json';
import ksBenefits from './states/ks_benefits_camel.json';
import nvBenefits from './states/nv_benefits_camel.json';
import utBenefits from './states/ut_benefits_camel.json';
import msBenefits from './states/ms_benefits_camel.json';
import iaBenefits from './states/ia_benefits_camel.json';
import nmBenefits from './states/nm_benefits_camel.json';
import wvBenefits from './states/wv_benefits_camel.json';
import neBenefits from './states/ne_benefits_camel.json';
import idBenefits from './states/id_benefits_camel.json';
import hiBenefits from './states/hi_benefits_camel.json';
import nhBenefits from './states/nh_benefits_camel.json';
import meBenefits from './states/me_benefits_camel.json';
import mtBenefits from './states/mt_benefits_camel.json';
import riBenefits from './states/ri_benefits_camel.json';
import deBenefits from './states/de_benefits_camel.json';
import sdBenefits from './states/sd_benefits_camel.json';
import ndBenefits from './states/nd_benefits_camel.json';
import akBenefits from './states/ak_benefits_camel.json';
import vtBenefits from './states/vt_benefits_camel.json';
import wyBenefits from './states/wy_benefits_camel.json';
import dcBenefits from './states/dc_benefits_camel.json';

// State metadata with verification status
const STATE_METADATA = {
  TX: { verified: true, lastUpdated: '2026-01-24', quality: 'high' },
  CA: { verified: true, lastUpdated: '2026-01-24', quality: 'high' },
  FL: { verified: true, lastUpdated: '2026-01-24', quality: 'high' },
  VA: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  NC: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  GA: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  WA: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  PA: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  AZ: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  OH: { verified: false, lastUpdated: '2026-01-24', quality: 'template' },
  // Add remaining states as template quality
};

// Combine all state benefits into one master array
const allStateData = [
  txBenefits, caBenefits, flBenefits, vaBenefits, ncBenefits, gaBenefits,
  waBenefits, paBenefits, azBenefits, ohBenefits, miBenefits, coBenefits,
  tnBenefits, inBenefits, maBenefits, mdBenefits, scBenefits, moBenefits,
  wiBenefits, mnBenefits, orBenefits, alBenefits, laBenefits, kyBenefits,
  okBenefits, nyBenefits, ilBenefits, njBenefits, ctBenefits, arBenefits,
  ksBenefits, nvBenefits, utBenefits, msBenefits, iaBenefits, nmBenefits,
  wvBenefits, neBenefits, idBenefits, hiBenefits, nhBenefits, meBenefits,
  mtBenefits, riBenefits, deBenefits, sdBenefits, ndBenefits, akBenefits,
  vtBenefits, wyBenefits, dcBenefits
];

// Flatten all benefits into single array with metadata
export const stateBenefits = allStateData.flatMap(stateData => 
  stateData.benefits.map(benefit => ({
    ...benefit,
    state: stateData.state,
    stateCode: stateData.stateCode,
    lastUpdated: stateData.lastUpdated,
    dataStatus: stateData.dataStatus,
    verified: STATE_METADATA[stateData.stateCode]?.verified || false,
    quality: STATE_METADATA[stateData.stateCode]?.quality || 'template'
  }))
);

// Export state lookup functions
export const getStateBenefits = (stateCode) => {
  return stateBenefits.filter(b => b.stateCode === stateCode);
};

export const searchBenefitsByRating = (stateCode, rating) => {
  const normalizeRequirements = (req) => {
    // Handle both old BaseStateScraper format and new SimpleStateScraper format
    if (req.minRating !== undefined) return req.minRating;
    if (req.min_rating !== undefined) return req.min_rating;
    return 0;
  };

  return stateBenefits.filter(b => {
    const stateMatch = !stateCode || b.stateCode === stateCode;
    const minRating = normalizeRequirements(b.requirements || {});
    const ratingMatch = rating >= minRating;
    return stateMatch && ratingMatch;
  });
};

export const getAllStateData = () => allStateData;

export const getVerifiedStates = () => {
  return Object.entries(STATE_METADATA)
    .filter(([_, meta]) => meta.verified)
    .map(([code, _]) => code);
};

// Statistics
export const STATS = {
  totalStates: allStateData.length,
  totalBenefits: stateBenefits.length,
  verifiedStates: getVerifiedStates().length,
  lastUpdated: '2026-01-24'
};

export default stateBenefits;
