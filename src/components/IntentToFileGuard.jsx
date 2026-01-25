import React, { useState } from 'react';
import { Clock, AlertCircle, ExternalLink, X } from 'lucide-react';

/**
 * Intent to File (ITF) Guard Component
 * "The Financial Stop-Loss"
 * 
 * Purpose: Prevent veterans from losing backpay by waiting too long to file.
 * 
 * The Problem:
 * A veteran spends 3 weeks using our tools to build the "Perfect Claim." They file on February 20th.
 * Result: Their backpay starts February 20th.
 * 
 * The Miss: If they had clicked one button on VA.gov on Day 1 (Feb 1st), their backpay would 
 * have started then. We just cost them 3 weeks of pay (~$2,000+ for a high rating) by making 
 * them "wait until it's perfect."
 * 
 * The Fix: Active Clock component that nags them on Day 1.
 * ITF locks in effective date (start of pay) while giving veteran 1 year to gather evidence.
 * 
 * Usage: Place this at the very top of the GatewayWizard or Dashboard.
 */
const IntentToFileGuard = () => {
  // Check local storage to see if they've already dismissed this or set a date
  const [itfDate, setItfDate] = useState(localStorage.getItem('vet_rate_itf_date'));
  const [isVisible, setIsVisible] = useState(!itfDate);

  const handleITFSet = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('vet_rate_itf_date', today);
    setItfDate(today);
  };

  // If user has already set ITF date, show compact confirmation banner
  if (!isVisible && itfDate) return (
    <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex justify-between items-center text-xs text-slate-400">
      <span className="flex items-center gap-2">
        <Clock className="w-3 h-3 text-emerald-500" />
        Backpay Clock Active since: <span className="text-emerald-400 font-mono">{itfDate}</span>
      </span>
      <button 
        onClick={() => { 
          localStorage.removeItem('vet_rate_itf_date'); 
          setItfDate(null); 
          setIsVisible(true); 
        }} 
        className="hover:text-white transition-colors"
      >
        Reset
      </button>
    </div>
  );

  // If dismissed without setting date, don't show anything
  if (!isVisible) return null;

  // Main alert banner (first-time user experience)
  return (
    <div className="bg-blue-900/30 border-b border-blue-500/50 p-4 relative">
      <div className="max-w-5xl mx-auto flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-blue-100 font-bold flex items-center gap-2">
            🛑 STOP-LOSS ALERT: Lock in Your Backpay Date
          </h3>
          <p className="text-blue-200/80 text-sm mt-1">
            Do not wait to finish your claim. You can lock in your "Effective Date" (Start of Pay) right now by filing an{' '}
            <strong>Intent to File (ITF)</strong>. It takes 2 minutes and buys you 1 year to gather evidence.
          </p>
          
          <div className="flex gap-3 mt-3 flex-wrap">
            <a 
              href="https://www.va.gov/resources/your-intent-to-file-a-va-claim/" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded shadow-lg transition-colors"
            >
              Start ITF on VA.gov <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={handleITFSet}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded border border-slate-600 transition-colors"
            >
              I Did It (Start Clock)
            </button>
          </div>

          <div className="mt-3 text-xs text-blue-300/70 bg-blue-950/50 rounded px-3 py-2">
            <strong>Why This Matters:</strong> If you file your ITF today and submit your full claim 3 months from now,
            your backpay starts <em>today</em>—not 3 months from now. For a 100% rating, that's ~$3,700/month you don't lose.
          </div>
        </div>
        <button 
          onClick={() => setIsVisible(false)} 
          className="text-slate-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default IntentToFileGuard;
