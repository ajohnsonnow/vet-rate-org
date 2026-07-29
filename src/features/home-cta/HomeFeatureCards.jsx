import Disclaimer from "../../components/Disclaimer";
import { getFormsCount } from "../../utils/formsCount";

function TacticalCalculatorCta() {
  return (
    <div className="bg-gradient-to-r from-green-700 via-emerald-700 to-green-800 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16"></div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
            <span className="text-5xl">🧮</span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-3xl font-bold">Tactical Calculator</h3>
            <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full animate-pulse">
              CORE FEATURE
            </span>
          </div>
          <p className="text-green-100 max-w-xl">
            <strong>Calculate your REAL rating</strong> using official VA math
            (38 CFR § 4.25). Includes <strong>Bilateral Factor</strong>, gap
            analysis to reach 100%, and
            <strong> 2026 pay estimates</strong> with dependents.
          </p>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openTacticalCalculator"))
            }
            className="px-8 py-4 bg-white text-green-800 rounded-xl font-bold text-lg hover:bg-green-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <span>🎯</span>
            <span>Calculate My Rating</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SecondaryScoutCta() {
  return (
    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40 border-2 border-teal-300 dark:border-teal-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl p-3 shadow-lg flex-shrink-0">
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Secondary Scout
          </h3>
          <span className="inline-block px-2 py-0.5 bg-teal-500 text-white text-xs font-bold rounded-full">
            INSTANT
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        Discover <strong>secondary claims</strong> linked to your
        service-connected disabilities - powered by our comprehensive nexus
        database and 38 CFR § 3.310.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openSecondaryScoutLauncher"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
      >
        🚀 Launch Secondary Scout
      </button>
    </div>
  );
}

function CPSimulatorCta() {
  return (
    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/40 dark:to-cyan-900/40 border-2 border-teal-300 dark:border-teal-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-3 shadow-lg flex-shrink-0">
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            C&P Exam Simulator
          </h3>
          <span className="inline-block px-2 py-0.5 bg-teal-500 text-white text-xs font-bold rounded-full">
            PRACTICE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        Practice for your <strong>C&P exam</strong> with condition-specific
        questions, DBQ-aligned scenarios, and real-time feedback to maximize
        your rating.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openCAPSimulator"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
      >
        🎯 Launch C&P Simulator
      </button>
    </div>
  );
}

function BDDBuilderCta() {
  return (
    <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <span className="text-4xl">🎖️</span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-xl font-bold">BDD Builder</h3>
            <span className="px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
              NEW
            </span>
            <span className="px-2 py-0.5 bg-red-500/80 text-white text-xs font-bold rounded-full">
              ACTIVE DUTY
            </span>
          </div>
          <p className="text-amber-100 max-w-2xl">
            <strong>Leaving the service?</strong> File your VA claim{" "}
            <strong>before</strong> you separate. The BDD program (38 CFR &sect;
            3.326) lets you claim <strong>180-90 days</strong> before discharge
            &mdash; benefits start Day 1 as a veteran.
          </p>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openBDDBuilder"))
            }
            className="px-6 py-3 bg-white text-amber-700 rounded-lg font-bold text-lg hover:bg-amber-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <span>🎖️</span>
            <span>Plan My BDD Claim</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PathfinderCta() {
  return (
    <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <span className="text-4xl">🧭</span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-xl font-bold">The Pathfinder</h3>
            <span className="px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
              AI STRATEGY
            </span>
          </div>
          <p className="text-teal-100 max-w-2xl">
            <strong>Your personal claims strategist.</strong> Enter your current
            ratings and let AI analyze your profile to suggest
            <strong> high-probability secondary claims</strong> you may be
            missing, with direct links to build your case. Like having a VSO in
            your pocket.
          </p>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openPathfinder"))
            }
            className="px-6 py-3 bg-white text-teal-700 rounded-lg font-bold text-lg hover:bg-teal-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <span>📊</span>
            <span>Analyze My Strategy</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MusterCallCta() {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-blue-900/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6 hover:shadow-xl transition-all mb-6">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse"></div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-blue-100 dark:bg-blue-800/50 rounded-xl p-3 flex-shrink-0">
            <span className="text-3xl">📋</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
              Muster Call
              <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
                NEW
              </span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                AI
              </span>
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                FREE
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <strong>Drop your entire VA file</strong> - 32+ claim letters,
              320MB C-File, poor-quality DD214s. AI analyzes everything,
              auto-populates your profile, and generates a comprehensive action
              plan. What would take weeks, done in minutes.
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("openMusterCall"))
          }
          className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap transform hover:-translate-y-0.5"
        >
          🎯 Answer the Call
        </button>
      </div>
    </div>
  );
}

