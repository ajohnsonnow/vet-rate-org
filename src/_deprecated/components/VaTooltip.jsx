/**
 * VA Tooltip Component - "Jargon Decoder"
 * Displays definitions for VA terminology on hover
 * 
 * Usage:
 *   <VaTerm term="C&P">C&P Exam</VaTerm>
 *   
 * Or use the auto-highlighter:
 *   <VaTermHighlighter text="You need a C&P Exam for your claim." />
 */

import React, { useState, useRef, useEffect } from 'react';
import { getDefinition } from '../utils/vaGlossary';
import { highlightVATermsReact } from '../utils/glossaryHighlighter';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Individual VA term with tooltip
 */
export const VaTerm = ({ term, definition, children, className = '' }) => {
  const { t } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState('');
  const termRef = useRef(null);

  // Auto-fetch definition if not provided
  const displayDefinition = definition || getDefinition(term);

  useEffect(() => {
    if (showTooltip && termRef.current) {
      const rect = termRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let position = '';

      // Check horizontal position
      if (rect.left < 160) {
        position += ' tooltip-right';
      } else if (rect.right > windowWidth - 160) {
        position += ' tooltip-left';
      }

      // Check vertical position
      if (rect.top < 100) {
        position += ' tooltip-bottom';
      }

      setTooltipPosition(position);
    }
  }, [showTooltip]);

  if (!displayDefinition) {
    return <>{children}</>;
  }

  return (
    <span
      ref={termRef}
      className={`va-term ${className}`.trim()}
      data-term={term}
      data-definition={displayDefinition}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="tooltip"
      aria-label={`${term}: ${displayDefinition}`}
    >
      {children}
      {showTooltip && (
        <span className={`va-tooltip ${tooltipPosition}`.trim()}>
          <span className="va-tooltip-term">{term}</span>
          {displayDefinition}
        </span>
      )}
    </span>
  );
};

/**
 * Automatic VA term highlighter component
 * Scans text and automatically wraps VA terms with tooltips
 */
export const VaTermHighlighter = ({ 
  text, 
  className = '',
  excludeTerms = [],
  caseSensitive = false 
}) => {
  if (!text) return null;

  const elements = highlightVATermsReact(text, { excludeTerms, caseSensitive });

  return (
    <span className={className}>
      {elements.map((element, index) => {
        if (typeof element === 'string') {
          return <React.Fragment key={index}>{element}</React.Fragment>;
        }
        
        if (element.type === 'va-term') {
          return (
            <VaTerm 
              key={element.key} 
              term={element.term}
              definition={element.definition}
            >
              {element.displayText}
            </VaTerm>
          );
        }
        
        return null;
      })}
    </span>
  );
};

/**
 * Helper hook for components that need to add tooltips to dynamic content
 */
export const useVATooltips = (contentRef, dependencies = []) => {
  useEffect(() => {
    if (!contentRef.current) return;

    const terms = contentRef.current.querySelectorAll('.va-term');
    
    terms.forEach(termElement => {
      const term = termElement.getAttribute('data-term');
      const definition = termElement.getAttribute('data-definition');
      
      if (!definition) return;

      const handleMouseEnter = () => {
        const tooltip = document.createElement('span');
        tooltip.className = 'va-tooltip';
        tooltip.innerHTML = `<span class="va-tooltip-term">${term}</span>${definition}`;
        termElement.appendChild(tooltip);
        
        // Position adjustment
        setTimeout(() => {
          const rect = termElement.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();
          
          if (rect.left < 160) {
            tooltip.classList.add('tooltip-right');
          } else if (rect.right > window.innerWidth - 160) {
            tooltip.classList.add('tooltip-left');
          }
          
          if (rect.top < 100) {
            tooltip.classList.add('tooltip-bottom');
          }
        }, 10);
      };

      const handleMouseLeave = () => {
        const tooltip = termElement.querySelector('.va-tooltip');
        if (tooltip) tooltip.remove();
      };

      termElement.addEventListener('mouseenter', handleMouseEnter);
      termElement.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        termElement.removeEventListener('mouseenter', handleMouseEnter);
        termElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
  }, [contentRef, ...dependencies]);
};

/**
 * Higher-order component to add VA tooltips to any component's text content
 */
export const withVATooltips = (WrappedComponent) => {
  return function WithVATooltipsComponent(props) {
    const { text, children, ...otherProps } = props;
    
    if (text && typeof text === 'string') {
      return (
        <WrappedComponent {...otherProps}>
          <VaTermHighlighter text={text} />
        </WrappedComponent>
      );
    }
    
    return <WrappedComponent {...props}>{children}</WrappedComponent>;
  };
};

export default VaTerm;
