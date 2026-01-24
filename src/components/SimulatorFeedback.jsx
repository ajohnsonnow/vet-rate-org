import React, { useRef } from 'react';
import { AlertCircle, TrendingUp, CheckCircle, Info, FileText, AlertTriangle, Download, ClipboardList, X, Calculator } from 'lucide-react';
import jsPDF from 'jspdf';
import ShareButton from './ShareButton';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * SimulatorFeedback Component
 * 
 * Displays C&P Simulator results with educational gap analysis.
 * Shows predicted rating, rationale, gaps to higher ratings, and actionable advice.
 * 
 * CRITICAL: This is an educational tool, not a guarantee. All feedback based on 38 CFR Part 4.
 */
const SimulatorFeedback = ({ result, conditionName, diagnosticCode, answers, questions, onRestart, onClose, onSendToCalculator }) => {
  const { t } = useLanguage();
  const feedbackContentRef = useRef(null);
  
  if (!result) return null;

  const { predictedRating, ratingRationale, gaps, actionItems, warnings } = result;

  // Generate PDF download
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 20;

    // Helper: Check page break and add new page if needed
    const checkPageBreak = (requiredSpace = 30) => {
      if (yPos > pageHeight - requiredSpace) {
        doc.addPage();
        yPos = 25;
        return true;
      }
      return false;
    };

    // Helper: Add section header with consistent styling
    const addSectionHeader = (title, bgColor = [45, 80, 22]) => {
      checkPageBreak(40);
      doc.setFillColor(...bgColor);
      doc.rect(margin - 5, yPos - 5, contentWidth + 10, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPos + 3);
      doc.setTextColor(0, 0, 0);
      yPos += 18;
    };

    // Helper: Add wrapped text with proper line handling
    const addWrappedText = (text, fontSize = 10, fontStyle = 'normal', indent = 0) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      const lineHeight = fontSize * 0.5;
      
      lines.forEach(line => {
        checkPageBreak(lineHeight + 5);
        doc.text(line, margin + indent, yPos);
        yPos += lineHeight;
      });
      return lines.length;
    };

    // ========== TITLE HEADER ==========
    doc.setFillColor(45, 80, 22); // VA Green
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('C&P Exam Simulation Report', margin, 18);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(conditionName || 'Disability Condition', margin, 30);
    
    doc.setFontSize(10);
    const dcText = diagnosticCode ? `Diagnostic Code: ${diagnosticCode}` : '';
    const dateText = `Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    doc.text(`${dcText}${dcText ? '  |  ' : ''}${dateText}`, margin, 40);

    doc.setTextColor(0, 0, 0);
    yPos = 55;

    // ========== PREDICTED RATING BOX ==========
    doc.setFillColor(240, 253, 244); // Light green background
    doc.setDrawColor(45, 80, 22);
    doc.setLineWidth(1);
    doc.roundedRect(margin - 5, yPos - 5, contentWidth + 10, 35, 3, 3, 'FD');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 80, 22);
    doc.text('PREDICTED RATING', margin, yPos + 5);
    
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(`${predictedRating}%`, margin + contentWidth - 35, yPos + 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const rationaleLines = doc.splitTextToSize(ratingRationale || '', contentWidth - 60);
    rationaleLines.slice(0, 2).forEach((line, i) => {
      doc.text(line, margin, yPos + 15 + (i * 5));
    });
    
    doc.setTextColor(0, 0, 0);
    yPos += 45;

    // ========== YOUR RESPONSES SECTION ==========
    if (questions && questions.length > 0 && answers) {
      addSectionHeader('YOUR RESPONSES - Questions & Answers', [55, 65, 81]);
      
      questions.forEach((q, idx) => {
        checkPageBreak(35);
        
        // Question number and text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.text(`Question ${idx + 1}:`, margin, yPos);
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const qLines = doc.splitTextToSize(q.question || '', contentWidth - 5);
        qLines.forEach(line => {
          checkPageBreak(8);
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
        
        // Answer
        const answer = answers[q.id];
        const option = q.options?.find(opt => opt.value === answer);
        const answerText = option?.label || answer || 'No response';
        
        doc.setFillColor(226, 232, 240);
        const answerLines = doc.splitTextToSize(`Your Answer: ${answerText}`, contentWidth - 15);
        const answerBoxHeight = Math.max(10, answerLines.length * 5 + 4);
        checkPageBreak(answerBoxHeight + 5);
        doc.roundedRect(margin + 5, yPos - 2, contentWidth - 10, answerBoxHeight, 2, 2, 'F');
        
        doc.setFont('helvetica', 'bolditalic');
        doc.setTextColor(30, 64, 175);
        answerLines.forEach((line, i) => {
          doc.text(line, margin + 10, yPos + 4 + (i * 5));
        });
        
        doc.setTextColor(0, 0, 0);
        yPos += answerBoxHeight + 8;
      });
    }

    // ========== CRITICAL WARNINGS ==========
    if (warnings && warnings.length > 0) {
      addSectionHeader('CRITICAL INFORMATION', [185, 28, 28]);
      
      warnings.forEach(warning => {
        checkPageBreak(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 29, 29);
        
        // Use simple bullet instead of emoji which doesn't render in PDF
        const wLines = doc.splitTextToSize(`>> ${warning}`, contentWidth - 15);
        wLines.forEach(line => {
          checkPageBreak(7);
          doc.text(line, margin + 5, yPos);
          yPos += 6;
        });
        yPos += 4;
      });
      doc.setTextColor(0, 0, 0);
    }

    // ========== GAP ANALYSIS ==========
    if (gaps && gaps.length > 0) {
      addSectionHeader('GAP ANALYSIS - Path to Higher Ratings', [124, 58, 237]);
      
      doc.setTextColor(0, 0, 0);
      gaps.forEach(gap => {
        // Skip empty lines/spacers
        if (!gap || gap.trim() === '') {
          yPos += 4; // Add spacing for empty lines
          return;
        }
        
        checkPageBreak(20);
        doc.setFontSize(10);
        
        if (gap.startsWith('**')) {
          // Sub-header within gaps - also needs word wrapping
          doc.setFont('helvetica', 'bold');
          const cleanGap = gap.replace(/\*\*/g, '');
          const headerLines = doc.splitTextToSize(cleanGap, contentWidth - 5);
          headerLines.forEach(line => {
            checkPageBreak(7);
            doc.text(line, margin, yPos);
            yPos += 6;
          });
          yPos += 2;
        } else if (gap.startsWith('•')) {
          // Already has bullet point - use as-is but indent
          doc.setFont('helvetica', 'normal');
          const gLines = doc.splitTextToSize(gap, contentWidth - 15);
          gLines.forEach(line => {
            checkPageBreak(7);
            doc.text(line, margin + 5, yPos);
            yPos += 6;
          });
          yPos += 2;
        } else {
          // Regular text - add bullet prefix
          doc.setFont('helvetica', 'normal');
          const gLines = doc.splitTextToSize(`• ${gap}`, contentWidth - 15);
          gLines.forEach(line => {
            checkPageBreak(7);
            doc.text(line, margin + 5, yPos);
            yPos += 6;
          });
          yPos += 2;
        }
      });
    }

    // ========== PREPARATION CHECKLIST ==========
    if (actionItems && actionItems.length > 0) {
      addSectionHeader('PREPARATION CHECKLIST', [22, 163, 74]);
      
      doc.setTextColor(0, 0, 0);
      actionItems.forEach((item, idx) => {
        checkPageBreak(15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Checkbox
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin + 2, yPos - 3, 4, 4);
        
        const iLines = doc.splitTextToSize(item, contentWidth - 15);
        iLines.forEach((line, i) => {
          checkPageBreak(6);
          doc.text(line, margin + 10, yPos);
          yPos += 5;
        });
        yPos += 3;
      });
    }

    // ========== DISCLAIMER FOOTER ==========
    checkPageBreak(45);
    yPos += 5;
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin - 5, yPos - 3, contentWidth + 10, 38, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('IMPORTANT DISCLAIMER', margin, yPos + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const disclaimer = 'This C&P Exam Simulation Report is an educational and preparation tool only. It does NOT constitute legal advice, medical advice, or a guarantee of any specific VA disability rating. The information provided is based on 38 CFR Part 4 criteria as of January 2026. Individual results will vary based on medical evidence, examiner findings, and VA adjudication. Always consult with an accredited Veterans Service Organization (VSO), VA-accredited claims agent, or VA-accredited attorney for personalized guidance on your specific claim.';
    const dLines = doc.splitTextToSize(disclaimer, contentWidth);
    dLines.forEach((line, i) => {
      doc.text(line, margin, yPos + 10 + (i * 4));
    });

    // ========== FOOTER WITH PAGE NUMBERS ==========
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`VetRate.org - C&P Exam Preparation Tool`, margin, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    }

    // Save PDF
    const safeName = (conditionName || 'Condition').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `CP_Exam_Report_${safeName}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fileName);
  };

  // Color scheme based on rating level
  const getRatingColor = (rating) => {
    if (rating === 0) return 'text-gray-600 bg-gray-100';
    if (rating <= 10) return 'text-blue-600 bg-blue-100';
    if (rating <= 30) return 'text-green-600 bg-green-100';
    if (rating <= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const ratingColor = getRatingColor(predictedRating);

  return (
    <div ref={feedbackContentRef} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-2">
          C&P Exam Simulation Results
        </h2>
        <p className="text-amber-100">
          {conditionName}
        </p>
      </div>

      {/* Predicted Rating */}
      <div className="bg-white rounded-lg shadow-md border-2 border-amber-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-amber-600" />
            Predicted Rating
          </h3>
          <div className={`text-4xl font-bold px-6 py-2 rounded-lg ${ratingColor}`}>
            {predictedRating}%
          </div>
        </div>
        
        <div className="prose max-w-none">
          <p className="text-gray-700 text-lg">
            {ratingRationale}
          </p>
        </div>
      </div>

      {/* Warnings (Critical Information) */}
      {warnings && warnings.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-3">
                Critical Information
              </h3>
              <div className="space-y-2">
                {warnings.map((warning, index) => (
                  <div key={index} className="text-yellow-800">
                    <p className="whitespace-pre-wrap">{warning}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {gaps && gaps.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <Info className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Gap Analysis: What You Need to Know
              </h3>
              <p className="text-gray-600 mb-4">
                This analysis shows what would be required to qualify for a higher rating, based on 38 CFR Part 4 criteria.
              </p>
            </div>
          </div>
          
          <div className="space-y-2 pl-9">
            {gaps.map((gap, index) => (
              <div key={index} className="text-gray-700 dark:text-gray-300">
                {gap.startsWith('**') ? (
                  <p className="font-bold text-lg text-purple-800 dark:text-purple-100 mt-4 mb-2">
                    {gap.replace(/\*\*/g, '')}
                  </p>
                ) : gap.startsWith('•') ? (
                  <p className="ml-4 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{gap}</p>
                ) : gap.trim() === '' ? (
                  <div className="h-2" /> /* Spacer for empty lines */
                ) : (
                  <p className="ml-4 whitespace-pre-wrap">{gap}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {actionItems && actionItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-green-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Action Items for Your C&P Exam
              </h3>
              <p className="text-gray-600 mb-4">
                These are specific steps you should take to prepare for your exam and maximize your rating.
              </p>
            </div>
          </div>
          
          <div className="space-y-3 pl-9">
            {actionItems.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 whitespace-pre-wrap">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Educational Note */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-bold text-blue-900 mb-2">
              Understanding Your Results
            </h4>
            <div className="text-blue-800 space-y-2 text-sm">
              <p>
                • This simulation is based on your self-reported answers and the criteria in 38 CFR Part 4.
              </p>
              <p>
                • The actual rating decision will be made by the VA rater based on the C&P examiner's report and all evidence in your file.
              </p>
              <p>
                • The C&P exam is NOT an adversarial process - the examiner's job is to document your condition accurately, not to deny your claim.
              </p>
              <p>
                • <strong>Always tell the truth</strong> during your exam. Describe your worst days, not your best days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 justify-center flex-wrap">
        <ShareButton 
          targetRef={feedbackContentRef}
          filename="cap-simulator-results"
          variant="button"
        />
        {onSendToCalculator && (
          <button
            onClick={onSendToCalculator}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition shadow-md flex items-center gap-2"
          >
            <Calculator className="h-5 w-5" />
            Send to Tactical Calculator
          </button>
        )}
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-md flex items-center gap-2"
        >
          <ClipboardList className="h-5 w-5" />
          Simulate Another Condition
        </button>
        <button
          onClick={downloadPDF}
          className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition shadow-md flex items-center gap-2"
        >
          <Download className="h-5 w-5" />
          Download Results (PDF)
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition shadow-md flex items-center gap-2"
        >
          <X className="h-5 w-5" />
          Close Simulator
        </button>
      </div>

      {/* Disclaimer Footer */}
      <div className="bg-gray-100 border-l-4 border-gray-400 p-4 rounded">
        <p className="text-sm text-gray-600 italic">
          <strong>Disclaimer:</strong> This is a training and preparation tool, not legal advice. It does not guarantee any specific rating outcome. Always consult with an accredited VSO or VA-accredited attorney for personalized advice. The information provided is based on 38 CFR Part 4 as of January 2026.
        </p>
      </div>
    </div>
  );
};

export default SimulatorFeedback;