function CFileAnalyzerCta() {
  return (
    <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-violet-50 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-violet-900/40 border-2 border-violet-300 dark:border-violet-700 rounded-xl p-6 hover:shadow-xl transition-all mb-6">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse"></div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-violet-100 dark:bg-violet-800/50 rounded-xl p-3 flex-shrink-0">
            <span className="text-3xl">🔬</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
              C-File AI Analyzer
              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                AI
              </span>
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                FREE
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <strong>What competitors charge $500+ for.</strong> Drop in your
              C-File (Claims File) and let AI analyze thousands of pages to find
              <strong>
                {" "}
                in-service events, diagnoses, and nexus evidence
              </strong>{" "}
              - all processed locally in your browser for maximum privacy.
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("openCFileAnalyzer"))
          }
          className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap transform hover:-translate-y-0.5"
        >
          🚀 Analyze My C-File
        </button>
      </div>
    </div>
  );
}

function BlueButtonXRayCta() {
  return (
    <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-violet-50 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-violet-900/40 border-2 border-violet-300 dark:border-violet-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">📋</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Blue Button X-Ray
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
            AI
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Instant Evidence Mining.</strong> Drop in your{" "}
        <strong>Blue Button</strong> from MyHealtheVet (instant download!) and
        find <strong>unclaimed diagnoses</strong> hiding in your records.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openBlueButtonXRay"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🔬 Scan My Records
      </button>
    </div>
  );
}

function WitnessBenchCta() {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 dark:from-purple-900/40 dark:via-violet-900/40 dark:to-fuchsia-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">👥</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            Witness Bench
            <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-full">
              NEW
            </span>
            <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded-full">
              AI
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Buddy Letter Wizard.</strong> Hand off to your{" "}
        <strong>spouse, friend, or battle buddy</strong>. AI asks the RIGHT
        questions to capture powerful <strong>witness evidence</strong>.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openWitnessBench"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        ✍️ Create Buddy Statement
      </button>
    </div>
  );
}

function FormsHelperCta() {
  return (
    <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/40 dark:to-indigo-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-purple-100 dark:bg-purple-800/50 rounded-lg p-2">
            <svg
              className="w-6 h-6 text-purple-600 dark:text-purple-400"
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
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              📋 Forms Helper
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                {getFormsCount()} FORMS
              </span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs rounded-full">
                AUTO-FILL
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Get guided help filling out VA forms, especially{" "}
              <strong>buddy statements</strong> - one of the most powerful but
              hardest-to-get forms of evidence!
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("openFormsHelper"))
          }
          className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          📝 Open Forms Helper
        </button>
      </div>
    </div>
  );
}

function RedTeamCta() {
  return (
    <div className="bg-gradient-to-br from-rose-50 via-red-50 to-rose-50 dark:from-rose-900/40 dark:via-red-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-3 shadow-lg flex-shrink-0">
          <span className="text-3xl">🎖️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Red Team
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold rounded-full">
            AI
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Statement Stress Test.</strong> Find weak language that&apos;s{" "}
        <strong>hurting your claim</strong> before the VA does. &quot;Tough
        guy&quot; language = denials.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openRedTeam"))}
        className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
      >
        🔍 Stress Test Statement
      </button>
    </div>
  );
}

function DecisionDecoderCta() {
  return (
    <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3 shadow-lg flex-shrink-0">
          <span className="text-3xl">🔓</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Decision Decoder
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
            AI
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Denial Translator.</strong> Got a confusing VA letter? Paste it
        in and get <strong>plain English</strong> + what&apos;s missing + next
        steps.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openDecisionDecoder"))
        }
        className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
      >
        🔓 Decode Decision
      </button>
    </div>
  );
}

function TimeMachineQCCta() {
  return (
    <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">⏰</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Time Machine
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
            ITF DEADLINE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Intent to File Tracker.</strong> Don&apos;t lose your effective
        date! Countdown timer + backpay calculator for your ITF deadline.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openTimeMachine"))}
        className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
      >
        ⏰ Track Deadline
      </button>
    </div>
  );
}

