import React, { useState } from 'react';
import { X, ExternalLink, Phone, AlertTriangle, Shield, Heart, Brain, Home, Users, Briefcase, Calendar, ChevronDown, ChevronUp, Leaf, Globe, Award } from 'lucide-react';
import ReportBugLink from './ReportBugLink';

/**
 * VAResources Component
 * 
 * Comprehensive VA resources hub providing veterans with direct links to
 * official VA programs, services, and support systems including PACT Act
 * information, environmental exposure assessments, mental health resources,
 * and specialized veteran programs.
 */
const VAResources = ({ onClose, onReportBug }) => {
  const [expandedSections, setExpandedSections] = useState({
    pactAct: true,
    exposures: false,
    mentalHealth: false,
    specializedPrograms: false,
    healthCare: false,
    benefits: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resourceCategories = [
    {
      id: 'pactAct',
      title: 'PACT Act & Toxic Exposure Benefits',
      icon: <Shield className="h-6 w-6" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      description: 'The largest expansion of VA health care and benefits in history',
      highlight: true,
      resources: [
        {
          name: 'PACT Act Overview',
          url: 'https://www.va.gov/resources/the-pact-act-and-your-va-benefits/',
          description: 'Learn about eligibility, presumptive conditions, and how to file claims',
          phone: '800-698-2411',
          important: true
        },
        {
          name: 'File a Disability Claim',
          url: 'https://www.va.gov/disability/file-disability-claim-form-21-526ez/',
          description: 'Submit your PACT Act-related disability claim online',
          important: true
        },
        {
          name: 'Apply for VA Health Care',
          url: 'https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/',
          description: 'Expanded eligibility under PACT Act - apply now',
          important: true
        },
        {
          name: 'PACT Act Performance Dashboard',
          url: 'https://department.va.gov/pactdata/',
          description: 'Track VA\'s progress on PACT Act implementation'
        },
        {
          name: 'Camp Lejeune Water Contamination',
          url: 'https://www.va.gov/disability/eligibility/hazardous-materials-exposure/camp-lejeune-water-contamination',
          description: 'Information for veterans exposed to contaminated water at Camp Lejeune'
        }
      ],
      keyInfo: [
        'Adds 20+ presumptive conditions for burn pits, Agent Orange, and toxic exposures',
        'Expands eligibility for Vietnam, Gulf War, and post-9/11 Veterans',
        'No need to prove service connection for presumptive conditions',
        'Free toxic exposure screening for all enrolled Veterans'
      ]
    },
    {
      id: 'exposures',
      title: 'Military Environmental Exposures',
      icon: <Leaf className="h-6 w-6" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      description: 'Information about toxic exposures and health assessments',
      resources: [
        {
          name: 'Military Exposures Overview',
          url: 'https://www.publichealth.va.gov/exposures/index.asp',
          description: 'Comprehensive information on chemical, physical, and environmental hazards'
        },
        {
          name: 'Military Environmental Exposures Assessment (MEEA)',
          url: 'https://www.publichealth.va.gov/MEEA/index.asp',
          description: 'Free 60-minute evaluation for exposure-related health concerns',
          important: true
        },
        {
          name: 'VET-HOME Telehealth MEEAs',
          url: 'https://vethome.va.gov/',
          description: 'Free telehealth assessments available nationwide',
          phone: '833-633-8846'
        },
        {
          name: 'Agent Orange Information',
          url: 'https://www.publichealth.va.gov/exposures/agentorange/conditions/index.asp',
          description: 'Agent Orange related diseases and presumptive locations'
        },
        {
          name: 'Gulf War Veterans\' Illnesses',
          url: 'https://www.publichealth.va.gov/exposures/gulfwar/index.asp',
          description: 'Information for Gulf War era Veterans'
        },
        {
          name: 'Burn Pit & Airborne Hazards',
          url: 'https://www.publichealth.va.gov/exposures/burnpits/index.asp',
          description: 'Health information for burn pit and airborne hazard exposure',
          important: true
        },
        {
          name: 'Airborne Hazards and Open Burn Pit Registry',
          url: 'https://www.publichealth.va.gov/exposures/burnpits/registry.asp',
          description: 'Register your exposure and track health over time - helps VA research'
        },
        {
          name: 'Environmental Health Coordinators',
          url: 'https://www.publichealth.va.gov/exposures/coordinators.asp',
          description: 'Find your local Environmental Health Coordinator'
        }
      ],
      keyInfo: [
        'Toxic Exposure Screening (TES) every 5 years for enrolled Veterans',
        'MEEA is not required for disability claims but can support them',
        'Exposure categories: chemicals, radiation, air pollutants, warfare agents',
        'Wars covered: Vietnam, Gulf War, Iraq, Afghanistan, and more'
      ]
    },
    {
      id: 'mentalHealth',
      title: 'Mental Health & PTSD',
      icon: <Brain className="h-6 w-6" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      description: '24/7 crisis support and comprehensive mental health services',
      resources: [
        {
          name: 'Veterans Crisis Line',
          url: 'https://www.veteranscrisisline.net/',
          description: 'Immediate crisis support available 24/7',
          phone: '988 (Press 1)',
          urgent: true
        },
        {
          name: 'VA Mental Health Services',
          url: 'https://www.mentalhealth.va.gov/',
          description: 'Treatment options, resources, and appointment information'
        },
        {
          name: 'PTSD: National Center for PTSD',
          url: 'https://www.ptsd.va.gov/',
          description: 'World\'s leading research and educational center on PTSD',
          important: true
        },
        {
          name: 'PTSD Treatment Decision Aid',
          url: 'https://www.ptsd.va.gov/apps/decisionaid/',
          description: 'Interactive tool to explore treatment options'
        },
        {
          name: 'AboutFace - Veteran Stories',
          url: 'https://www.ptsd.va.gov/apps/aboutface/',
          description: 'Videos of Veterans sharing their PTSD experiences'
        },
        {
          name: 'Make the Connection',
          url: 'https://www.maketheconnection.net/',
          description: 'Veteran stories and resources for mental health'
        },
        {
          name: 'Military Sexual Trauma (MST)',
          url: 'https://www.mentalhealth.va.gov/msthome/index.asp',
          description: 'Support and treatment for survivors of MST'
        },
        {
          name: 'Substance Use Treatment',
          url: 'https://www.mentalhealth.va.gov/substance-use/index.asp',
          description: 'Help for substance use disorders'
        }
      ],
      keyInfo: [
        'No copays for first 3 outpatient mental health visits per year (through 2027)',
        'PTSD and MST treatment available even without discharge upgrade',
        'Telehealth and in-person options available',
        'Effective treatments include CPT, PE, and EMDR therapy'
      ]
    },
    {
      id: 'specializedPrograms',
      title: 'Specialized Veteran Programs',
      icon: <Users className="h-6 w-6" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      description: 'Programs for specific veteran populations and needs',
      resources: [
        {
          name: 'Homeless Veterans Programs',
          url: 'https://www.va.gov/homeless/',
          description: 'Housing assistance, outreach, and support services',
          phone: '877-424-3838',
          important: true
        },
        {
          name: 'Center for Women Veterans',
          url: 'https://www.va.gov/womenvet/',
          description: 'Benefits, services, and resources for women Veterans',
          phone: '855-829-6636'
        },
        {
          name: 'Center for Minority Veterans',
          url: 'https://www.va.gov/centerforminorityveterans/',
          description: 'Advocacy and outreach for minority Veterans'
        },
        {
          name: 'Adaptive Sports & Special Events',
          url: 'https://department.va.gov/veteran-sports/',
          description: 'Paralympic sports, events, and recreation programs'
        },
        {
          name: 'Veteran Small Business Programs',
          url: 'https://www.va.gov/osdbu/',
          description: 'Support for Veteran-owned small businesses'
        },
        {
          name: 'National Resource Directory',
          url: 'https://nrd.gov/',
          description: 'DoD/VA comprehensive database connecting service members, veterans, families, and caregivers to 10,000+ vetted resources nationwide',
          important: true
        }
      ]
    },
    {
      id: 'healthCare',
      title: 'Health Care & Eligibility',
      icon: <Heart className="h-6 w-6" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      description: 'Apply for VA health care and understand eligibility',
      resources: [
        {
          name: 'Health Care Eligibility',
          url: 'https://www.va.gov/health-care/eligibility/',
          description: 'Find out if you qualify for VA health care'
        },
        {
          name: 'Apply for Health Care',
          url: 'https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/',
          description: 'Submit your application online',
          important: true
        },
        {
          name: 'Priority Groups',
          url: 'https://www.va.gov/health-care/eligibility/priority-groups',
          description: 'Understand how priority groups affect your benefits'
        },
        {
          name: 'VA Health Care Access & Quality',
          url: 'https://www.accesstocare.va.gov/',
          description: 'Compare wait times and quality at VA facilities'
        },
        {
          name: 'Find a VA Location',
          url: 'https://www.va.gov/find-locations/',
          description: 'Locate VA medical centers, clinics, and Vet Centers'
        },
        {
          name: 'My HealtheVet',
          url: 'https://www.va.gov/my-health/',
          description: 'Manage your health care and prescriptions online'
        }
      ],
      keyInfo: [
        'Expanded eligibility for toxic exposure Veterans under PACT Act',
        '10-year enhanced eligibility for combat Veterans',
        'No enrollment fee for VA health care',
        'Copays may be waived based on disability rating or income'
      ]
    },
    {
      id: 'benefits',
      title: 'Benefits & Support',
      icon: <Briefcase className="h-6 w-6" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      description: 'Disability compensation, education, housing, and more',
      resources: [
        {
          name: 'VA Outreach Events',
          url: 'https://www.va.gov/outreach-and-events/events/',
          description: 'Find VA events and town halls near you'
        },
        {
          name: 'Get Help from a VSO',
          url: 'https://www.va.gov/get-help-from-accredited-representative',
          description: 'Free help filing claims from accredited representatives'
        },
        {
          name: 'VA Forms',
          url: 'https://www.va.gov/forms/',
          description: 'Find and download official VA forms'
        },
        {
          name: 'VA Mobile Apps',
          url: 'https://www.mobile.va.gov/appstore/',
          description: 'Official VA apps for managing benefits'
        },
        {
          name: 'State VA Offices',
          url: 'https://department.va.gov/about/state-departments-of-veterans-affairs-office-locations/',
          description: 'Find your state Veterans Affairs office'
        },
        {
          name: 'Your VA Welcome Kit',
          url: 'https://www.va.gov/welcome-kit/',
          description: 'Comprehensive guide to VA benefits and services'
        }
      ]
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="va-resources-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-6 rounded-t-lg relative flex-shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="VA Resources Hub" />}
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close VA Resources"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-8 w-8" />
            <h2 id="va-resources-title" className="text-3xl font-bold">VA Resources Hub</h2>
          </div>
          <p className="text-blue-100 text-lg">
            Official VA programs, benefits, and support for Veterans
          </p>
        </div>

        {/* Crisis Banner */}
        <div className="bg-red-600 dark:bg-red-700 text-white px-6 py-3 flex items-center justify-center gap-4 flex-shrink-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="text-center">
            <span className="font-semibold">Veterans Crisis Line:</span>{' '}
            <a href="tel:988" className="underline font-bold">Dial 988, Press 1</a> |{' '}
            <span>Text 838255</span> |{' '}
            <a href="https://www.veteranscrisisline.net/get-help-now/chat" target="_blank" rel="noopener noreferrer" className="underline">
              Chat Online 24/7
            </a>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* PACT Act Highlight Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="bg-amber-500 text-white p-3 rounded-full flex-shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                  PACT Act: Largest VA Health Care Expansion in History
                </h3>
                <p className="text-amber-800 dark:text-amber-200 mb-3">
                  If you served in Vietnam, the Gulf War, Iraq, Afghanistan, or any combat zone after 9/11, 
                  you may now be eligible for VA health care and benefits - even if you were denied before.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://www.va.gov/resources/the-pact-act-and-your-va-benefits/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Learn About PACT Act
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href="https://www.va.gov/disability/file-disability-claim-form-21-526ez/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    File a Claim Now
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Categories */}
          {resourceCategories.map((category) => (
            <div 
              key={category.id}
              className={`border rounded-lg overflow-hidden ${
                category.highlight 
                  ? 'border-amber-300 dark:border-amber-700' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <button
                onClick={() => toggleSection(category.id)}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  category.highlight
                    ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${category.iconBg}`}>
                    <span className={category.iconColor}>{category.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {category.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {category.description}
                    </p>
                  </div>
                </div>
                {expandedSections[category.id] ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                )}
              </button>

              {expandedSections[category.id] && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  {/* Key Info Box */}
                  {category.keyInfo && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Key Information:</h4>
                      <ul className="space-y-1">
                        {category.keyInfo.map((info, idx) => (
                          <li key={idx} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {info}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resources Grid */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {category.resources.map((resource, idx) => (
                      <a
                        key={idx}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-3 rounded-lg border transition-all hover:shadow-md ${
                          resource.urgent
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : resource.important
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`font-semibold ${
                            resource.urgent 
                              ? 'text-red-700 dark:text-red-300' 
                              : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {resource.name}
                          </h4>
                          <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {resource.description}
                        </p>
                        {resource.phone && (
                          <div className="flex items-center gap-1 mt-2 text-sm">
                            <Phone className="h-3 w-3 text-gray-500" />
                            <a 
                              href={`tel:${resource.phone.replace(/[^0-9]/g, '')}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {resource.phone}
                            </a>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Footer Info */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              <strong>Need Help?</strong> Call the VA main information line at{' '}
              <a href="tel:1-800-698-2411" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                800-698-2411
              </a>{' '}
              (TTY: 711) or{' '}
              <a 
                href="https://www.va.gov/get-help-from-accredited-representative" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                find a VSO to help with your claim
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VAResources;
