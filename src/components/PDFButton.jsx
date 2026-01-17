import React, { useState } from 'react';
import { generatePDF } from '../utils/pdfGenerator';
import BuyMeCoffee from './BuyMeCoffee';

function PDFButton({ result, searchTerm }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  const handleGeneratePDF = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await generatePDF(result, searchTerm);
      setPdfGenerated(true);
    } catch (err) {
      setError(err.message || 'Failed to generate PDF. Please try again.');
      console.error('PDF generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGeneratePDF}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
          isLoading
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-va-gold text-va-blue hover:bg-yellow-400 active:scale-95'
        }`}
        aria-label="Generate PDF with disability details"
      >
        <svg
          className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {isLoading ? (
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          ) : (
            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.3A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
          )}
        </svg>
        {isLoading ? 'Generating...' : 'Download PDF'}
      </button>
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {/* Show BuyMeCoffee after successful PDF generation */}
      <BuyMeCoffee 
        show={pdfGenerated} 
        trigger="pdf"
        context={{ conditionName: result?.condition_name || searchTerm }}
        onDismiss={() => setPdfGenerated(false)}
      />
    </div>
  );
}

export default PDFButton;
