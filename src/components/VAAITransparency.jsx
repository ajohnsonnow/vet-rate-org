import React, { useState } from 'react';
import { X, ExternalLink, Info, Shield, Brain, AlertCircle, CheckCircle, Lock, Activity, FileText, Users, TrendingUp, Eye, MessageCircle, Scale } from 'lucide-react';
import ReportBugLink from './ReportBugLink';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

/**
 * VAAITransparency Component
 * 
 * Educates veterans about how the VA uses AI in their benefits and healthcare.
 * Provides transparency about VA's 227 AI use cases, governance, privacy protections,
 * and how AI systems impact veteran services. Based on official VA AI documentation
 * from department.va.gov/ai/
 */
const VAAITransparency = ({ onClose }) => {
  useBodyScrollLock(true);
  
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'healthcare', label: 'Healthcare AI', icon: Activity },
    { id: 'benefits', label: 'Benefits AI', icon: FileText },
    { id: 'privacy', label: 'Privacy & Rights', icon: Lock },
    { id: 'inventory', label: 'Full Inventory', icon: Eye }
  ];

  const highImpactAISystems = [
    {
      name: 'STORM (Opioid Overdose Risk)',
      category: 'Healthcare',
      description: 'AI system that identifies Veterans at risk of opioid overdose and provides clinical decision support.',
      impact: '22% decrease in mortality for Veterans prescribed opioids',
      status: 'Active',
      riskLevel: 'High-Impact',
      veteranBenefit: 'Helps your care team identify and mitigate overdose risks proactively'
    },
    {
      name: 'AI-Assisted Colonoscopy',
      category: 'Healthcare',
      description: 'Computer vision AI that helps doctors detect polyps and tumors during colonoscopy procedures.',
      impact: '21% increase in adenoma detection, reducing cancer risk',
      status: 'Active',
      riskLevel: 'High-Impact',
      veteranBenefit: 'Improves early cancer detection during your colonoscopy'
    },
    {
      name: 'Payment Fraud Detection',
      category: 'Benefits',
      description: 'AI model that identifies potentially fraudulent direct deposit changes to protect veteran benefits.',
      impact: 'Detects 1-2 fraudulent changes per 1,000 transactions',
      status: 'Active',
      riskLevel: 'High-Impact',
      veteranBenefit: 'Protects your benefit payments from identity theft and fraud'
    },
    {
      name: 'Ambient AI Clinical Scribe',
      category: 'Healthcare',
      description: 'AI that transcribes doctor-patient conversations and auto-generates clinical notes in real-time.',
      impact: 'Reduces documentation burden, increases face-to-face time with patients',
      status: 'Pilot',
      riskLevel: 'High-Impact',
      veteranBenefit: 'Your doctor can focus more on you instead of typing notes'
    },
    {
      name: 'Claims Document Classification',
      category: 'Benefits',
      description: 'AI that automatically organizes and routes documents in disability claims for faster processing.',
      impact: 'Accelerates document processing, supports "minutes not months" goal',
      status: 'Active',
      riskLevel: 'Moderate-Impact',
      veteranBenefit: 'Speeds up your disability claim processing time'
    }
  ];

  const governanceProtections = [
    {
      title: 'OMB M-25-21 Compliance',
      description: 'VA follows federal AI requirements including risk assessments, testing, and monitoring for all high-impact AI systems.',
      icon: Shield
    },
    {
      title: 'Human Oversight Required',
      description: 'All high-impact AI decisions require human review. AI assists VA staff but doesn\'t make final decisions alone.',
      icon: Users
    },
    {
      title: 'Trustworthy AI Framework',
      description: 'VA\'s AI systems must be fair, accountable, transparent, and respect privacy - adopted July 2023.',
      icon: CheckCircle
    },
    {
      title: 'Public Inventory',
      description: 'VA publishes all 227 AI use cases publicly, updated annually for full transparency.',
      icon: Eye
    },
    {
      title: 'No Unapproved Data Sharing',
      description: 'Your PII and health data can only be used with VA-approved AI tools that have passed security reviews.',
      icon: Lock
    },
    {
      title: 'AI Ethics Toolkit',
      description: 'VA uses an AI Ethics Assessment Tool to anticipate and mitigate risks to veteran rights and safety.',
      icon: Scale
    }
  ];

  const aiWorkflowsByAdministration = {
    vha: [
      'Clinical documentation generation (inpatient & outpatient)',
      'Care in the Community document retrieval and summarization',
      'Surveillance for latent health status changes requiring treatment',
      'Clinician-facing information retrieval to reduce chart review time',
      'Burial scheduling knowledge support and regulation interpretation (NCA)',
      'Automatic retrieval of burial eligibility documents (NCA)'
    ],
    vba: [
      'Eligibility determination for benefits programs',
      'Document retrieval, classification, and preliminary adjudication',
      'Data discretization and summarization for claims'
    ],
    veo: [
      'AI-powered virtual assistants and chatbots for routine inquiries',
      'AI-assisted identity verification to prevent fraud',
      'Quality assurance and monitoring for call centers',
      'Automated documentation to reduce agent administrative burden'
    ]
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border-2 border-blue-300 dark:border-blue-700">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500 rounded-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
              How VA Uses AI in Your Care & Benefits
            </h3>
            <p className="text-blue-800 dark:text-blue-200 text-lg leading-relaxed">
              The VA uses <strong>227 artificial intelligence systems</strong> to improve veteran healthcare, 
              speed up disability claims, detect fraud, and reduce administrative burden. This transparency 
              hub explains how these AI tools work, how they affect you, and how your data is protected.
            </p>
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-300 dark:border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">227</div>
          </div>
          <div className="text-sm text-green-800 dark:text-green-200">AI Use Cases at VA</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-300 dark:border-purple-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">100K+</div>
          </div>
          <div className="text-sm text-purple-800 dark:text-purple-200">VA Employees Using VA GPT</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">100%</div>
          </div>
          <div className="text-sm text-amber-800 dark:text-amber-200">High-Impact AI Systems Monitored</div>
        </div>
      </div>

      {/* VA's AI Vision */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700">
        <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          VA's AI Vision
        </h4>
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <p className="leading-relaxed">
            <strong className="text-blue-600 dark:text-blue-400">For Veterans:</strong> AI-powered digital assistants 
            for scheduling appointments and submitting forms, faster claim processing ("minutes not months"), 
            and improved healthcare diagnosis and treatment recommendations.
          </p>
          <p className="leading-relaxed">
            <strong className="text-green-600 dark:text-green-400">For Healthcare:</strong> Real-time transcription 
            of doctor visits, auto-generated clinical notes, suggested billing codes, and evidence-based treatment 
            recommendations - letting doctors focus on patient care instead of paperwork.
          </p>
          <p className="leading-relaxed">
            <strong className="text-purple-600 dark:text-purple-400">For Claims:</strong> Automated document intake, 
            classification, and preliminary adjudication to deliver benefits faster with fewer errors.
          </p>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <strong>Important:</strong> All high-impact AI systems that affect your healthcare or benefits require 
            human review and oversight. AI assists VA staff but does not make final decisions about your care or 
            claims on its own.
          </div>
        </div>
      </div>
    </div>
  );

  const renderHealthcareAI = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-teal-300 dark:border-teal-700">
        <h4 className="text-xl font-bold text-teal-900 dark:text-teal-100 mb-4 flex items-center gap-2">
          <Activity className="h-6 w-6 text-teal-500" />
          Healthcare AI Systems at VA
        </h4>
        <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          VA uses AI to improve diagnosis, reduce medical errors, identify health risks early, 
          and reduce the time doctors spend on paperwork. Here are the major healthcare AI systems:
        </p>

        <div className="space-y-4">
          {highImpactAISystems.filter(sys => sys.category === 'Healthcare').map((system, idx) => (
            <div key={idx} className="border-2 border-teal-200 dark:border-teal-800 rounded-lg p-5 bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/20 dark:to-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="text-lg font-bold text-gray-900 dark:text-gray-100">{system.name}</h5>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      system.status === 'Active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                      {system.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {system.riskLevel}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{system.description}</p>
              <div className="bg-teal-100 dark:bg-teal-900/30 p-3 rounded-lg mb-3">
                <div className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1">Impact:</div>
                <div className="text-sm text-teal-800 dark:text-teal-200">{system.impact}</div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>How This Helps You:</strong> {system.veteranBenefit}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VHA AI Workflows */}
        <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-lg border border-teal-300 dark:border-teal-700">
          <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Other Healthcare AI Initiatives:</h5>
          <ul className="space-y-2">
            {aiWorkflowsByAdministration.vha.map((workflow, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="h-4 w-4 text-teal-500 flex-shrink-0 mt-0.5" />
                <span>{workflow}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderBenefitsAI = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-blue-300 dark:border-blue-700">
        <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-500" />
          Benefits & Claims AI Systems
        </h4>
        <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          VA uses AI to speed up disability claims processing, detect fraud, automate document organization, 
          and assist with eligibility determinations - all while maintaining human oversight.
        </p>

        <div className="space-y-4">
          {highImpactAISystems.filter(sys => sys.category === 'Benefits').map((system, idx) => (
            <div key={idx} className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-5 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="text-lg font-bold text-gray-900 dark:text-gray-100">{system.name}</h5>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      system.status === 'Active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                      {system.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {system.riskLevel}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{system.description}</p>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg mb-3">
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Impact:</div>
                <div className="text-sm text-blue-800 dark:text-blue-200">{system.impact}</div>
              </div>
              <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900 dark:text-green-100">
                  <strong>How This Helps You:</strong> {system.veteranBenefit}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VBA & VEO AI Workflows */}
        <div className="mt-6 space-y-4">
          <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
            <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3">VBA (Benefits) AI Initiatives:</h5>
            <ul className="space-y-2">
              {aiWorkflowsByAdministration.vba.map((workflow, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>{workflow}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-300 dark:border-purple-700">
            <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3">VEO (Veteran Experience) AI Initiatives:</h5>
            <ul className="space-y-2">
              {aiWorkflowsByAdministration.veo.map((workflow, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>{workflow}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* VA GPT Statistics */}
        <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-lg border-2 border-green-300 dark:border-green-700">
          <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            VA GPT: Internal AI Assistant
          </h5>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
            100,000+ VA employees use VA GPT (secure generative AI) to draft emails, summarize documents, 
            and improve efficiency. Survey results show:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">2-3 hours</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Saved per week per user</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">70%</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Report improved job satisfaction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-red-300 dark:border-red-700">
        <h4 className="text-xl font-bold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
          <Lock className="h-6 w-6 text-red-500" />
          Your Privacy & Rights with VA AI
        </h4>
        <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          VA takes veteran privacy seriously. All AI systems must pass rigorous security reviews 
          and follow strict federal requirements. Here's how your data is protected:
        </p>

        <div className="space-y-4">
          {governanceProtections.map((protection, idx) => (
            <div key={idx} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <protection.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{protection.title}</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{protection.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* High-Impact AI Requirements */}
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-lg border-2 border-purple-300 dark:border-purple-700">
          <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3">High-Impact AI Safety Requirements:</h5>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <span><strong>Impact Assessments:</strong> Required before deployment to identify potential risks</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <span><strong>Continuous Monitoring:</strong> Performance tracked to detect bias, errors, or safety issues</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <span><strong>Testing & Validation:</strong> AI systems tested against diverse data to ensure accuracy</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <span><strong>Right to Appeal:</strong> Veterans can challenge AI-assisted decisions through normal VA appeals</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <span><strong>Termination Authority:</strong> Non-compliant AI systems can be shut down immediately</span>
            </div>
          </div>
        </div>

        {/* Generative AI Guidance */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg">
          <h5 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            VA's Generative AI Policy
          </h5>
          <div className="space-y-2 text-sm text-yellow-900 dark:text-yellow-100">
            <p>✅ <strong>Approved Tools:</strong> VA staff use VA GPT and Microsoft Copilot (approved for sensitive data)</p>
            <p>❌ <strong>Prohibited Tools:</strong> Public AI tools (ChatGPT, Claude, Gemini) are NOT approved for veteran PII/PHI</p>
            <p>🔒 <strong>Your Data Protection:</strong> Your personal and health information can only be used with VA-approved, 
            security-cleared AI tools</p>
            <p>✔️ <strong>Human Accountability:</strong> VA staff are responsible for verifying all AI-generated content for accuracy</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-indigo-300 dark:border-indigo-700">
        <h4 className="text-xl font-bold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2">
          <Eye className="h-6 w-6 text-indigo-500" />
          Full VA AI Use Case Inventory
        </h4>
        
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 mb-6">
          <div className="flex items-start gap-4">
            <FileText className="h-12 w-12 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <div>
              <h5 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">227 AI Systems in VA's Public Inventory</h5>
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                VA publishes a comprehensive inventory of all artificial intelligence use cases across the department. 
                This includes system descriptions, risk levels, administrations, and governance status. Updated annually 
                as of December 2024.
              </p>
              <a 
                href="https://department.va.gov/ai/ai-use-case-inventory/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
              >
                View Full AI Inventory
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Download Excel Inventory */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-lg border-2 border-gray-200 dark:border-gray-700 mb-6">
          <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            Download Excel Spreadsheet
          </h5>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Download the full inventory as an Excel file for offline review and analysis (96KB, updated December 2024):
          </p>
          <a 
            href="https://department.va.gov/ai/wp-content/uploads/sites/26/2024/12/AI-Use-Case-Inventory-VA_BULK-UPLOAD-For-Website_Last-Update-12-16-2024.xlsx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            <FileText className="h-4 w-4" />
            Download AI Inventory (.xlsx)
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Inventory Highlights */}
        <div className="space-y-4">
          <h5 className="font-bold text-gray-900 dark:text-gray-100">Inventory Categories:</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-300 dark:border-teal-700">
              <div className="font-bold text-teal-900 dark:text-teal-100 mb-2">Healthcare Innovation</div>
              <div className="text-sm text-teal-800 dark:text-teal-200">
                21% increase in colonoscopy detection, STORM opioid risk model, ambient AI scribes, 
                clinical documentation, health surveillance
              </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
              <div className="font-bold text-blue-900 dark:text-blue-100 mb-2">Administrative Efficiency</div>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                40K+ users on VA GPT, GitHub Copilot for developers, Teams Premium, document summarization
              </div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
              <div className="font-bold text-red-900 dark:text-red-100 mb-2">Fraud Detection</div>
              <div className="text-sm text-red-800 dark:text-red-200">
                Payment redirect fraud model identifying 1-2 fraudulent changes per 1,000 transactions
              </div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-300 dark:border-purple-700">
              <div className="font-bold text-purple-900 dark:text-purple-100 mb-2">Claims Processing</div>
              <div className="text-sm text-purple-800 dark:text-purple-200">
                Document classification, eligibility determination, automated adjudication support
              </div>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mt-6 space-y-3">
          <h5 className="font-bold text-gray-900 dark:text-gray-100">More VA AI Resources:</h5>
          <a 
            href="https://department.va.gov/ai/building-the-future-vas-strategy-for-adopting-high-impact-artificial-intelligence-to-improve-services-for-veterans/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700 transition-colors"
          >
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <div className="font-semibold text-blue-900 dark:text-blue-100">VA AI Strategy Document</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">VA's 5 priority areas for AI adoption</div>
            </div>
            <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </a>

          <a 
            href="https://department.va.gov/ai/department-of-veterans-affairs-compliance-plan-for-omb-memorandum-m-25-21/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg border border-purple-300 dark:border-purple-700 transition-colors"
          >
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div className="flex-1">
              <div className="font-semibold text-purple-900 dark:text-purple-100">OMB M-25-21 Compliance Plan</div>
              <div className="text-sm text-purple-700 dark:text-purple-300">How VA meets federal AI requirements</div>
            </div>
            <ExternalLink className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </a>

          <a 
            href="https://department.va.gov/ai/guidance-for-generative-ai-use-at-va/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700 transition-colors"
          >
            <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <div className="font-semibold text-green-900 dark:text-green-100">Generative AI Guidance</div>
              <div className="text-sm text-green-700 dark:text-green-300">VA's policies for AI chatbot usage</div>
            </div>
            <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400" />
          </a>

          <a 
            href="https://department.va.gov/ai/wp-content/uploads/sites/26/2024/11/VA-Artificial-Intelligience-AI-Workforce-Resources-Blueprint-11.19.2024-1.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-700 transition-colors"
          >
            <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              <div className="font-semibold text-orange-900 dark:text-orange-100">AI Workforce Blueprint (PDF)</div>
              <div className="text-sm text-orange-700 dark:text-orange-300">How VA is training staff for AI</div>
            </div>
            <ExternalLink className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </a>
        </div>

        {/* Feedback Link */}
        <div className="mt-6 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 p-5 rounded-lg border-2 border-sky-300 dark:border-sky-700">
          <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            Provide Feedback to VA
          </h5>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Have concerns or questions about VA's AI systems? The VA AI team collects feedback to improve transparency 
            and address veteran concerns.
          </p>
          <a 
            href="https://department.va.gov/ai/ai-use-case-inventory/#connect-and-collaborate-with-us"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold transition-colors"
          >
            Submit Feedback to VA
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">VA AI Transparency Hub</h2>
                <p className="text-blue-100 text-sm mt-1">Understanding How VA Uses Artificial Intelligence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'healthcare' && renderHealthcareAI()}
          {activeTab === 'benefits' && renderBenefitsAI()}
          {activeTab === 'privacy' && renderPrivacy()}
          {activeTab === 'inventory' && renderInventory()}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 p-4 rounded-b-lg border-t border-gray-300 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Data from <a href="https://department.va.gov/ai/" target="_blank" rel="noopener noreferrer" 
                className="text-blue-600 dark:text-blue-400 hover:underline">department.va.gov/ai/</a> (Updated January 2026)
            </div>
            <div className="flex items-center gap-3">
              <ReportBugLink />
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VAAITransparency;
