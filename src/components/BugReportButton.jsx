/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * BugReportButton Component
 * Reusable bug report button with animated bug for tool headers
 */

import AnimatedBug from './AnimatedBug';
import { useLanguage } from '../contexts/LanguageContext';

const BugReportButton = ({ 
  onClick, 
  variant = 'header', // 'header', 'footer', 'compact'
  className = '' 
}) => {
  const { t } = useLanguage();
  const variants = {
    header: 'text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1',
    footer: 'text-gray-400 hover:text-red-400 text-sm transition-colors flex items-center gap-1 group',
    compact: 'text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-0.5'
  };
  
  return (
    <button
      onClick={onClick}
      className={`${variants[variant]} ${className}`}
      title="Report a bug in this tool"
    >
      <span className="text-red-400">🐛</span>
      <span className="hidden sm:inline">Bug?</span>
      <AnimatedBug size="xs" />
    </button>
  );
};

export default BugReportButton;