function SharkRadarCta() {
  return (
    <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/40 dark:to-red-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-3 shadow-lg flex-shrink-0">
          <span className="text-3xl">🦈</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Shark Radar
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold rounded-full">
            SCAM ALERT
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Before you sign ANYTHING!</strong> Paste contract or email text
        from &quot;VA consultants&quot; to scan for
        <strong> illegal fees, predatory practices, and scams</strong> based on
        38 CFR § 14.636.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openSharkRadar"))}
        className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
      >
        🔍 Scan Contract
      </button>
    </div>
  );
}

function EvidenceGapFinderCta() {
  return (
    <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 shadow-lg">
            <span className="text-4xl">🔗</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Evidence Gap Finder
            </h3>
            <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
              NEW
            </span>
            <span className="inline-block px-2 py-0.5 bg-rose-600 text-white text-xs font-bold rounded-full">
              CHECKLIST
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
            <strong>The Missing Link.</strong> See exactly what evidence
            you&apos;re <strong>missing</strong> for higher ratings. Interactive
            completeness gauge shows your gaps - fill them{" "}
            <strong>before</strong> submission. Now saves directly to My Packet!
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
              📋 Visual Checklist
            </span>
            <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
              📦 Save to Packet
            </span>
            <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
              🎯 Target Rating
            </span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openEvidenceGapVisualizer"))
            }
            className="px-8 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:from-rose-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            🔗 Find My Gaps
          </button>
        </div>
      </div>
    </div>
  );
}

function TDIUBuilderCta() {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">💼</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            TDIU Builder
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-full">
            💰 100%
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>The 100% Backdoor.</strong> Translate your symptoms into{" "}
        <strong>vocational language</strong> for VA Form 21-8940. Get paid at
        100% even with a 60-70% rating.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openTDIUBuilder"))}
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        📝 Build My TDIU Case
      </button>
    </div>
  );
}

function RiskCalculatorCta() {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🐻</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Risk Calculator
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
            DEFENSE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Don&apos;t Poke the Bear!</strong> Check 5-Year, 20-Year, and
        P&T protections <strong>BEFORE</strong> you file. Sharks push frivolous
        claims that <strong>trigger rating reductions</strong>.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openRiskAssessment"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        ⚖️ Check My Risk
      </button>
    </div>
  );
}

function SymptomLoggerCta() {
  return (
    <div className="relative bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-900/60 dark:via-yellow-900/50 dark:to-orange-900/60 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-8 hover:shadow-2xl transition-all overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-300/30 to-transparent rounded-full -translate-y-32 translate-x-32 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-300/20 to-transparent rounded-full translate-y-24 -translate-x-24 pointer-events-none"></div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 shadow-xl">
            <span className="text-5xl">📊</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">
              Symptom Logger
            </h3>
            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-full animate-pulse">
              ⭐ KEY TOOL
            </span>
          </div>
          <p className="text-lg text-gray-700 dark:text-gray-200 mb-4 leading-relaxed">
            <strong className="text-amber-700 dark:text-amber-400">
              The 50% Maker.
            </strong>{" "}
            Ratings for migraines, IBS, and GERD depend on{" "}
            <strong>frequency</strong>. Track every attack with severity,
            duration, and triggers. Export{" "}
            <strong>professional PDF evidence</strong> that proves your rating.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
            <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
              📅 Date/Time Tracking
            </span>
            <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
              📈 Severity Charts
            </span>
            <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
              📄 PDF Export
            </span>
            <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
              🎯 C&P Ready
            </span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openSymptomLogger"))
            }
            className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-bold text-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            📝 Start Logging
          </button>
        </div>
      </div>
    </div>
  );
}

function PACTActNavigatorCta() {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🔥</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            PACT Act Navigator
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
            HOT
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Skip the Nexus Letter.</strong> Check if your condition is{" "}
        <strong>presumptive</strong> under PACT Act - Agent Orange, burn pits,
        Gulf War, radiation. <strong>No proof needed.</strong>
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openPACTActNavigator"))
        }
        className="w-full px-4 py-3 min-h-[52px] bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🗺️ Check My Presumptives
      </button>
    </div>
  );
}

