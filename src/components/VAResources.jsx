import React, { useState } from "react";
import {
  X,
  ExternalLink,
  Phone,
  AlertTriangle,
  Shield,
  Heart,
  Brain,
  Home,
  Users,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  Leaf,
  Globe,
  Award,
  Scale,
  BookOpen,
} from "lucide-react";
import ReportBugLink from "./ReportBugLink";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import RegulationsReference from "./RegulationsReference";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * VAResources Component
 *
 * Comprehensive VA resources hub providing veterans with direct links to
 * official VA programs, services, and support systems including PACT Act
 * information, environmental exposure assessments, mental health resources,
 * and specialized veteran programs.
 */
const VAResources = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  const [showRegulationsReference, setShowRegulationsReference] =
    useState(false);
  const [expandedSections, setExpandedSections] = useState({
    pactAct: true,
    exposures: false,
    mentalHealth: false,
    specializedPrograms: false,
    healthCare: false,
    benefits: false,
    regulations: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const resourceCategories = [
    {
      id: "pactAct",
      title: t("vaResources.pactActToxicExposure"),
      icon: <Shield className="h-6 w-6" />,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      description: t("vaResources.pactActCategoryDesc"),
      highlight: true,
      resources: [
        {
          name: t("vaResources.pactActOverview"),
          url: "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
          description: t("vaResources.pactActOverviewDesc"),
          phone: "800-698-2411",
          important: true,
        },
        {
          name: t("vaResources.fileDisabilityClaim"),
          url: "https://www.va.gov/disability/file-disability-claim-form-21-526ez/",
          description: t("vaResources.fileDisabilityClaimDesc"),
          important: true,
        },
        {
          name: t("vaResources.applyVAHealthCare"),
          url: "https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/",
          description: t("vaResources.applyVAHealthCareDesc"),
          important: true,
        },
        {
          name: t("vaResources.pactActDashboard"),
          url: "https://department.va.gov/pactdata/",
          description: t("vaResources.pactActDashboardDesc"),
        },
        {
          name: t("vaResources.campLejeune"),
          url: "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/camp-lejeune-water-contamination",
          description: t("vaResources.campLejeuneDesc"),
        },
      ],
      keyInfo: [
        t("vaResources.pactKeyInfo1"),
        t("vaResources.pactKeyInfo2"),
        t("vaResources.pactKeyInfo3"),
        t("vaResources.pactKeyInfo4"),
      ],
    },
    {
      id: "exposures",
      title: t("vaResources.militaryExposures"),
      icon: <Leaf className="h-6 w-6" />,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      description: t("vaResources.militaryExposuresDesc"),
      resources: [
        {
          name: t("vaResources.militaryExposuresOverview"),
          url: "https://www.publichealth.va.gov/exposures/index.asp",
          description: t("vaResources.militaryExposuresOverviewDesc"),
        },
        {
          name: t("vaResources.meeaAssessment"),
          url: "https://www.publichealth.va.gov/MEEA/index.asp",
          description: t("vaResources.meeaAssessmentDesc"),
          important: true,
        },
        {
          name: t("vaResources.vetHomeTelehealth"),
          url: "https://vethome.va.gov/",
          description: t("vaResources.vetHomeTelehealthDesc"),
          phone: "833-633-8846",
        },
        {
          name: t("vaResources.agentOrange"),
          url: "https://www.publichealth.va.gov/exposures/agentorange/conditions/index.asp",
          description: t("vaResources.agentOrangeDesc"),
        },
        {
          name: t("vaResources.gulfWarIllnesses"),
          url: "https://www.publichealth.va.gov/exposures/gulfwar/index.asp",
          description: t("vaResources.gulfWarIllnessesDesc"),
        },
        {
          name: t("vaResources.burnPitHazards"),
          url: "https://www.publichealth.va.gov/exposures/burnpits/index.asp",
          description: t("vaResources.burnPitHazardsDesc"),
          important: true,
        },
        {
          name: t("vaResources.burnPitRegistry"),
          url: "https://www.publichealth.va.gov/exposures/burnpits/registry.asp",
          description: t("vaResources.burnPitRegistryDesc"),
        },
        {
          name: t("vaResources.envHealthCoordinators"),
          url: "https://www.publichealth.va.gov/exposures/coordinators.asp",
          description: t("vaResources.envHealthCoordinatorsDesc"),
        },
      ],
      keyInfo: [
        t("vaResources.exposuresKeyInfo1"),
        t("vaResources.exposuresKeyInfo2"),
        t("vaResources.exposuresKeyInfo3"),
        t("vaResources.exposuresKeyInfo4"),
      ],
    },
    {
      id: "mentalHealth",
      title: t("vaResources.mentalHealthPTSD"),
      icon: <Brain className="h-6 w-6" />,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      description: t("vaResources.mentalHealthDesc"),
      resources: [
        {
          name: t("vaResources.veteransCrisisLineResource"),
          url: "https://www.veteranscrisisline.net/",
          description: t("vaResources.veteransCrisisLineDesc"),
          phone: "988 (Press 1)",
          urgent: true,
        },
        {
          name: t("vaResources.vaMentalHealthServices"),
          url: "https://www.mentalhealth.va.gov/",
          description: t("vaResources.vaMentalHealthServicesDesc"),
        },
        {
          name: t("vaResources.ptsdCenter"),
          url: "https://www.ptsd.va.gov/",
          description: t("vaResources.ptsdCenterDesc"),
          important: true,
        },
        {
          name: t("vaResources.ptsdDecisionAid"),
          url: "https://www.ptsd.va.gov/apps/decisionaid/",
          description: t("vaResources.ptsdDecisionAidDesc"),
        },
        {
          name: t("vaResources.aboutFace"),
          url: "https://www.ptsd.va.gov/apps/aboutface/",
          description: t("vaResources.aboutFaceDesc"),
        },
        {
          name: t("vaResources.makeTheConnection"),
          url: "https://www.maketheconnection.net/",
          description: t("vaResources.makeTheConnectionDesc"),
        },
        {
          name: t("vaResources.mstSupport"),
          url: "https://www.mentalhealth.va.gov/msthome/index.asp",
          description: t("vaResources.mstSupportDesc"),
        },
        {
          name: t("vaResources.substanceUseTreatment"),
          url: "https://www.mentalhealth.va.gov/substance-use/index.asp",
          description: t("vaResources.substanceUseTreatmentDesc"),
        },
      ],
      keyInfo: [
        t("vaResources.mentalHealthKeyInfo1"),
        t("vaResources.mentalHealthKeyInfo2"),
        t("vaResources.mentalHealthKeyInfo3"),
        t("vaResources.mentalHealthKeyInfo4"),
      ],
    },
    {
      id: "specializedPrograms",
      title: t("vaResources.specializedPrograms"),
      icon: <Users className="h-6 w-6" />,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      description: t("vaResources.specializedProgramsDesc"),
      resources: [
        {
          name: t("vaResources.homelessVeteransPrograms"),
          url: "https://www.va.gov/homeless/",
          description: t("vaResources.homelessVeteransProgramsDesc"),
          phone: "877-424-3838",
          important: true,
        },
        {
          name: t("vaResources.centerWomenVeterans"),
          url: "https://www.va.gov/womenvet/",
          description: t("vaResources.centerWomenVeteransDesc"),
          phone: "855-829-6636",
        },
        {
          name: t("vaResources.centerMinorityVeterans"),
          url: "https://www.va.gov/centerforminorityveterans/",
          description: t("vaResources.centerMinorityVeteransDesc"),
        },
        {
          name: t("vaResources.lgbtqCareProgram"),
          url: "https://www.patientcare.va.gov/lgbt/",
          description: t("vaResources.lgbtqCareProgramDesc"),
          important: true,
        },
        {
          name: t("vaResources.findLgbtqCoordinator"),
          url: "https://www.patientcare.va.gov/LGBT/VAFacilities.asp",
          description: t("vaResources.findLgbtqCoordinatorDesc"),
        },
        {
          name: t("vaResources.dischargeUpgradeLgbtq"),
          url: "https://www.va.gov/resources/discharge-upgrade-for-lgbtq-veterans/",
          description: t("vaResources.dischargeUpgradeLgbtqDesc"),
        },
        {
          name: t("vaResources.adaptiveSports"),
          url: "https://department.va.gov/veteran-sports/",
          description: t("vaResources.adaptiveSportsDesc"),
        },
        {
          name: t("vaResources.veteranSmallBusiness"),
          url: "https://www.va.gov/osdbu/",
          description: t("vaResources.veteranSmallBusinessDesc"),
        },
        {
          name: t("vaResources.nationalResourceDirectory"),
          url: "https://nrd.gov/",
          description: t("vaResources.nationalResourceDirectoryDesc"),
          important: true,
        },
      ],
    },
    {
      id: "healthCare",
      title: t("vaResources.healthCareEligibility"),
      icon: <Heart className="h-6 w-6" />,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      description: t("vaResources.healthCareDesc"),
      resources: [
        {
          name: t("vaResources.healthCareEligibilityResource"),
          url: "https://www.va.gov/health-care/eligibility/",
          description: t("vaResources.healthCareEligibilityDesc"),
        },
        {
          name: t("vaResources.applyVAHealthCare"),
          url: "https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/",
          description: t("vaResources.applyVAHealthCareDesc"),
          important: true,
        },
        {
          name: t("vaResources.priorityGroups"),
          url: "https://www.va.gov/health-care/eligibility/priority-groups",
          description: t("vaResources.priorityGroupsDesc"),
        },
        {
          name: t("vaResources.vaHealthCareAccess"),
          url: "https://www.accesstocare.va.gov/",
          description: t("vaResources.vaHealthCareAccessDesc"),
        },
        {
          name: t("vaResources.findVALocation"),
          url: "https://www.va.gov/find-locations/",
          description: t("vaResources.findVALocationDesc"),
        },
        {
          name: t("vaResources.myHealtheVet"),
          url: "https://www.va.gov/health-care/manage-health/",
          description: t("vaResources.myHealtheVetDesc"),
        },
      ],
      keyInfo: [
        t("vaResources.healthCareKeyInfo1"),
        t("vaResources.healthCareKeyInfo2"),
        t("vaResources.healthCareKeyInfo3"),
        t("vaResources.healthCareKeyInfo4"),
      ],
    },
    {
      id: "benefits",
      title: t("vaResources.benefitsSupport"),
      icon: <Briefcase className="h-6 w-6" />,
      iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      description: t("vaResources.benefitsSupportDesc"),
      resources: [
        {
          name: t("vaResources.vaOutreachEvents"),
          url: "https://www.va.gov/outreach-and-events/events/",
          description: t("vaResources.vaOutreachEventsDesc"),
        },
        {
          name: t("vaResources.getHelpVSO"),
          url: "https://www.va.gov/get-help-from-accredited-representative",
          description: t("vaResources.getHelpVSODesc"),
        },
        {
          name: t("vaResources.vaForms"),
          url: "https://www.va.gov/forms/",
          description: t("vaResources.vaFormsDesc"),
        },
        {
          name: t("vaResources.vaMobileApps"),
          url: "https://www.mobile.va.gov/appstore/",
          description: t("vaResources.vaMobileAppsDesc"),
        },
        {
          name: t("vaResources.stateVAOffices"),
          url: "https://department.va.gov/about/state-departments-of-veterans-affairs-office-locations/",
          description: t("vaResources.stateVAOfficesDesc"),
        },
        {
          name: t("vaResources.vaWelcomeKit"),
          url: "https://www.va.gov/welcome-kit/",
          description: t("vaResources.vaWelcomeKitDesc"),
        },
      ],
    },
    {
      id: "regulations",
      title: t("vaResources.regulationsRights"),
      icon: <Scale className="h-6 w-6" />,
      iconBg: "bg-slate-100 dark:bg-slate-900/30",
      iconColor: "text-slate-600 dark:text-slate-400",
      description: t("vaResources.regulationsDesc"),
      resources: [
        {
          name: t("vaResources.regulationsReference"),
          url: "#",
          description: t("vaResources.regulationsReferenceDesc"),
          isInternal: true,
          important: true,
        },
        {
          name: t("vaResources.ecfrPart3"),
          url: "https://www.ecfr.gov/current/title-38/chapter-I/part-3",
          description: t("vaResources.ecfrPart3Desc"),
        },
        {
          name: t("vaResources.ecfrPart4"),
          url: "https://www.ecfr.gov/current/title-38/chapter-I/part-4",
          description: t("vaResources.ecfrPart4Desc"),
        },
        {
          name: t("vaResources.m21Manual"),
          url: "https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/content/554400000014201/M21-1-Adjudication-Procedures-Manual",
          description: t("vaResources.m21ManualDesc"),
          important: true,
        },
        {
          name: t("vaResources.bvaAppeals"),
          url: "https://www.bva.va.gov/",
          description: t("vaResources.bvaAppealsDesc"),
        },
        {
          name: t("vaResources.decisionReviewProcess"),
          url: "https://www.va.gov/decision-reviews/",
          description: t("vaResources.decisionReviewProcessDesc"),
          important: true,
        },
      ],
      keyInfo: [
        t("vaResources.regulationsKeyInfo1"),
        t("vaResources.regulationsKeyInfo2"),
        t("vaResources.regulationsKeyInfo3"),
        t("vaResources.regulationsKeyInfo4"),
        t("vaResources.regulationsKeyInfo5"),
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="va-resources-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col modal-content">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-6 rounded-t-lg relative flex-shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {onReportBug && (
              <ReportBugLink
                onClick={onReportBug}
                variant="light"
                moduleName="VA Resources Hub"
              />
            )}
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label={t("vaResources.closeVaResources")}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-8 w-8" />
            <h2 id="va-resources-title" className="text-3xl font-bold">
              {t("vaResources.title")}{" "}
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">
                {t("common.beta")}
              </span>
            </h2>
          </div>
          <p className="text-blue-100 text-lg">{t("vaResources.subtitle")}</p>
        </div>

        {/* Crisis Banner */}
        <div className="bg-red-600 dark:bg-red-700 text-white px-6 py-3 flex items-center justify-center gap-4 flex-shrink-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="text-center">
            <span className="font-semibold">
              {t("vaResources.veteransCrisisLine")}
            </span>{" "}
            <a href="tel:988" className="underline font-bold">
              {t("vaResources.dialPress1")}
            </a>{" "}
            | <span>{t("vaResources.text838255")}</span> |{" "}
            <a
              href="https://www.veteranscrisisline.net/get-help-now/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("vaResources.chatOnline247")}
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
                  {t("vaResources.pactActTitle")}
                </h3>
                <p className="text-amber-800 dark:text-amber-200 mb-3">
                  {t("vaResources.pactActDescription")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://www.va.gov/resources/the-pact-act-and-your-va-benefits/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {t("vaResources.learnAboutPactAct")}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href="https://www.va.gov/disability/file-disability-claim-form-21-526ez/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {t("vaResources.fileClaimNow")}
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
                  ? "border-amber-300 dark:border-amber-700"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <button
                onClick={() => toggleSection(category.id)}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  category.highlight
                    ? "bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        {t("vaResources.keyInformation")}
                      </h4>
                      <ul className="space-y-1">
                        {category.keyInfo.map((info, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2"
                          >
                            <span className="text-blue-500 mt-1">•</span>
                            {info}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resources Grid */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {category.resources.map((resource, idx) => {
                      // Handle internal links (like RegulationsReference)
                      if (resource.isInternal) {
                        return (
                          <button
                            key={idx}
                            onClick={() => setShowRegulationsReference(true)}
                            className={`block p-3 rounded-lg border transition-all hover:shadow-md text-left ${
                              resource.important
                                ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                                : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                {resource.name}
                              </h4>
                              <BookOpen className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {resource.description}
                            </p>
                          </button>
                        );
                      }

                      // External links
                      return (
                        <a
                          key={idx}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block p-3 rounded-lg border transition-all hover:shadow-md ${
                            resource.urgent
                              ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                              : resource.important
                                ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                                : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className={`font-semibold ${
                                resource.urgent
                                  ? "text-red-700 dark:text-red-100"
                                  : "text-gray-900 dark:text-gray-100"
                              }`}
                            >
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
                                href={`tel:${resource.phone.replace(/[^0-9]/g, "")}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {resource.phone}
                              </a>
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Footer Info */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              <strong>{t("vaResources.needHelp")}</strong>{" "}
              {t("vaResources.callMainLine")}{" "}
              <a
                href="tel:1-800-698-2411"
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                800-698-2411
              </a>{" "}
              {t("vaResources.tty711")} {t("vaResources.orFindVSO")}{" "}
              <a
                href="https://www.va.gov/get-help-from-accredited-representative"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("vaResources.findVSOHelp")}
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Regulations Reference Modal */}
      {showRegulationsReference && (
        <RegulationsReference
          onClose={() => setShowRegulationsReference(false)}
        />
      )}
    </div>
  );
};

export default VAResources;
