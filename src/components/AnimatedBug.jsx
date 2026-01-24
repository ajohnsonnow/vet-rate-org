/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * AnimatedBug Component
 * A fun animated bug that occasionally crawls around its container
 * Used in bug report buttons throughout the app
 */

import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const AnimatedBug = ({ size = 'sm', className = '' }) => {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStyle, setAnimationStyle] = useState({});
  
  // Bug crawls randomly every 5-15 seconds
  useEffect(() => {
    const triggerAnimation = () => {
      // Random animation type
      const animations = [
        'crawl-right',
        'crawl-left', 
        'crawl-circle',
        'wiggle',
        'flip'
      ];
      const randomAnim = animations[Math.floor(Math.random() * animations.length)];
      
      setAnimationStyle({ animation: `bug-${randomAnim} 0.8s ease-in-out` });
      setIsAnimating(true);
      
      // Reset after animation completes
      setTimeout(() => {
        setIsAnimating(false);
        setAnimationStyle({});
      }, 800);
    };
    
    // Initial delay 2-8 seconds
    const initialDelay = 2000 + Math.random() * 6000;
    let interval; // Declare interval in outer scope for cleanup
    
    const initialTimeout = setTimeout(() => {
      triggerAnimation();
      
      // Then repeat every 5-15 seconds
      interval = setInterval(() => {
        triggerAnimation();
      }, 5000 + Math.random() * 10000);
    }, initialDelay);
    
    return () => {
      clearTimeout(initialTimeout);
      if (interval) clearInterval(interval); // Clean up interval
    };
  }, []);
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
  
  return (
    <span 
      className={`inline-block ${sizeClasses[size]} ${className}`}
      style={{
        ...animationStyle,
        display: 'inline-block',
        transformOrigin: 'center center'
      }}
    >
      🪲
    </span>
  );
};

// CSS keyframes injected once
const injectStyles = () => {
  if (document.getElementById('animated-bug-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'animated-bug-styles';
  style.textContent = `
    @keyframes bug-crawl-right {
      0% { transform: translateX(0) rotate(0deg); }
      25% { transform: translateX(3px) rotate(10deg); }
      50% { transform: translateX(6px) rotate(-5deg); }
      75% { transform: translateX(3px) rotate(8deg); }
      100% { transform: translateX(0) rotate(0deg); }
    }
    
    @keyframes bug-crawl-left {
      0% { transform: translateX(0) rotate(0deg); }
      25% { transform: translateX(-3px) rotate(-10deg); }
      50% { transform: translateX(-6px) rotate(5deg); }
      75% { transform: translateX(-3px) rotate(-8deg); }
      100% { transform: translateX(0) rotate(0deg); }
    }
    
    @keyframes bug-crawl-circle {
      0% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(4px, -3px) rotate(90deg); }
      50% { transform: translate(0, -6px) rotate(180deg); }
      75% { transform: translate(-4px, -3px) rotate(270deg); }
      100% { transform: translate(0, 0) rotate(360deg); }
    }
    
    @keyframes bug-wiggle {
      0%, 100% { transform: rotate(0deg); }
      20% { transform: rotate(-15deg); }
      40% { transform: rotate(15deg); }
      60% { transform: rotate(-10deg); }
      80% { transform: rotate(10deg); }
    }
    
    @keyframes bug-flip {
      0% { transform: rotateY(0deg) scale(1); }
      50% { transform: rotateY(180deg) scale(1.2); }
      100% { transform: rotateY(360deg) scale(1); }
    }
  `;
  document.head.appendChild(style);
};

// Inject styles on first import
if (typeof window !== 'undefined') {
  injectStyles();
}

export default AnimatedBug;
