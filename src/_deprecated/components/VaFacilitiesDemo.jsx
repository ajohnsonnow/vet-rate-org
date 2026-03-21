/**
 * VA Facilities Demo Component
 *
 * A standalone component to demonstrate VA Facilities API integration.
 * Uses API Key authentication (not OAuth).
 *
 * Perfect for showcasing to VA reviewers during the Production Access demo.
 */

import React, { useState } from "react";
import { useVaFacilities } from "../hooks/useVaFacilities";
import {
  MapPin,
  Phone,
  Globe,
  Clock,
  Building2,
  Heart,
  Flag,
  Search,
  ChevronDown,
  ChevronUp,
  Code,
  AlertCircle,
  Loader2,
  ExternalLink,
  Info,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  sanitizeUrl,
  sanitizePhoneHref,
  sanitizeMapsUrl,
} from "../../utils/sanitize";

// Facility type icons and colors
const FACILITY_TYPES = {
  health: {
    icon: Heart,
    label: "VA Health",
    color: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-200 dark:border-red-700",
  },
  benefits: {
    icon: Building2,
    label: "Benefits Office",
    color: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-700",
  },
  cemetery: {
    icon: Flag,
    label: "National Cemetery",
    color: "bg-green-700",
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-700",
  },
  vet_center: {
    icon: Heart,
    label: "Vet Center",
    color: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/30",
    border: "border-purple-200 dark:border-purple-700",
  },
};

const VaFacilitiesDemo = ({ embedded = false }) => {
  const { t } = useLanguage();
  const {
    facilities,
    rawData,
    loading,
    error,
    isConfigured,
    searchByZip,
    clearResults,
  } = useVaFacilities();

  const [zipCode, setZipCode] = useState("97217"); // Demo default
  const [facilityType, setFacilityType] = useState("");
  const [radius, setRadius] = useState(50);
  const [showRawJson, setShowRawJson] = useState(false);
  const [expandedFacility, setExpandedFacility] = useState(null);

  const handleSearch = async () => {
    await searchByZip(zipCode, {
      type: facilityType || undefined,
      radius,
      perPage: 10,
    });
  };

  const handleZipChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 5);
    setZipCode(value);
  };

  const getFacilityTypeInfo = (type) => {
    const typeKey = type?.toLowerCase().replace(/\s+/g, "_") || "health";
    return FACILITY_TYPES[typeKey] || FACILITY_TYPES.health;
  };

  const formatAddress = (address) => {
    if (!address) return "Address not available";
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zip,
    ].filter(Boolean);
    return parts.join(", ") || "Address not available";
  };

  const formatPhone = (phone) => {
    if (!phone) return null;
    // Format as (XXX) XXX-XXXX if it's 10 digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // Container styling based on embedded mode
  const containerClass = embedded
    ? "bg-white dark:bg-gray-800 rounded-xl p-6"
    : "bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-4xl mx-auto";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            VA Facilities Finder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Search nearby VA medical centers, benefits offices, and more
          </p>
        </div>
      </div>

      {/* API Key Warning */}
      {!isConfigured && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                API Key Required
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                To use the VA Facilities API, add your API key to the{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
                  .env
                </code>{" "}
                file:
              </p>
              <pre className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-800 p-2 rounded font-mono overflow-x-auto">
                VITE_VA_API_KEY=your_api_key_here
              </pre>
              <a
                href="https://developer.va.gov/explore/api/va-facilities/sandbox-access"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-yellow-700 dark:text-yellow-300 hover:underline"
              >
                Get your free API key at developer.va.gov{" "}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Search Form */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* ZIP Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={handleZipChange}
              placeholder="97217"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={5}
            />
          </div>

          {/* Facility Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Facility Type
            </label>
            <select
              value={facilityType}
              onChange={(e) => setFacilityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="health">VA Health</option>
              <option value="benefits">Benefits Office</option>
              <option value="cemetery">National Cemetery</option>
              <option value="vet_center">Vet Center</option>
            </select>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Radius (miles)
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
              <option value={75}>75 miles</option>
              <option value={100}>100 miles</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading || !isConfigured || zipCode.length !== 5}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Using VA Facilities API v1 • Sandbox Environment
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {facilities.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Found {facilities.length} facilities near {zipCode}
            </h3>
            <button
              onClick={clearResults}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear Results
            </button>
          </div>

          {/* Facility Cards */}
          <div className="space-y-3">
            {facilities.map((facility, idx) => {
              const typeInfo = getFacilityTypeInfo(facility.type);
              const TypeIcon = typeInfo.icon;
              const isExpanded = expandedFacility === facility.id;

              return (
                <div
                  key={facility.id || idx}
                  className={`${typeInfo.bg} ${typeInfo.border} border rounded-xl overflow-hidden transition-shadow hover:shadow-md`}
                >
                  <button
                    onClick={() =>
                      setExpandedFacility(isExpanded ? null : facility.id)
                    }
                    className="w-full p-4 flex items-start gap-4 text-left"
                  >
                    <div
                      className={`w-10 h-10 ${typeInfo.color} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {facility.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {formatAddress(facility.address)}
                      </p>
                      {facility.distance && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 rounded-full">
                          {facility.distance.toFixed(1)} miles away
                        </span>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Phone */}
                        {facility.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <a
                              href={sanitizePhoneHref(
                                String(facility.phone ?? ""),
                              )}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {formatPhone(facility.phone)}
                            </a>
                          </div>
                        )}

                        {/* Website */}
                        {facility.website && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-500" />
                            <a
                              href={sanitizeUrl(String(facility.website ?? ""))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}

                        {/* Classification */}
                        {facility.classification && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {facility.classification}
                            </span>
                          </div>
                        )}

                        {/* Facility ID */}
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">
                            ID: {facility.id}
                          </span>
                        </div>
                      </div>

                      {/* Hours */}
                      {facility.hours &&
                        Object.keys(facility.hours).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Hours
                            </h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {Object.entries(facility.hours).map(
                                ([day, hours]) => (
                                  <div
                                    key={day}
                                    className="text-gray-600 dark:text-gray-400"
                                  >
                                    <span className="font-medium capitalize">
                                      {day}:
                                    </span>{" "}
                                    {hours || "Closed"}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Directions Link */}
                      {facility.coordinates?.lat &&
                        facility.coordinates?.lng && (
                          <div className="mt-4">
                            <a
                              href={sanitizeMapsUrl(
                                facility.coordinates.lat,
                                facility.coordinates.lng,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <MapPin className="w-4 h-4" />
                              Get Directions
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Raw JSON Toggle */}
          <div className="mt-6">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Code className="w-4 h-4" />
              {showRawJson ? "Hide" : "Show"} Raw API Response
              {showRawJson ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showRawJson && rawData && (
              <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-96 font-mono">
                {JSON.stringify(rawData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && facilities.length === 0 && isConfigured && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">
            Enter a ZIP code to find nearby VA facilities
          </p>
          <p className="text-sm mt-2">
            Search for medical centers, benefits offices, cemeteries, and Vet
            Centers
          </p>
        </div>
      )}

      {/* Demo Info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">API Integration Note</p>
            <p className="mt-1">
              This component uses the VA Facilities API with API Key
              authentication (no OAuth required). The default ZIP code (97217)
              is set for demo purposes - Portland, OR area.
            </p>
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              Endpoint:{" "}
              <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                GET /services/va_facilities/v1/facilities
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaFacilitiesDemo;
