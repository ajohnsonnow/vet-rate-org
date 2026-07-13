import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

const TermsHeader = ({ onClose }) => (
  <div className="bg-red-700 dark:bg-red-800 text-white px-6 py-5 border-b-4 border-red-900 dark:border-red-950">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <svg
          className="w-8 h-8 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div>
          <h1
            id="terms-of-service-page-title"
            className="text-2xl sm:text-3xl font-bold"
          >
            Terms of Service & Liability Waiver
          </h1>
          <p className="text-sm text-red-100 mt-1">
            Vet-Rate.org Legal Framework
          </p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-white hover:bg-red-800 p-2 rounded-lg transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  </div>
);

const TermsFooter = ({ onClose }) =>
  onClose && (
    <div className="flex justify-center">
      <button
        onClick={onClose}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
      >
        Close
      </button>
    </div>
  );

const EffectiveDateBanner = () => (
  <div className="text-center py-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
    <p className="text-sm text-gray-600 dark:text-gray-300">
      Last Updated: <strong>January 18, 2026</strong>
    </p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      By using Vet-Rate.org, you accept these terms in full
    </p>
  </div>
);

const IntroductionSection = () => (
  <section>
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      Introduction
    </h2>
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-6 space-y-3">
      <p className="leading-relaxed text-gray-800 dark:text-gray-200">
        <strong>Vet-Rate.org</strong> is a free, privacy-first educational
        platform designed to help United States veterans understand VA
        disability rating criteria, organize their claim documentation, and
        navigate the complex veterans benefits system.
      </p>
      <p className="leading-relaxed text-gray-800 dark:text-gray-200">
        This Terms of Service agreement establishes the legal framework
        governing your use of this platform. These terms are designed to
        protect both you (the veteran user) and the operators of this
        service by clearly defining what Vet-Rate.org is, what it is not,
        and the inherent limitations of self-help legal technology.
      </p>
      <p className="leading-relaxed font-semibold text-gray-900 dark:text-gray-100">
        Please read these terms carefully. They contain important
        information about your legal rights, remedies, and obligations,
        including mandatory liability waivers and disclaimers.
      </p>
    </div>
  </section>
);

const NonAccreditationDisclosure = () => (
  <>
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
      <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
        CRITICAL LEGAL DISCLOSURE:
      </p>
      <p className="text-gray-800 dark:text-gray-200">
        Vet-Rate.org and its operators are <strong>NOT</strong>:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2 ml-4 text-gray-800 dark:text-gray-200">
        <li>
          An accredited Veterans Service Organization (VSO) under 38
          U.S.C. § 5902
        </li>
        <li>A licensed attorney or law firm</li>
        <li>A VA-recognized claims agent under 38 C.F.R. § 14.627</li>
        <li>
          A representative authorized to practice before the Department
          of Veterans Affairs
        </li>
        <li>
          Affiliated with, endorsed by, or operating under the authority
          of the U.S. Department of Veterans Affairs
        </li>
      </ul>
    </div>

    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        What Vet-Rate.org Is:
      </h3>
      <p>
        This platform is a <strong>self-help educational tool</strong>{" "}
        that provides:
      </p>
      <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
        <li>
          Access to publicly available VA rating criteria and schedules
        </li>
        <li>
          Organizational tools for documenting symptoms and evidence
        </li>
        <li>Templates for structuring claims arguments</li>
        <li>Educational resources about VA claims processes</li>
        <li>Research assistance for medical and legal terminology</li>
      </ul>
    </div>
  </>
);

const NonAccreditationResponsibility = () => (
  <>
    <div className="bg-gray-100 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Your Responsibility:
      </h3>
      <p>
        <span className="font-bold underline">
          You remain solely responsible for
        </span>
        : filing your own claims, verifying the accuracy of all
        information, making legal decisions, and ensuring compliance
        with VA regulations. Vet-Rate.org does not file claims on your
        behalf, represent you before the VA, or make legal
        determinations about your eligibility.
      </p>
    </div>

    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        <svg
          className="inline w-5 h-5 mr-2"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        Recommendation for Complex Cases:
      </h3>
      <p className="text-gray-800">
        For complex claims, appeals to the Board of Veterans&apos;
        Appeals, or cases involving legal nuances, it is strongly
        recommended to work with an accredited representative. Find one
        at:{" "}
        <a
          href="https://www.va.gov/ogc/accreditation.asp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline font-semibold"
        >
          VA.gov/ogc/accreditation.asp
        </a>
      </p>
    </div>
  </>
);