function FOIAKeysmithCta() {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🔑</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            The Keysmith
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
              NEW
            </span>
            <span className="px-2 py-0.5 bg-gray-700 text-white text-xs font-bold rounded-full">
              FOIA
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Unlock Your C-File.</strong> Generate a{" "}
        <strong>FOIA request</strong> for your complete VA claims file. See what
        VA used - and <strong>what they ignored</strong>.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openFOIAGenerator"))
        }
        className="w-full px-4 py-3 min-h-[52px] bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🔓 Generate FOIA Request
      </button>
    </div>
  );
}

function SomaticTargetCta() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🎯</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Somatic Target
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
            MAP
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Click, Don&apos;t Type.</strong> Interactive body map that
        translates your clicks into <strong>exact medical terminology</strong>.
        Turn &quot;My back hurts&quot; into proper diagnosis language.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openPainPainter"))}
        className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🎯 Map My Pain
      </button>
    </div>
  );
}

function WarGameCta() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">⚔️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            The War Game
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-700 text-white text-xs font-bold rounded-full">
            AI
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Red Team Your Claim.</strong> AI adopts a{" "}
        <strong>Skeptical C&P Examiner</strong> persona. Find weaknesses{" "}
        <strong>before</strong> the VA does. Practice tough questions now.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openClaimStressTest"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        ⚔️ Stress Test My Claim
      </button>
    </div>
  );
}

function ContinuityThreadCta() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🧵</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Continuity Thread
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
            TIMELINE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Visualize Your Nexus.</strong> Timeline shows evidence from
        service to now. Automatically flags{" "}
        <strong>dangerous gaps over 5 years</strong>. Fill them before it&apos;s
        too late.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openEvidenceTimeline"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🧵 Build My Timeline
      </button>
    </div>
  );
}

function TribunalCta() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">⚖️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            The Tribunal
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
            VOICE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Mock BVA Hearing.</strong> Voice-interactive simulator with AI
        judge asking tough questions. Practice before the real Board of
        Veterans&apos; Appeals.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openTheTribunal"))}
        className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        ⚖️ Start Mock Hearing
      </button>
    </div>
  );
}

function VSOFinderCta() {
  return (
    <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      {/* Decorative element */}
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🤝</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            VSO Finder
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full">
            FREE HELP
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>The Honest Broker.</strong> Find{" "}
        <strong>FREE, Accredited</strong> representation near you. Connect with
        County VSOs, DAV, VFW, and avoid{" "}
        <strong>&quot;Claim Sharks&quot;</strong> forever.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openVSOFinder"))}
        className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🔍 Find Free Help
      </button>
    </div>
  );
}

function StateBenefitHunterCta() {
  return (
    <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      {/* Decorative shimmer */}
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">💰</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            State Benefit Hunter
            <span className="px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full animate-pulse">
              $$$
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Money on the Table!</strong> Discover state-specific benefits
        many veterans miss:
        <strong>
          {" "}
          property tax exemptions, free vehicle registration, education grants,
        </strong>{" "}
        and more.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openStateBenefitHunter"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🎯 Find My State Benefits
      </button>
    </div>
  );
}

function LegislativeWatchdogCta() {
  return (
    <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">📡</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Legislative Watchdog
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full">
            38 CFR
          </span>
          <span className="inline-block px-2 py-0.5 bg-sky-600 text-white text-xs font-bold rounded-full">
            LIVE
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Track Rule Changes.</strong> Monitor Federal Register for
        updates to 38 CFR that affect your claim. Never miss a new presumptive
        condition.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openLegislativeWatchdog"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        📡 Watch Regulations
      </button>
    </div>
  );
}

function VAAITransparencyCta() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-900/40 dark:via-blue-900/40 dark:to-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🤖</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            VA AI Transparency
          </h3>
          <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold rounded-full">
            227 SYSTEMS
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Know How AI Affects You.</strong> Learn about VA&apos;s 227 AI
        systems: fraud detection, faster claims, health diagnostics, and your
        privacy protections.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openVAAITransparency"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🧠 Understand VA AI
      </button>
    </div>
  );
}

