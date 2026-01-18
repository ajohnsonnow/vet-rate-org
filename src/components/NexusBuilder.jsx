import React, { useState } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import AIConsentModal from './AIConsentModal';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { isAIAvailable, enhancePersonalStatement } from '../utils/aiStatementHelper';

/**
 * NexusBuilder Component
 * Dynamic wizard that generates a Statement in Support of Claim (VA Form 21-4138)
 * Customizes questions based on whether the claim is primary or secondary
 * Now with optional AI enhancement powered by Google Gemini
 */
const NexusBuilder = ({ condition, primaryCondition, onClose, onSave, existingStatement = null, onReportBug }) => {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState(existingStatement?.answers || {
    // Timeline
    symptomOnsetDate: '',
    hasTreatment: '',
    treatmentType: '',
    
    // Bridge (for secondary claims)
    aggravationMechanism: '',
    aggravationExplanation: '',
    specificIncident: '',
    
    // Severity
    workImpact: '',
    socialImpact: '',
    specificExamples: ''
  });
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [nexusDownloaded, setNexusDownloaded] = useState(false);
  
  // AI Enhancement state
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [aiEnhancedStatement, setAiEnhancedStatement] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [useAIVersion, setUseAIVersion] = useState(false);

  const isSecondary = Boolean(primaryCondition);
  const totalSteps = isSecondary ? 4 : 3;

  const updateAnswer = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const aggravationOptions = [
    { value: 'stress', label: 'Stress and anxiety from primary condition causes flare-ups' },
    { value: 'medication', label: 'Medication side effects from treating primary condition' },
    { value: 'physical', label: 'Physical limitations or compensatory behaviors' },
    { value: 'sleep', label: 'Sleep disruption from primary condition' },
    { value: 'weight', label: 'Weight gain or metabolic changes' },
    { value: 'inflammation', label: 'Chronic inflammation or immune dysfunction' },
    { value: 'other', label: 'Other (please explain below)' }
  ];

  const generateStatement = () => {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let statement = `To the Department of Veterans Affairs:\n\n`;
    
    if (isSecondary) {
      statement += `I am submitting a claim for **${condition}** as secondary to my service-connected **${primaryCondition}**.\n\n`;
    } else {
      statement += `I am submitting a claim for service connection of **${condition}**.\n\n`;
    }

    statement += `**Onset and Progression:**\n`;
    statement += `I first noted symptoms of ${condition} around ${answers.symptomOnsetDate || '[Date]'}. These symptoms have persisted and worsened over time. `;
    
    if (answers.hasTreatment === 'yes-va') {
      statement += `I have sought treatment through the VA medical system for this condition.\n\n`;
    } else if (answers.hasTreatment === 'yes-private') {
      statement += `I have sought treatment through private medical care for this condition.\n\n`;
    } else if (answers.hasTreatment === 'no') {
      statement += `Due to the nature of my service-connected disabilities, I have not yet been able to seek formal treatment for this condition.\n\n`;
    }

    if (isSecondary) {
      statement += `**Nexus (Connection to Service):**\n`;
      const mechanismText = aggravationOptions.find(opt => opt.value === answers.aggravationMechanism)?.label || answers.aggravationMechanism;
      statement += `My service-connected ${primaryCondition} directly causes or aggravates this condition through the following mechanism: ${mechanismText}. `;
      
      if (answers.aggravationExplanation) {
        statement += `${answers.aggravationExplanation} `;
      }
      
      if (answers.specificIncident) {
        statement += `\n\nSpecifically, ${answers.specificIncident}`;
      }
      statement += `\n\n`;
    }

    statement += `**Severity and Impact:**\n`;
    statement += `This condition significantly affects my daily life. `;
    
    if (answers.workImpact) {
      statement += `In terms of employment, ${answers.workImpact} `;
    }
    
    if (answers.socialImpact) {
      statement += `Regarding my social and family life, ${answers.socialImpact} `;
    }
    
    if (answers.specificExamples) {
      statement += `\n\nSpecific examples include: ${answers.specificExamples}`;
    }

    statement += `\n\n**Request:**\n`;
    statement += `I respectfully request a Compensation & Pension (C&P) examination to evaluate this condition and its connection to my service${isSecondary ? '-connected disability' : ''}.\n\n`;
    statement += `Respectfully submitted,\n\n`;
    statement += `Date: ${currentDate}`;

    return statement;
  };

  const generateDoctorNote = () => {
    return `Dear Healthcare Provider,

I am filing a VA disability claim for ${condition}${isSecondary ? ` as secondary to my service-connected ${primaryCondition}` : ''}.

Could you please review my medical records and, if clinically accurate, document in my medical file the following statement:

"It is at least as likely as not (50% or greater probability) that the veteran's ${condition} is ${isSecondary ? 'aggravated by or caused by' : 'related to'} ${isSecondary ? `their service-connected ${primaryCondition}` : 'their military service'}."

${isSecondary ? `\nSpecifically, the ${primaryCondition} appears to contribute to ${condition} through: ${answers.aggravationExplanation || '[mechanism to be discussed]'}.` : ''}

This clinical opinion is important for my VA claim evaluation. Thank you for your consideration.

Sincerely,
[Your Name]`;
  };

  const handleNext = () => {
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  // AI Enhancement handlers
  const handleRequestAIEnhance = () => {
    setShowAIConsent(true);
  };

  const handleAIConsent = async () => {
    setShowAIConsent(false);
    setIsEnhancing(true);
    setAiError(null);

    try {
      const result = await enhancePersonalStatement(answers, condition, primaryCondition);
      
      if (result.success) {
        setAiEnhancedStatement(result.content);
        setUseAIVersion(true);
      } else {
        setAiError(result.error);
      }
    } catch (error) {
      console.error('AI enhancement error:', error);
      setAiError('An unexpected error occurred. Please try again or use the standard template.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAICancel = () => {
    setShowAIConsent(false);
  };

  const toggleStatementVersion = () => {
    setUseAIVersion(!useAIVersion);
  };

  // Get the current statement (AI or standard)
  const getCurrentStatement = () => {
    if (useAIVersion && aiEnhancedStatement) {
      return aiEnhancedStatement;
    }
    return generateStatement();
  };

  const handleFinish = () => {
    const statement = getCurrentStatement();
    const doctorNote = generateDoctorNote();
    
    onSave({
      condition,
      primaryCondition,
      answers,
      statement,
      doctorNote,
      generatedDate: new Date().toISOString()
    });
  };

  const handleDownload = (format = 'txt') => {
    const statement = getCurrentStatement();
    const doctorNote = generateDoctorNote();
    const fileName = `VA-Statement-${condition.replace(/\s+/g, '-')}`;
    
    switch (format) {
      case 'txt':
        downloadAsTxt(statement, doctorNote, fileName);
        break;
      case 'docx':
        downloadAsDocx(statement, doctorNote, fileName);
        break;
      case 'pdf':
        downloadAsPdf(statement, doctorNote, fileName);
        break;
      default:
        downloadAsTxt(statement, doctorNote, fileName);
    }
    
    setShowDownloadMenu(false);
    setNexusDownloaded(true);
  };

  const downloadAsTxt = (statement, doctorNote, fileName) => {
    const content = statement + '\n\n---\n\nDOCTOR\'S CHEAT SHEET\n\n' + doctorNote;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsDocx = async (statement, doctorNote, fileName) => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'STATEMENT IN SUPPORT OF CLAIM',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            new Paragraph({
              text: `Condition: ${condition}`,
              spacing: { after: 200 }
            }),
            ...statement.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
                spacing: { after: 100 }
              })
            ),
            new Paragraph({
              text: '',
              spacing: { after: 400 }
            }),
            new Paragraph({
              text: 'DOCTOR\'S CHEAT SHEET',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            ...doctorNote.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
                spacing: { after: 100 }
              })
            )
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating DOCX:', error);
      alert('Error generating Word document. Please try another format.');
    }
  };

  const downloadAsPdf = (statement, doctorNote, fileName) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = 20;

      // Title
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('STATEMENT IN SUPPORT OF CLAIM', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Condition
      pdf.setFontSize(11);
      pdf.text(`Condition: ${condition}`, margin, yPosition);
      yPosition += 10;

      // Statement content
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      const statementLines = pdf.splitTextToSize(statement, maxWidth);
      statementLines.forEach(line => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      // Doctor's note section
      yPosition += 10;
      if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('DOCTOR\'S CHEAT SHEET', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      const doctorLines = pdf.splitTextToSize(doctorNote, maxWidth);
      doctorLines.forEach(line => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try another format.');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nexus-builder-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto modal-content">
          {/* Header */}
          <div className="bg-gradient-to-r from-va-blue to-green-800 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0 pr-10 sm:pr-0">
                <h2 id="nexus-builder-title" className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 truncate">
                  {existingStatement ? 'Edit Statement' : '📝 Nexus Builder'}
                </h2>
                <p className="text-green-200 text-sm sm:text-base">
                  {existingStatement ? 'Updating' : 'Statement'} for: <strong className="block sm:inline truncate">{condition}</strong>
                  {isSecondary && <span className="block sm:inline text-xs sm:text-sm"> (Secondary to {primaryCondition})</span>}
                </p>
              </div>
              <div className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto flex items-center gap-2 sm:gap-3">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Nexus Builder" />}
                <button
                  onClick={onClose}
                  className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
            {existingStatement && (
              <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-800 dark:text-blue-100">
                  <strong>Editing Mode:</strong> Your previous answers have been loaded. Make changes as needed.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Step {step} of {totalSteps}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round((step / totalSteps) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="p-6">
            {/* Step 1: Timeline */}
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Timeline Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    When did you first notice symptoms of {condition}?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Spring 2020, June 2019, After deployment in 2018"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    value={answers.symptomOnsetDate}
                    onChange={(e) => updateAnswer('symptomOnsetDate', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Approximate dates are acceptable</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Have you sought medical treatment for this condition?
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'yes-va', label: 'Yes, through the VA' },
                      { value: 'yes-private', label: 'Yes, through private healthcare' },
                      { value: 'both', label: 'Both VA and private' },
                      { value: 'no', label: 'No formal treatment yet' }
                    ].map(option => (
                      <label key={option.value} className="flex items-center p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                          type="radio"
                          name="treatment"
                          value={option.value}
                          checked={answers.hasTreatment === option.value}
                          onChange={(e) => updateAnswer('hasTreatment', e.target.value)}
                          className="mr-3 h-4 w-4 text-green-600"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Bridge (Secondary Claims Only) */}
            {step === 2 && isSecondary && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Connection (Nexus) to Your Service-Connected Condition</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    How does your {primaryCondition} cause or aggravate your {condition}?
                  </label>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {aggravationOptions.map(option => (
                      <label key={option.value} className="flex items-start p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                          type="radio"
                          name="mechanism"
                          value={option.value}
                          checked={answers.aggravationMechanism === option.value}
                          onChange={(e) => updateAnswer('aggravationMechanism', e.target.value)}
                          className="mt-1 mr-3 h-4 w-4 text-green-600"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Explain in your own words how {primaryCondition} affects your {condition}:
                  </label>
                  <textarea
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Example: My PTSD causes severe anxiety and hypervigilance, which prevents me from falling asleep and staying asleep. The constant state of alertness disrupts my breathing patterns during sleep..."
                    value={answers.aggravationExplanation}
                    onChange={(e) => updateAnswer('aggravationExplanation', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Describe a specific recent incident where these two conditions interacted:
                  </label>
                  <textarea
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Example: Last month, I had a PTSD episode triggered by fireworks. That night, my sleep apnea symptoms worsened significantly - I woke up gasping for air multiple times, which my partner witnessed..."
                    value={answers.specificIncident}
                    onChange={(e) => updateAnswer('specificIncident', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3 (or 2 for primary): Severity and Impact */}
            {((step === 3 && isSecondary) || (step === 2 && !isSecondary)) && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Severity and Daily Impact</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    How does {condition} affect your ability to work?
                  </label>
                  <textarea
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Example: I have difficulty concentrating due to fatigue from poor sleep. I've missed 15+ days of work in the past year. My supervisor has documented performance issues related to exhaustion..."
                    value={answers.workImpact}
                    onChange={(e) => updateAnswer('workImpact', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    How does {condition} affect your social and family life?
                  </label>
                  <textarea
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Example: I avoid social gatherings because I'm exhausted. My spouse says I'm irritable and moody due to poor sleep. I've had to stop participating in activities I used to enjoy..."
                    value={answers.socialImpact}
                    onChange={(e) => updateAnswer('socialImpact', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Provide specific examples of how this condition limits your daily activities:
                  </label>
                  <textarea
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Example: I can no longer drive long distances safely due to fatigue. I need to take frequent breaks during simple tasks. My memory and focus have noticeably declined..."
                    value={answers.specificExamples}
                    onChange={(e) => updateAnswer('specificExamples', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Final Step: Review and Download */}
            {step === totalSteps && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Review Your Statement</h3>
                  
                  {/* AI Enhancement Button */}
                  {isAIAvailable() && !aiEnhancedStatement && !isEnhancing && (
                    <button
                      onClick={handleRequestAIEnhance}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      ✨ Enhance with AI
                    </button>
                  )}
                  
                  {/* Loading state */}
                  {isEnhancing && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-semibold text-sm">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      AI is writing...
                    </div>
                  )}
                  
                  {/* Toggle between versions */}
                  {aiEnhancedStatement && !isEnhancing && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Version:</span>
                      <button
                        onClick={toggleStatementVersion}
                        className={`px-3 py-1 rounded-l-lg text-sm font-medium transition-colors ${
                          !useAIVersion 
                            ? 'bg-gray-700 text-white' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        onClick={toggleStatementVersion}
                        className={`px-3 py-1 rounded-r-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          useAIVersion 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        ✨ AI Enhanced
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Error message */}
                {aiError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-red-700 dark:text-red-300">{aiError}</p>
                      <button 
                        onClick={handleRequestAIEnhance}
                        className="text-sm text-red-600 dark:text-red-400 underline mt-1 hover:text-red-800 dark:hover:text-red-200"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Success indicator */}
                {useAIVersion && aiEnhancedStatement && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      ✨ AI-enhanced statement • Powered by Google Gemini • <span className="opacity-75">Review before downloading</span>
                    </span>
                  </div>
                )}
                
                <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Statement in Support of Claim (VA Form 21-4138)</h4>
                    {useAIVersion && aiEnhancedStatement && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
                        ✨ AI Enhanced
                      </span>
                    )}
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                      {getCurrentStatement()}
                    </pre>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Doctor's Cheat Sheet</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Hand this to your healthcare provider to help them document the nexus</p>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                      {generateDoctorNote()}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t dark:border-gray-700">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {step < totalSteps && (
                  <button
                    onClick={handleNext}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
                  >
                    Next Step
                  </button>
                )}
                
                {step === totalSteps && (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 border-2 border-green-600 text-green-600 dark:text-green-400 dark:border-green-500 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <span className="hidden sm:inline">Download </span>Statement
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showDownloadMenu && (
                        <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[180px]">
                          <button
                            onClick={() => handleDownload('txt')}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 rounded-t-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Text (.txt)
                          </button>
                          <button
                            onClick={() => handleDownload('docx')}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Word (.docx)
                          </button>
                          <button
                            onClick={() => handleDownload('pdf')}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-b-lg flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            PDF (.pdf)
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleFinish}
                      className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
                    >
                      Save to Packet
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* BuyMeCoffee - shows after download */}
      <BuyMeCoffee 
        show={nexusDownloaded} 
        trigger="nexus"
        context={{ conditionName: condition }}
        onDismiss={() => setNexusDownloaded(false)}
      />
      
      {/* AI Consent Modal */}
      <AIConsentModal
        isOpen={showAIConsent}
        onConsent={handleAIConsent}
        onCancel={handleAICancel}
        statementType="personal"
      />
    </div>
  );
};

export default NexusBuilder;