const NonAccreditationSection = () => (
  <section className="border-l-4 border-blue-500 dark:border-blue-600 pl-6">
    <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 mb-4">
      1. Non-Accreditation Clause (38 U.S.C. § 5901)
    </h2>
    <div className="space-y-4 leading-relaxed">
      <NonAccreditationDisclosure />
      <NonAccreditationResponsibility />
    </div>
  </section>
);

const MedicalAdviceIntro = () => (
  <>
    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
      <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
        MEDICAL DISCLAIMER:
      </p>
      <p className="text-gray-800">
        No feature of Vet-Rate.org-including but not limited to the
        Nexus Letter Builder, Symptom Database, Secondary Conditions
        Scout, or any AI-generated content-constitutes medical advice,
        diagnosis, or treatment recommendations.
      </p>
    </div>

    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        What These Tools Do:
      </h3>
      <p className="mb-2">
        The medical-related features are{" "}
        <strong>organizational and educational tools</strong> that:
      </p>
      <ul className="list-disc list-inside space-y-1 ml-4">
        <li>
          Help you articulate symptoms using medically-recognized
          terminology
        </li>
        <li>
          Identify potential secondary conditions based on VA medical
          literature
        </li>
        <li>
          Organize your symptom documentation for presentation to
          healthcare providers
        </li>
        <li>
          Provide templates for structuring medical evidence requests
        </li>
        <li>
          Reference publicly available medical research and VA
          guidelines
        </li>
      </ul>
    </div>
  </>
);

const MedicalAdviceLimits = () => (
  <>
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        What These Tools Do NOT Do:
      </h3>
      <ul className="list-disc list-inside space-y-1 ml-4">
        <li>Diagnose medical conditions or diseases</li>
        <li>Provide medical opinions about causation or etiology</li>
        <li>
          Substitute for examination by a licensed healthcare
          professional
        </li>
        <li>Offer treatment recommendations or medical care plans</li>
        <li>Determine medical eligibility for VA benefits</li>
      </ul>
    </div>

    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        ?? Medical Evidence Requirements:
      </h3>
      <p className="text-gray-800">
        <strong>
          VA claims require medical opinions from licensed healthcare
          professionals.
        </strong>{" "}
        You must obtain proper diagnoses, nexus opinions, and medical
        evidence from qualified physicians, nurse practitioners, or
        other licensed medical providers. AI-generated content or tool
        suggestions cannot substitute for these requirements.
      </p>
    </div>

    <div className="bg-gray-100 p-4 rounded-lg">
      <p className="text-sm">
        <strong>Healthcare Provider Relationship:</strong> Nothing in
        Vet-Rate.org creates a physician-patient relationship,
        therapist-client relationship, or any professional medical
        relationship. Always consult with your own healthcare providers
        for medical advice.
      </p>
    </div>
  </>
);

const MedicalAdviceSection = () => (
  <section className="border-l-4 border-green-500 dark:border-green-600 pl-6">
    <h2 className="text-2xl font-bold text-green-900 dark:text-green-300 mb-4">
      2. Not Medical Advice or Diagnosis
    </h2>
    <div className="space-y-4 leading-relaxed">
      <MedicalAdviceIntro />
      <MedicalAdviceLimits />
    </div>
  </section>
);

const AIWarningBanner = () => (
  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
    <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
      AI-GENERATED CONTENT WARNING:
    </p>
    <p className="text-gray-800 dark:text-gray-200">
      Portions of this application utilize Artificial Intelligence
      (AI) technologies to generate text, suggest language, organize
      information, and provide research assistance.{" "}
      <strong>AI systems can and do make errors.</strong>
    </p>
  </div>
);

