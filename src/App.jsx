import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import SearchResultCard from './components/SearchResultCard';
import DisabilityDetails from './components/DisabilityDetails';
import Disclaimer from './components/Disclaimer';
import BuyMeCoffee from './components/BuyMeCoffee';
import MilitarySeals from './components/MilitarySeals';
import PrivacyPolicy from './components/PrivacyPolicy';
import AboutUs from './components/AboutUs';
import ContactUs from './components/ContactUs';
import { searchDisabilityData, validateSearchTerm } from './utils/searchUtils';
import disabilityData from './data/disabilityData.json';
import './index.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showContactUs, setShowContactUs] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchTerm.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      // Validate search term
      if (!validateSearchTerm(searchTerm)) {
        setError('Invalid search term. Please use only letters, numbers, spaces, hyphens, or slashes.');
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const foundResults = searchDisabilityData(searchTerm, disabilityData);
        setResults(foundResults);
        setHasSearched(true);
        
        if (foundResults.length === 0) {
          setError(`No disabilities found for "${searchTerm}". Try searching by condition name (e.g., "PTSD", "arthritis") or diagnostic code (e.g., "9411", "5002").`);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('An error occurred while searching. Please try again.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setSelectedResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <BuyMeCoffee show={hasSearched && results.length > 0} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Disclaimer />
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Veteran Disability Search
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-4">
            Find your rated disability or diagnostic code to understand your benefits, documentation requirements, and related conditions. Powered by official eCFR 38 Part 4 data.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Tip:</strong> Search by condition name (PTSD, arthritis), diagnostic code (9411, 5002), or use synonyms (posttraumatic stress, rheumatoid arthritis).
          </p>
        </div>

        <SearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onClear={handleClearSearch}
          isLoading={isLoading}
        />

        {error && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              <strong>Info:</strong> {error}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-va-blue border-t-va-gold"></div>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Search Results ({results.length} found)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.slice(0, 3).map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => setSelectedResult(result)}
                  isSelected={selectedResult?.id === result.id}
                />
              ))}
            </div>
            
            {/* Ad Placement: In-Feed Ad (appears after first 3 results) */}
            {results.length > 3 && (
              <div className="my-8 text-center">
                <p className="text-xs text-gray-500 mb-2">Advertisement</p>
                <ins className="adsbygoogle"
                     style={{ display: 'block' }}
                     data-ad-client="ca-pub-2010725392546905"
                     data-ad-slot="1234567890"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
                <script>
                     (adsbygoogle = window.adsbygoogle || []).push({});
                </script>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {results.slice(3).map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => setSelectedResult(result)}
                  isSelected={selectedResult?.id === result.id}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoading && searchTerm.trim() !== '' && results.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No matching disabilities found.</p>
          </div>
        )}

        {selectedResult && (
          <DisabilityDetails
            result={selectedResult}
            searchTerm={searchTerm}
            onClose={() => setSelectedResult(null)}
          />
        )}
      </main>

      {/* Sticky Footer Ad */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="container mx-auto px-4 py-2">
          <p className="text-[10px] text-gray-400 text-center mb-1">Advertisement</p>
          <ins className="adsbygoogle"
               style={{ display: 'block' }}
               data-ad-client="ca-pub-2010725392546905"
               data-ad-slot="9876543210"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
          <script>
               (adsbygoogle = window.adsbygoogle || []).push({});
          </script>
        </div>
      </div>

      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3">About This Tool</h4>
              <p className="text-gray-400 text-sm mb-3">
                This application provides educational information about VA disability ratings based on official 38 CFR Part 4 data from eCFR.
              </p>
              <button
                onClick={() => setShowAboutUs(true)}
                className="text-va-gold hover:underline text-sm font-semibold"
              >
                Learn More →
              </button>
            </div>
            <div>
              <h4 className="font-bold mb-3">Data Privacy</h4>
              <p className="text-gray-400 text-sm mb-3">
                This system operates locally and does not store Personally Identifiable Information (PII) on external servers. All data processing happens in your browser.
              </p>
              <button
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-va-gold hover:underline text-sm font-semibold"
              >
                Privacy Policy →
              </button>
            </div>
            <div>
              <h4 className="font-bold mb-3">Legal Notice</h4>
              <p className="text-gray-400 text-sm">
                This tool is for educational purposes only. It does not constitute legal or medical advice. Consult with VA officials or qualified professionals for specific guidance.
              </p>
              <p className="text-gray-400 text-xs mt-2 italic">
                As an Amazon Associate, I earn from qualifying purchases.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              <button
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Privacy Policy
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowAboutUs(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                About Us
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowContactUs(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Contact Us
              </button>
            </div>
            <p className="text-center text-gray-400 text-sm">
              &copy; 2024 Veteran Disability Search. All data sourced from{' '}
              <a
                href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-va-gold hover:underline"
              >
                eCFR Title 38, Chapter I, Part 4
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showPrivacyPolicy && <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />}
      {showAboutUs && <AboutUs onClose={() => setShowAboutUs(false)} />}
      {showContactUs && <ContactUs onClose={() => setShowContactUs(false)} />}
    </div>
  );
}

export default App;
