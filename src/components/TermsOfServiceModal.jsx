import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";

const TermsOfServiceModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Check if user has already accepted terms
    const hasAccepted = localStorage.getItem("vet-rate-tos-accepted");
    if (hasAccepted) {
      return; // Already accepted, don't show
    }

    // Wait for the DisclaimerSplash to be acknowledged first
    const checkDisclaimer = () => {
      const disclaimerDone = localStorage.getItem(
        "vetrate_disclaimer-acknowledged",
      );
      if (disclaimerDone) {
        // Small delay to let the disclaimer modal fully close
        setTimeout(() => {
          setIsOpen(true);
          startCountdown();
        }, 300);
        return true;
      }
      return false;
    };

    // If disclaimer already acknowledged, show immediately
    if (checkDisclaimer()) {
      return;
    }

    // Otherwise, poll for disclaimer acknowledgement
    const interval = setInterval(() => {
      if (checkDisclaimer()) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const startCountdown = () => {
    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanAccept(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAccept = () => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem(
      "vet-rate-tos-accepted-date",
      new Date().toISOString(),
    );
    setIsOpen(false);

    // Dispatch event so App can show What's New modal
    window.dispatchEvent(new CustomEvent("tosAccepted"));
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleAccept}
      dismissable={false}
      showClose={false}
      zIndex={99}
      size="xl"
      labelledBy="tos-title"
      header={
        <div className="bg-red-700 text-white px-6 py-4 border-b-4 border-red-900">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 id="tos-title" className="text-2xl font-bold">
              Terms of Service & Liability Waiver
            </h2>
          </div>
          <p className="mt-2 text-sm text-red-100">
            Required Reading - Please Review Carefully
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-600">
            <p>Effective Date: January 18, 2026</p>
            <p className="mt-1">
              Review full terms anytime at{" "}
              <a href="/terms" className="text-blue-600 hover:underline">
                Vet-Rate.org/terms
              </a>
            </p>
          </div>
          <button
            onClick={handleAccept}
            disabled={!canAccept}
            className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
              canAccept
                ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer shadow-lg hover:shadow-xl"
                : "bg-gray-400 text-gray-600 cursor-not-allowed"
            }`}
          >
            {canAccept
              ? "I Understand & Accept the Risks"
              : `Please Read (${countdown}s)`}
          </button>
        </div>
      }
    >
      <div className="space-y-6 text-gray-800">
        {/* Preamble */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="font-semibold text-lg mb-2">IMPORTANT NOTICE</p>
          <p className="text-sm leading-relaxed">
            Before using Vet-Rate.org, you must understand the limitations and
            risks of this tool. This agreement protects both you and this
            service by clearly defining what this platform is-and what it is
            not. Please read each section carefully.
          </p>
        </div>

        {/* Clause 1: Non-Accreditation */}
        <section className="border-l-4 border-blue-500 pl-4">
          <h3 className="text-xl font-bold text-blue-900 mb-3">
            1. Non-Accreditation Clause (38 U.S.C. § 5901)
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              <strong>Vet-Rate.org is NOT:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>An accredited Veterans Service Organization (VSO)</li>
              <li>A licensed attorney or law firm</li>
              <li>A VA-recognized claims agent</li>
              <li>A representative authorized under 38 U.S.C. § 5901</li>
            </ul>
            <p className="mt-3">
              <strong>What This Tool Is:</strong> Vet-Rate.org is a self-help
              educational platform designed to help veterans organize their
              thoughts, understand VA rating criteria, and prepare documentation
              for their claims.{" "}
              <span className="font-semibold underline">
                You are ultimately responsible for your own claim filing,
                accuracy, and legal decisions.
              </span>
            </p>
            <p className="mt-3 bg-gray-100 p-3 rounded">
              <strong>Recommendation:</strong> For complex cases, consider
              working with an accredited VSO or VA-accredited attorney. Visit{" "}
              <a
                href="https://www.va.gov/ogc/accreditation.asp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                VA.gov/ogc/accreditation.asp
              </a>{" "}
              to find accredited representatives.
            </p>
          </div>
        </section>

        {/* Clause 2: Not Medical Advice */}
        <section className="border-l-4 border-green-500 pl-4">
          <h3 className="text-xl font-bold text-green-900 mb-3">
            2. Not Medical Advice or Diagnosis
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              The &quot;Nexus Letter Builder,&quot; &quot;Symptom
              Database,&quot; &quot;Secondary Conditions Scout,&quot; and all
              other medical-related features are{" "}
              <strong>organizational tools only</strong>-they are
              <span className="font-semibold underline">
                {" "}
                NOT medical diagnostic instruments
              </span>
              .
            </p>
            <p className="mt-2">
              <strong>Critical Understanding:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>This tool cannot diagnose medical conditions</li>
              <li>
                Generated content does not substitute for a licensed
                physician&apos;s evaluation
              </li>
              <li>
                Only qualified healthcare professionals can provide medical
                opinions for VA claims
              </li>
              <li>
                You must obtain proper medical evidence from licensed providers
              </li>
            </ul>
            <p className="mt-3 bg-gray-100 p-3 rounded">
              <strong>What We Do:</strong> We help you articulate symptoms in
              medically-recognized terminology and identify potential
              connections based on VA medical literature.
              <strong> What We Don&apos;t Do:</strong> Provide medical opinions,
              diagnoses, or treatment advice.
            </p>
          </div>
        </section>

        {/* Clause 3: AI Accuracy */}
        <section className="border-l-4 border-purple-500 pl-4">
          <h3 className="text-xl font-bold text-purple-900 mb-3">
            3. Artificial Intelligence Limitations
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              Portions of this application use{" "}
              <strong>Artificial Intelligence (AI)</strong> to generate content,
              suggest language, and organize information.
            </p>
            <p className="mt-2">
              <strong>AI Can Make Mistakes:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Case law citations may be outdated, incomplete, or incorrectly
                referenced
              </li>
              <li>
                Medical terminology may be imprecise or contextually
                inappropriate
              </li>
              <li>
                Regulatory interpretations may not reflect the most current VA
                guidance
              </li>
              <li>
                Logic connections may not apply to your specific situation
              </li>
            </ul>
            <p className="mt-3 bg-yellow-50 border border-yellow-300 p-3 rounded">
              <strong className="text-red-700">YOUR RESPONSIBILITY:</strong> You
              must independently verify all AI-generated content,
              cross-reference legal citations, and confirm medical information
              with qualified professionals.{" "}
              <span className="underline">
                Do not submit AI-generated content to the VA without thorough
                human review.
              </span>
            </p>
          </div>
        </section>

        {/* Clause 4: Data Volatility */}
        <section className="border-l-4 border-orange-500 pl-4">
          <h3 className="text-xl font-bold text-orange-900 mb-3">
            4. Data Storage & Volatility Warning
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              <strong>Privacy-First Architecture:</strong> Vet-Rate.org is
              designed with your privacy as the top priority. We do not store
              your data on our servers.
            </p>
            <p className="mt-2">
              <strong>How Your Data Is Stored:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                All data is stored locally in your web browser&apos;s{" "}
                <code className="bg-gray-200 px-1 rounded">localStorage</code>
              </li>
              <li>
                Data never leaves your device unless you explicitly export it
              </li>
              <li>No cloud backups are created automatically</li>
            </ul>
            <p className="mt-3 bg-red-50 border-2 border-red-500 p-4 rounded">
              <strong className="text-red-700 text-lg">
                ⚠️ CRITICAL DATA WARNING:
              </strong>
              <br />
              If you clear your browser cache, uninstall your browser, or use
              incognito/private mode,
              <span className="font-bold underline">
                {" "}
                your data WILL BE PERMANENTLY DELETED
              </span>
              . Vet-Rate.org has no way to recover lost data.
              <strong>
                {" "}
                You must regularly export and back up your work using the
                built-in export features.
              </strong>
            </p>
            <p className="mt-3 text-xs text-gray-600">
              <strong>Best Practice:</strong> After each significant work
              session, use the &quot;Export&quot; feature to save a backup copy
              to your computer or cloud storage.
            </p>
          </div>
        </section>

        {/* Clause 5: No Guarantees */}
        <section className="border-l-4 border-red-500 pl-4">
          <h3 className="text-xl font-bold text-red-900 mb-3">
            5. No Guarantees of Outcome
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              <strong>Use of Vet-Rate.org does NOT guarantee:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>That your VA claim will be approved</li>
              <li>That you will receive a service connection</li>
              <li>
                That you will receive a specific disability rating percentage
              </li>
              <li>
                That your rating will increase upon appeal or supplemental claim
              </li>
              <li>
                Any particular outcome from the Department of Veterans Affairs
              </li>
            </ul>
            <p className="mt-3">
              <strong>Factors Beyond Our Control:</strong> VA claim outcomes
              depend on the strength of your medical evidence, service records,
              C&P exam results, VA regional office practices, and current case
              law-none of which this tool can influence or predict.
            </p>
            <p className="mt-3 bg-gray-100 p-3 rounded">
              <strong>What We Can Help With:</strong> Organizing your argument,
              identifying relevant medical research, articulating your case
              clearly, and understanding VA rating criteria.
              <strong> What We Cannot Control:</strong> How the VA adjudicates
              your specific claim.
            </p>
          </div>
        </section>

        {/* Additional Disclaimers */}
        <section className="bg-gray-50 p-4 rounded-lg border border-gray-300">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            Additional Terms
          </h3>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              <strong>No Warranty:</strong> This software is provided &quot;AS
              IS&quot; without warranty of any kind, express or implied,
              including but not limited to warranties of merchantability,
              fitness for a particular purpose, or non-infringement.
            </p>
            <p>
              <strong>Limitation of Liability:</strong> In no event shall
              Vet-Rate.org, its creators, or contributors be liable for any
              direct, indirect, incidental, special, consequential, or punitive
              damages arising from your use of this tool.
            </p>
            <p>
              <strong>Severability:</strong> If any provision of these terms is
              found unenforceable, the remaining provisions shall remain in full
              effect.
            </p>
            <p>
              <strong>Updates to Terms:</strong> These terms may be updated
              periodically. Continued use constitutes acceptance of any changes.
            </p>
          </div>
        </section>

        {/* Final Statement */}
        <div className="bg-blue-50 border-2 border-blue-600 p-4 rounded-lg">
          <p className="font-semibold text-blue-900 mb-2">
            By clicking &quot;I Understand & Accept the Risks,&quot; you
            acknowledge that:
          </p>
          <ul className="list-decimal list-inside space-y-1 text-sm ml-2">
            <li>
              You have read and understood all five liability clauses above
            </li>
            <li>
              You accept full responsibility for verifying all information
            </li>
            <li>You understand this is not legal or medical advice</li>
            <li>You will back up your data regularly</li>
            <li>You acknowledge no outcomes are guaranteed</li>
          </ul>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default TermsOfServiceModal;