const AIKnownLimitations = () => (
  <div>
    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Known AI Limitations:
    </h3>
    <div className="space-y-2">
      <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 p-3 rounded shadow-sm">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          Legal Citations:
        </p>
        <p className="text-sm text-gray-800 dark:text-gray-200">
          AI may cite case law that is outdated, overturned,
          misapplied, or completely fabricated. All legal citations
          must be independently verified through official sources.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 p-3 rounded shadow-sm">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          Medical Terminology:
        </p>
        <p className="text-sm text-gray-800 dark:text-gray-200">
          AI may use medical terms imprecisely, suggest inappropriate
          diagnostic criteria, or misunderstand symptom relationships.
          Medical content requires healthcare professional validation.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 p-3 rounded shadow-sm">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          Regulatory Interpretation:
        </p>
        <p className="text-sm text-gray-800 dark:text-gray-200">
          VA regulations and policies change frequently. AI training
          data may not reflect the most current guidance, policy
          memos, or regulatory amendments.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 p-3 rounded shadow-sm">
        <p className="font-semibold text-gray-900">
          Contextual Misunderstanding:
        </p>
        <p className="text-sm text-gray-800">
          AI may fail to understand the unique context of your
          situation, leading to suggestions that are technically
          correct but practically inapplicable to your specific case.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 p-3 rounded shadow-sm">
        <p className="font-semibold text-gray-900">
          &quot;Hallucinations&quot;:
        </p>
        <p className="text-sm text-gray-800">
          AI can generate plausible-sounding but entirely false
          information, including fake statistics, non-existent
          studies, or fabricated legal precedents.
        </p>
      </div>
    </div>
  </div>
);

const AIResponsibilityBanner = () => (
  <>
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 p-5 rounded-lg">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        YOUR CRITICAL RESPONSIBILITY:
      </h3>
      <div className="space-y-2 text-gray-800">
        <p className="font-semibold">
          ? Independently verify all AI-generated content
        </p>
        <p className="font-semibold">
          ? Cross-reference legal citations with official sources
        </p>
        <p className="font-semibold">
          ? Confirm medical information with healthcare professionals
        </p>
        <p className="font-semibold">
          ? Review all VA form submissions for accuracy
        </p>
        <p className="font-semibold">
          ? Never submit AI-generated content without thorough human
          review
        </p>
      </div>
    </div>

    <div className="bg-gray-100 p-4 rounded-lg">
      <p className="text-sm">
        <strong>No Liability for AI Errors:</strong> Vet-Rate.org and
        its operators disclaim all liability for errors, omissions, or
        inaccuracies in AI-generated content. You use AI-assisted
        features at your own risk.
      </p>
    </div>
  </>
);

const AILimitationsSection = () => (
  <section className="border-l-4 border-purple-500 dark:border-purple-600 pl-6">
    <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-300 mb-4">
      3. Artificial Intelligence Limitations & Accuracy Disclaimer
    </h2>
    <div className="space-y-4 leading-relaxed">
      <AIWarningBanner />
      <AIKnownLimitations />
      <AIResponsibilityBanner />
    </div>
  </section>
);

const DataStorageIntro = () => (
  <>
    <div className="bg-orange-50 p-4 rounded-lg">
      <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
        PRIVACY-FIRST ARCHITECTURE:
      </p>
      <p className="text-gray-800">
        Vet-Rate.org is intentionally designed as a{" "}
        <strong>serverless, browser-based application</strong>
        to protect your privacy. Vet-Rate.org does not store your data
        on any servers, in cloud databases, or in any remote location.
      </p>
    </div>

    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        How Your Data Is Stored:
      </h3>
      <ul className="list-disc list-inside space-y-1 ml-4">
        <li>
          All data is stored in your web browser&apos;s{" "}
          <code className="bg-gray-200 px-2 py-1 rounded text-sm">
            localStorage
          </code>
        </li>
        <li>Data remains on your local device only</li>
        <li>No automatic cloud backups are created</li>
        <li>
          Data is not transmitted to Vet-Rate.org servers (the webapp
          doesn&apos;t have data servers)
        </li>
        <li>
          Export functionality allows you to save data to your own files
        </li>
      </ul>
    </div>
  </>
);