function MillionDollarDashboardCta() {
  return (
    <div className="relative bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 dark:from-yellow-900/40 dark:via-amber-900/40 dark:to-yellow-900/40 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">💰</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            Million Dollar Dashboard
            <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold rounded-full animate-pulse">
              WOW
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Your rating is worth MORE than you think.</strong> See your{" "}
        <strong>lifetime value</strong> - VA pay, property tax savings,
        education benefits, healthcare. Watch the number climb.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openMillionDollarDashboard"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-lg font-bold hover:from-yellow-600 hover:to-amber-600 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        💵 Show Me The Money
      </button>
    </div>
  );
}

function MOSHazardMatcherCta() {
  return (
    <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🎖️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            MOS Hazard Matcher
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold rounded-full">
              JOB→INJURY
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>Your MOS broke your body.</strong> Enter your job code, see{" "}
        <strong>what injuries that job causes</strong>. Hearing loss? Back pain?{" "}
        <strong>It&apos;s not just you - it&apos;s the job.</strong>
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openMOSHazardMatcher"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded-lg font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🔍 Match My MOS
      </button>
    </div>
  );
}

function WebOfConditionsCta() {
  return (
    <div className="relative bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/40 dark:via-amber-900/40 dark:to-orange-900/40 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">🕸️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            Web of Conditions
            <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded-full">
              INTERACTIVE
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>See how conditions connect.</strong> Interactive node map -
        click a condition, watch secondaries <strong>orbit around it</strong>.
        Click a link, see the medical nexus.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openWebOfConditions"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-bold hover:from-yellow-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        🗺️ Explore The Web
      </button>
    </div>
  );
}

function RetroPayHunterCta() {
  return (
    <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

      <div className="flex items-center justify-center gap-4 mb-4 flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
          <span className="text-3xl">⏰</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
            Retro Pay Hunter
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold rounded-full animate-pulse">
              💰 MONEY
            </span>
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
        <strong>The Time Machine.</strong> Find missed back pay from{" "}
        <strong>rating history errors</strong>. Check for CUE claims, missing
        bilateral factors, and underpayments.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openRetroPayHunter"))
        }
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded-lg font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg mt-auto"
      >
        💰 Hunt My Back Pay
      </button>
    </div>
  );
}

function EssentialToolsSection() {
  return (
    <>
      {/* SECTION 1: ESSENTIAL TOOLS - What Everyone Needs First */}
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
        ⚡ Essential Tools
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Start here - calculate your rating and organize your claims
      </p>

      {/* TACTICAL CALCULATOR - THE Core Feature */}
      <div className="mb-6">
        <TacticalCalculatorCta />
      </div>
    </>
  );
}

function DiscoverClaimsSection() {
  return (
    <>
      {/* SECTION 2: DISCOVER YOUR CLAIMS - Teal Theme */}
      <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-300 text-center mb-2 mt-12">
        🔍 Discover Your Claims
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Find secondary conditions, practice for exams, and strategize your
        approach
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Secondary Scout CTA */}
        <SecondaryScoutCta />

        {/* C&P Simulator CTA */}
        <CPSimulatorCta />
      </div>

      {/* BDD Builder CTA - Active Duty Transitioning */}
      <div className="mt-6">
        <BDDBuilderCta />
      </div>

      {/* Pathfinder CTA - Full Width Featured - Teal Theme for Discover Section */}
      <div className="mt-6">
        <PathfinderCta />
      </div>
    </>
  );
}

function BuildEvidenceSection() {
  return (
    <>
      {/* SECTION 3: BUILD YOUR EVIDENCE - Violet Theme */}
      <h2 className="text-2xl font-bold text-violet-700 dark:text-violet-300 text-center mb-2 mt-12">
        📋 Build Your Evidence
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Gather medical records, fill out forms, and create supporting statements
      </p>

      {/* Muster Call CTA - Full Width - Featured */}
      <MusterCallCta />

      {/* C-File Analyzer CTA - Full Width - Featured */}
      <CFileAnalyzerCta />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blue Button X-Ray CTA */}
        <BlueButtonXRayCta />

        {/* Witness Bench CTA */}
        <WitnessBenchCta />
      </div>

      {/* Forms Helper CTA - Full Width */}
      <FormsHelperCta />
    </>
  );
}

