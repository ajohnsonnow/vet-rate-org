import React from 'react';
import { AlertCircle, TrendingUp, CheckCircle, Info, FileText, AlertTriangle, Download, ClipboardList, X } from 'lucide-react';
import jsPDF from 'jspdf';

/**
 * SimulatorFeedback Component
 * 
 * Displays C&P Simulator results with educational gap analysis.
 * Shows predicted rating, rationale, gaps to higher ratings, and actionable advice.
 * 
 * CRITICAL: This is an educational tool, not a guarantee. All feedback based on 38 CFR Part 4.
 */
const SimulatorFeedback = ({ result, conditionName, diagnosticCode, answers, questions, onRestart, onClose }) => {
  if (!result) return null;

  const { predictedRating, ratingRationale, gaps, actionItems, warnings } = result;

  // Generate PDF download
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    const lineHeight = 7;
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    // Helper function to add text with word wrap
    const addText = (text, size = 10, style = 'normal') => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      const lines = doc.splitTextToSize(text, maxWidth);
      
      lines.forEach(line => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      });
    };

    // Title
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('C&P Exam Simulation Results', margin, 15);
    doc.setFontSize(12);
    doc.text(`${conditionName} (DC ${diagnosticCode})`, margin, 25);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 32);

    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPos = 50;

    // Predicted Rating
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Predicted Rating', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235);
    doc.text(`${predictedRating}%`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const rationaleLines = doc.splitTextToSize(ratingRationale, maxWidth);
    rationaleLines.forEach(line => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += lineHeight;
    });
    yPos += 5;

    // Your Responses
    if (questions && answers) {
      yPos += 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Your Responses', margin, yPos);
      yPos += 10;

      questions.forEach((q, idx) => {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Q${idx + 1}: `, margin, yPos);
        
        doc.setFont('helvetica', 'normal');
        const qLines = doc.splitTextToSize(q.question, maxWidth - 10);
        qLines.forEach((line, i) => {
          doc.text(line, margin + (i === 0 ? 10 : 0), yPos);
          yPos += lineHeight;
        });

        const answer = answers[q.id];
        const option = q.options?.find(opt => opt.value === answer);
        if (option) {
          doc.setFont('helvetica', 'italic');
          const aLines = doc.splitTextToSize(`Answer: ${option.label}`, maxWidth);
          aLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += lineHeight;
          });
        }
        yPos += 3;
      });
    }

    // Warnings
    if (warnings && warnings.length > 0) {
      yPos += 5;
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Critical Information', margin, yPos);
      yPos += 10;

      warnings.forEach(warning => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const wLines = doc.splitTextToSize(`• ${warning}`, maxWidth - 5);
        wLines.forEach(line => {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      });
    }

    // Gap Analysis
    if (gaps && gaps.length > 0) {
      yPos += 5;
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Gap Analysis: What You Need to Know', margin, yPos);
      yPos += 10;

      gaps.forEach(gap => {
        doc.setFontSize(10);
        if (gap.startsWith('**')) {
          doc.setFont('helvetica', 'bold');
          const cleanGap = gap.replace(/\*\*/g, '');
          doc.text(cleanGap, margin, yPos);
          yPos += lineHeight + 2;
        } else {
          doc.setFont('helvetica', 'normal');
          const gLines = doc.splitTextToSize(`• ${gap}`, maxWidth - 5);
          gLines.forEach(line => {
            if (yPos > pageHeight - 30) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, margin + 5, yPos);
            yPos += lineHeight;
          });
          yPos += 2;
        }
      });
    }

    // Action Items
    if (actionItems && actionItems.length > 0) {
      yPos += 5;
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Preparation Checklist', margin, yPos);
      yPos += 10;

      actionItems.forEach(item => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const iLines = doc.splitTextToSize(`□ ${item}`, maxWidth - 5);
        iLines.forEach(line => {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      });
    }

    // Disclaimer
    yPos += 10;
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFillColor(240, 240, 240);
    doc.rect(margin - 5, yPos - 5, pageWidth - (margin * 2) + 10, 40, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const disclaimer = 'Disclaimer: This is a training and preparation tool, not legal advice. It does not guarantee any specific rating outcome. Always consult with an accredited VSO or VA-accredited attorney for personalized advice. The information provided is based on 38 CFR Part 4 as of January 2026.';
    const dLines = doc.splitTextToSize(disclaimer, maxWidth);
    dLines.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 5;
    });

    // Save PDF
    const fileName = `CP_Exam_Results_${conditionName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
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
    <div className="space-y-6">
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
          
          <div className="space-y-3 pl-9">
            {gaps.map((gap, index) => (
              <div key={index} className="text-gray-700">
                {gap.startsWith('**') ? (
                  <p className="font-bold text-lg text-purple-800 mt-4 mb-2">
                    {gap.replace(/\*\*/g, '')}
                  </p>
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