const DataLossWarning = () => (
  <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-600 p-6 rounded-lg">
    <div className="flex items-start gap-3">
      <svg
        className="w-12 h-12 text-red-600 flex-shrink-0 mt-1"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          CRITICAL DATA LOSS WARNING
        </h3>
        <p className="text-gray-900 dark:text-gray-100 mb-3 font-semibold text-lg">
          Your data WILL BE PERMANENTLY DELETED if you:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-800 dark:text-gray-200 ml-4">
          <li>Clear your browser cache or browsing data</li>
          <li>Use browser &quot;Clear All History&quot; features</li>
          <li>Uninstall or reset your web browser</li>
          <li>
            Use private/incognito browsing mode (data won&apos;t
            persist)
          </li>
          <li>
            Use browser cleaning tools or privacy extensions that
            clear storage
          </li>
          <li>Switch to a different browser or device</li>
        </ul>
        <p className="text-gray-900 dark:text-gray-100 font-bold text-lg mt-4 underline">
          WE CANNOT RECOVER YOUR DATA. THERE ARE NO SERVER BACKUPS.
        </p>
      </div>
    </div>
  </div>
);

const DataProtectionTips = () => (
  <>
    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 p-5 rounded-lg">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        ?? Data Protection Best Practices:
      </h3>
      <div className="space-y-2 text-gray-800">
        <p>
          <strong>1. Export Regularly:</strong> Use the built-in export
          features after each work session
        </p>
        <p>
          <strong>2. Multiple Backups:</strong> Save exported files to
          multiple locations (computer, USB drive, cloud storage)
        </p>
        <p>
          <strong>3. Before Browser Maintenance:</strong> Always export
          your data before clearing cache or updating browsers
        </p>
        <p>
          <strong>4. Document Version Control:</strong> Date your
          exports to track different versions
        </p>
        <p>
          <strong>5. Test Imports:</strong> Periodically test that your
          exported files can be successfully re-imported
        </p>
      </div>
    </div>

    <div className="bg-gray-100 p-4 rounded-lg">
      <p className="text-sm">
        <strong>No Liability for Data Loss:</strong> By using
        Vet-Rate.org, you acknowledge and accept full responsibility for
        backing up your data. We are not liable for any data loss,
        regardless of cause, including but not limited to browser
        issues, technical failures, user error, or circumstances beyond
        our control.
      </p>
    </div>
  </>
);

const DataVolatilitySection = () => (
  <section className="border-l-4 border-orange-500 pl-6">
    <h2 className="text-2xl font-bold text-orange-900 mb-4">
      4. Data Storage, Volatility & Loss Prevention
    </h2>
    <div className="space-y-4 leading-relaxed">
      <DataStorageIntro />
      <DataLossWarning />
      <DataProtectionTips />
    </div>
  </section>
);

const NoGuaranteesList = () => (
  <>
    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
      <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
        NO OUTCOME GUARANTEES:
      </p>
      <p className="text-gray-800">
        Use of Vet-Rate.org, completion of any tools or forms, or
        implementation of any suggestions does
        <strong> NOT guarantee, promise, or predict</strong> any
        specific outcome from the Department of Veterans Affairs.
      </p>
    </div>

    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        What Is NOT Guaranteed:
      </h3>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Approval of your VA disability claim</li>
        <li>Grant of service connection for any condition</li>
        <li>Any specific disability rating percentage</li>
        <li>Rating increases on appeal or supplemental claims</li>
        <li>Faster processing times for your claim</li>
        <li>
          Favorable decisions from Rating Veterans Service
          Representatives (RVSR)
        </li>
        <li>
          Successful outcomes at Board of Veterans&apos; Appeals
          hearings
        </li>
        <li>
          Total Disability Individual Unemployability (TDIU)
          determinations
        </li>
        <li>Special Monthly Compensation (SMC) awards</li>
      </ul>
    </div>
  </>
);

