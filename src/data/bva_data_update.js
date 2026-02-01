// BVA Data Update - Auto-generated
// Generated: 2026-01-31T22:19:37.830969
// Source: VA Public Records
// DO NOT EDIT MANUALLY - Run va_data_pipeline.py to update

/**
 * Latest BVA analysis data by condition
 * Based on scraped public BVA decisions
 */
export const BVA_CONDITION_STATS = {};

/**
 * Current VA processing times
 * From VA Benefits Reports
 */
export const VA_PROCESSING_CURRENT = {};

/**
 * Data freshness info
 */
export const DATA_METADATA = {
  lastUpdated: "2026-01-31",
  bvaDecisionsAnalyzed: 0,
  conditionsCovered: 0,
  source: "VA Public Records (BVA decisions, VA.gov reports)"
};

/**
 * Merge function - call this to update main bvaSuccessData
 * Usage: import { mergeLatestData } from './bva_data_update';
 */
export function mergeLatestData(existingData) {
  return {
    ...existingData,
    conditionSpecific: {
      ...(existingData.conditionSpecific || {}),
      ...BVA_CONDITION_STATS
    },
    processingTimes: {
      ...(existingData.processingTimes || {}),
      ...VA_PROCESSING_CURRENT
    },
    _lastAutoUpdate: DATA_METADATA.lastUpdated
  };
}
