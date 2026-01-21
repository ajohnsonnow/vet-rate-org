/**
 * VA Facilities Search Hook
 * 
 * Custom hook for searching VA facilities using the VA.gov Facilities API.
 * Uses API Key authentication (not OAuth).
 * 
 * @see https://developer.va.gov/explore/facilities/docs/va_facilities
 */

import { useState, useCallback } from 'react';
import { getFacilities, formatFacilities } from '../api/va';
import { VA_FACILITIES_API_KEY } from '../config/vaAuth';

/**
 * Hook for searching VA facilities
 * 
 * @returns {Object} Facilities search state and methods
 */
export function useVaFacilities() {
  const [facilities, setFacilities] = useState([]);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Check if the API key is configured
   */
  const isConfigured = Boolean(VA_FACILITIES_API_KEY && VA_FACILITIES_API_KEY !== 'your_va_api_key_here');

  /**
   * Search for VA facilities near a ZIP code
   * 
   * @param {string} zipCode - 5-digit ZIP code
   * @param {Object} options - Search options
   * @param {string} options.type - Facility type filter (health, benefits, cemetery, vet_center)
   * @param {number} options.radius - Search radius in miles (default: 50)
   * @param {number} options.perPage - Results per page (default: 10)
   */
  const searchByZip = useCallback(async (zipCode, options = {}) => {
    if (!isConfigured) {
      setError('VA Facilities API is not configured. Please add VITE_VA_API_KEY to your .env file.');
      return { success: false, error: 'API not configured' };
    }

    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code.');
      return { success: false, error: 'Invalid ZIP code' };
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[VA Facilities] Searching near ZIP: ${zipCode}`);
      
      const data = await getFacilities(VA_FACILITIES_API_KEY, {
        zip: zipCode,
        radius: options.radius || 50,
        type: options.type || undefined,
        perPage: options.perPage || 10,
        ...options,
      });

      setRawData(data);
      const formatted = formatFacilities(data);
      setFacilities(formatted);
      
      console.log(`[VA Facilities] Found ${formatted.length} facilities`);
      
      return { 
        success: true, 
        data: formatted,
        raw: data,
        meta: data.meta,
      };
    } catch (err) {
      console.error('[VA Facilities] Search error:', err);
      const errorMessage = err.message || 'Failed to search facilities';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  /**
   * Search for VA facilities by coordinates
   * 
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {Object} options - Search options
   */
  const searchByLocation = useCallback(async (lat, lng, options = {}) => {
    if (!isConfigured) {
      setError('VA Facilities API is not configured.');
      return { success: false, error: 'API not configured' };
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[VA Facilities] Searching near: ${lat}, ${lng}`);
      
      const data = await getFacilities(VA_FACILITIES_API_KEY, {
        lat,
        lng,
        radius: options.radius || 50,
        type: options.type || undefined,
        perPage: options.perPage || 10,
        ...options,
      });

      setRawData(data);
      const formatted = formatFacilities(data);
      setFacilities(formatted);
      
      return { 
        success: true, 
        data: formatted,
        raw: data,
      };
    } catch (err) {
      console.error('[VA Facilities] Search error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  /**
   * Clear the current search results
   */
  const clearResults = useCallback(() => {
    setFacilities([]);
    setRawData(null);
    setError(null);
  }, []);

  return {
    // State
    facilities,
    rawData,
    loading,
    error,
    isConfigured,
    
    // Methods
    searchByZip,
    searchByLocation,
    clearResults,
  };
}

export default useVaFacilities;