const FactorsBeyondControl = () => (
  <div>
    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Factors Beyond This App&apos;s Control:
    </h3>
    <p className="mb-2">
      VA claim outcomes depend on numerous factors including:
    </p>
    <div className="grid md:grid-cols-2 gap-3">
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">Evidence Quality</p>
        <p className="text-xs text-gray-600">
          Strength and completeness of medical evidence, service
          records, and lay statements
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">C&P Exam Results</p>
        <p className="text-xs text-gray-600">
          VA or contractor examination findings and severity ratings
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">
          Service Connection Nexus
        </p>
        <p className="text-xs text-gray-600">
          Medical opinions establishing causation link to military
          service
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">
          Regional Office Practices
        </p>
        <p className="text-xs text-gray-600">
          Variations in how different VA regional offices interpret
          evidence
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">Current Case Law</p>
        <p className="text-xs text-gray-600">
          Evolving legal precedents from Court of Appeals for Veterans
          Claims
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-300 p-3 rounded">
        <p className="font-semibold text-sm">Policy Changes</p>
        <p className="text-xs text-gray-600">
          Updates to VA rating schedules and policy guidance
        </p>
      </div>
    </div>
  </div>
);

const NoGuaranteesHelp = () => (
  <>
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        What Vet-Rate.org CAN Help With:
      </h3>
      <ul className="list-disc list-inside space-y-1 ml-4 text-gray-800">
        <li>Understanding VA rating criteria and diagnostic codes</li>
        <li>Organizing your symptoms and evidence systematically</li>
        <li>Identifying potential secondary conditions to research</li>
        <li>Drafting clear, well-structured claim arguments</li>
        <li>Learning VA claims terminology and processes</li>
        <li>Preparing for C&P exams with symptom documentation</li>
        <li>Tracking deadlines and managing claim documentation</li>
      </ul>
    </div>

    <div className="bg-gray-100 p-4 rounded-lg">
      <p className="text-sm">
        <strong>Realistic Expectations:</strong> The VA disability
        claims process is complex, time-consuming, and often
        unpredictable. While Vet-Rate.org provides tools to help you
        present the strongest possible case, ultimate decisions rest
        with VA adjudicators applying legal and medical criteria to your
        specific evidence.
      </p>
    </div>
  </>
);

const NoGuaranteesSection = () => (
  <section className="border-l-4 border-red-500 dark:border-red-600 pl-6">
    <h2 className="text-2xl font-bold text-red-900 dark:text-red-300 mb-4">
      5. No Guarantees of VA Claim Outcomes
    </h2>
    <div className="space-y-4 leading-relaxed">
      <NoGuaranteesList />
      <FactorsBeyondControl />
      <NoGuaranteesHelp />
    </div>
  </section>
);