function QualityControlSection() {
  return (
    <>
      {/* SECTION 4: QUALITY CONTROL - Rose Theme */}
      <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-300 text-center mb-2 mt-12">
        ✅ Quality Control
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Review your work, decode VA decisions, and protect yourself from scams
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Red Team CTA */}
        <RedTeamCta />

        {/* Decision Decoder CTA */}
        <DecisionDecoderCta />

        {/* Time Machine CTA */}
        <TimeMachineQCCta />

        {/* Shark Radar CTA */}
        <SharkRadarCta />
      </div>

      {/* Evidence Gap Visualizer - Full Width Rose theme continuation */}
      <div className="mt-6">
        {/* Evidence Gap Visualizer CTA - Full Width */}
        <EvidenceGapFinderCta />
      </div>
    </>
  );
}

function MaximizeRatingSection() {
  return (
    <>
      {/* SECTION 5: MAXIMIZE YOUR RATING - Amber Theme */}
      <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-300 text-center mb-2 mt-12">
        💰 Maximize Your Rating
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Get every dollar you deserve - TDIU, PACT Act, and strategic claims
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TDIU Work Impact Builder CTA */}
        <TDIUBuilderCta />

        {/* Poke the Bear Calculator CTA */}
        <RiskCalculatorCta />
      </div>

      {/* FEATURED: Symptom Logger - Prominent Full-Width Card */}
      <div className="mt-6 mb-6">
        <SymptomLoggerCta />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PACT Act Navigator CTA */}
        <PACTActNavigatorCta />

        {/* FOIA Keysmith CTA */}
        <FOIAKeysmithCta />
      </div>
    </>
  );
}

function ForceMultipliersSection() {
  return (
    <>
      {/* SECTION 6: FORCE MULTIPLIERS - Slate Theme */}
      <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 text-center mb-2 mt-12">
        ⚔️ Force Multipliers
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Advanced simulators and interactive tools that transform how you build
        your claim
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Somatic Target - Body Map CTA */}
        <SomaticTargetCta />

        {/* War Game - Red Team Simulator CTA */}
        <WarGameCta />

        {/* Continuity Thread - Timeline CTA */}
        <ContinuityThreadCta />

        {/* The Tribunal CTA */}
        <TribunalCta />
      </div>
    </>
  );
}

function SupportResourcesSection() {
  return (
    <>
      {/* SECTION 7: SUPPORT & RESOURCES - Sky Theme */}
      <h2 className="text-2xl font-bold text-sky-700 dark:text-sky-300 text-center mb-2 mt-12">
        🤝 Support & Resources
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Find free representation, track VA rule changes, understand VA&apos;s AI
        systems, and unlock state-specific benefits
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* VSO Finder CTA */}
        <VSOFinderCta />

        {/* State Benefit Hunter CTA */}
        <StateBenefitHunterCta />

        {/* Legislative Watchdog CTA */}
        <LegislativeWatchdogCta />

        {/* VA AI Transparency Hub CTA */}
        <VAAITransparencyCta />
      </div>
    </>
  );
}

function ShockAweSection() {
  return (
    <div className="mt-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 bg-clip-text text-transparent">
          💎 SHOCK & AWE TOOLS 💎
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Premium visualizations that make you say &quot;Whoa&quot;
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Million Dollar Dashboard - Gold/Yellow Theme */}
        <MillionDollarDashboardCta />

        {/* MOS Hazard Matcher - Gold/Yellow Theme */}
        <MOSHazardMatcherCta />

        {/* Web of Conditions - Gold/Yellow Theme */}
        <WebOfConditionsCta />

        {/* Retro Pay Hunter - Gold/Yellow Theme */}
        <RetroPayHunterCta />
      </div>
    </div>
  );
}

/**
 * Home page feature CTAs — the long marketing/launch grid that lives
 * inside <main>: Essential Tools, Discover Your Claims, Build Your
 * Evidence, Quality Control, Maximize Your Rating, etc.
 *
 * Pure presentational JSX. Every CTA fires its target tool via a
 * window CustomEvent dispatch, so the block has no props and no
 * state — just two utility imports (getFormsCount + Disclaimer).
 *
 * Extracted from App.jsx (audit #35, B65).
 */
export default function HomeFeatureCards() {
  return (
    <div className="mt-12 max-w-4xl mx-auto">
      <EssentialToolsSection />
      <DiscoverClaimsSection />
      <BuildEvidenceSection />
      <QualityControlSection />
      <MaximizeRatingSection />
      <ForceMultipliersSection />
      <SupportResourcesSection />
      <ShockAweSection />

      {/* Compact Disclaimer */}
      <Disclaimer compact />
    </div>
  );
}