const LegalTermsPartOne = () => (
  <>
    {/* No Warranty */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        No Warranty
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        THIS SOFTWARE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
        AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
        NON-INFRINGEMENT. THE WEBAPP DOES NOT WARRANT THAT THE SOFTWARE
        WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR VIRUS-FREE.
      </p>
    </div>

    {/* Limitation of Liability */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Limitation of Liability
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, VET-RATE.ORG, ITS
        CREATORS, CONTRIBUTORS, AND OPERATORS SHALL NOT BE LIABLE FOR
        ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        EXEMPLARY, OR PUNITIVE DAMAGES (INCLUDING BUT NOT LIMITED TO
        LOSS OF DATA, LOSS OF BENEFITS, CLAIM DENIALS, OR LOST
        OPPORTUNITIES) ARISING FROM OR RELATED TO YOUR USE OF THIS
        PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
    </div>

    {/* Indemnification */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Indemnification
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        You agree to indemnify, defend, and hold harmless Vet-Rate.org
        and its operators from any claims, damages, liabilities, costs,
        and expenses (including reasonable attorneys&apos; fees) arising
        from your use of the platform, your violation of these terms, or
        your violation of any third-party rights.
      </p>
    </div>

    {/* Severability */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Severability
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        If any provision of these Terms of Service is found to be
        invalid, illegal, or unenforceable by a court of competent
        jurisdiction, the remaining provisions shall continue in full
        force and effect.
      </p>
    </div>
  </>
);

const LegalTermsPartTwo = () => (
  <>
    {/* Entire Agreement */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Entire Agreement
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        These Terms of Service, together with the Privacy Policy,
        constitute the entire agreement between you and Vet-Rate.org
        regarding use of this platform and supersede all prior
        agreements and understandings.
      </p>
    </div>

    {/* Modifications */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Modifications to Terms
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        The webapp reserves the right to modify these terms at any time.
        Material changes will be indicated by updating the &quot;Last
        Updated&quot; date at the top of this document. Continued use of
        Vet-Rate.org after changes constitutes acceptance of the
        modified terms.
      </p>
    </div>

    {/* Governing Law */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Governing Law & Jurisdiction
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        These terms shall be governed by and construed in accordance
        with the laws of the United States. Any disputes shall be
        resolved in accordance with applicable law, without giving
        effect to any principles of conflicts of law.
      </p>
    </div>

    {/* Accessibility */}
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Accessibility Commitment
      </h3>
      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded">
        I strive to make Vet-Rate.org accessible to veterans with
        disabilities. If you encounter accessibility barriers, please
        contact me through the app so I can work to address them.
      </p>
    </div>
  </>
);

const AdditionalLegalTermsSection = () => (
  <section className="border-t-4 border-gray-300 pt-8">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
      Additional Legal Terms
    </h2>

    <div className="space-y-6">
      <LegalTermsPartOne />
      <LegalTermsPartTwo />
    </div>
  </section>
);

const ContactSection = () => (
  <section className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600 p-6 rounded-lg">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      Questions About These Terms?
    </h2>
    <p className="leading-relaxed mb-3 text-gray-800">
      If you have questions about these Terms of Service, need
      clarification on any provisions, or wish to report issues with the
      platform, please use the &quot;Contact Us&quot; feature within the
      application or visit our support resources.
    </p>
    <p className="text-sm text-blue-800">
      <strong>Remember:</strong> I cannot provide legal advice about your
      specific claim. For legal guidance, consult with an accredited VSO
      or VA-accredited attorney.
    </p>
  </section>
);

const AcceptanceSection = () => (
  <section className="bg-green-50 dark:bg-green-900/20 border-4 border-green-600 p-6 rounded-lg">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      Your Acceptance
    </h2>
    <p className="leading-relaxed mb-3 text-gray-800">
      By using Vet-Rate.org, you acknowledge that you have read,
      understood, and agree to be bound by these Terms of Service. You
      specifically acknowledge understanding of:
    </p>
    <ul className="list-decimal list-inside space-y-1 ml-4 text-gray-800">
      <li>
        The non-accreditation status and limitations of this platform
      </li>
      <li>That no medical advice or diagnosis is provided</li>
      <li>
        AI content limitations and your verification responsibilities
      </li>
      <li>Data storage volatility and your backup obligations</li>
      <li>That no claim outcomes are guaranteed</li>
    </ul>
    <p className="mt-4 text-sm italic">
      If you do not agree to these terms, you must immediately cease using
      Vet-Rate.org.
    </p>
  </section>
);

const FinalStatementSection = () => (
  <div className="text-center py-6 border-t-2 border-gray-300">
    <p className="text-lg font-semibold text-gray-900">
      Thank you for using Vet-Rate.org
    </p>
    <p className="text-sm text-gray-600 mt-2">
      I&apos;m honored to serve those who served. Stay safe, document
      everything, and never give up on your claim.
    </p>
    <p className="text-xs text-gray-500 mt-4">
      Document Version: 1.0 | Effective: January 18, 2026
    </p>
  </div>
);

const TermsOfServicePage = ({ onClose }) => {
  const { _t } = useLanguage();

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="terms-of-service-page-title"
      header={<TermsHeader onClose={onClose} />}
      footer={<TermsFooter onClose={onClose} />}
    >
      {/* Content */}
      <div className="space-y-8 text-gray-800 dark:text-gray-200">
        {/* Effective Date */}
        <EffectiveDateBanner />

        {/* Introduction */}
        <IntroductionSection />

        {/* Section 1: Non-Accreditation */}
        <NonAccreditationSection />

        {/* Section 2: Not Medical Advice */}
        <MedicalAdviceSection />

        {/* Section 3: AI Limitations */}
        <AILimitationsSection />

        {/* Section 4: Data Volatility */}
        <DataVolatilitySection />

        {/* Section 5: No Guarantees */}
        <NoGuaranteesSection />

        {/* Additional Legal Terms */}
        <AdditionalLegalTermsSection />

        {/* Contact Information */}
        <ContactSection />

        {/* Acceptance Acknowledgment */}
        <AcceptanceSection />

        {/* Final Statement */}
        <FinalStatementSection />
      </div>
    </ResponsiveModal>
  );
};

export default TermsOfServicePage;
