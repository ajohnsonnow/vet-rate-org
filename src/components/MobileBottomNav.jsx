/**
 * SupplyLocker.org - Mobile Bottom Navigation
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * AAAAA Design System - "Thumb Zone" Optimized Navigation
 * 
 * All critical triggers positioned in the bottom 40% of the screen
 * for easy one-handed operation. Meets AAA target size requirements
 * (minimum 44x44px touch targets).
 * 
 * Features:
 * - Search: Quick access to conditions/diagnostic codes
 * - Calculator: Real-time rating updates
 * - My Packet: Quick evidence access
 * - More: Mission Roadmap and full tool access
 */

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const NAV_ITEMS = [
  {
    id: 'search',
    label: 'Search',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'calculator',
    label: 'Calculator',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    badge: null, // Can show current rating
  },
  {
    id: 'packet',
    label: 'My Packet',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    badge: null, // Can show condition count
  },
  {
    id: 'missions',
    label: 'Missions',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    highlight: true, // New feature highlight
  },
];

export default function MobileBottomNav({
  activeItem = null,
  onSearchClick,
  onCalculatorClick,
  onPacketClick,
  onMissionsClick,
  conditionCount = 0,
  currentRating = null,
}) {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  const [pressedItem, setPressedItem] = useState(null);
  
  const handleClick = (itemId) => {
    // Haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    switch (itemId) {
      case 'search':
        onSearchClick?.();
        break;
      case 'calculator':
        onCalculatorClick?.();
        break;
      case 'packet':
        onPacketClick?.();
        break;
      case 'missions':
        onMissionsClick?.();
        break;
    }
  };
  
  const getBadge = (itemId) => {
    if (itemId === 'packet' && conditionCount > 0) {
      return conditionCount;
    }
    if (itemId === 'calculator' && currentRating !== null) {
      return `${currentRating}%`;
    }
    return null;
  };
  
  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 z-40 md:hidden
        ${isDark || isTbiComfort ? 'bg-gray-900/95' : 'bg-white/95'}
        backdrop-blur-lg border-t
        ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'}
        ${isAaaContrast ? 'border-white border-t-2' : ''}
        safe-area-bottom
      `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          const badge = getBadge(item.id);
          
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              onTouchStart={() => setPressedItem(item.id)}
              onTouchEnd={() => setPressedItem(null)}
              className={`
                relative flex flex-col items-center justify-center flex-1 py-2 px-1
                min-h-[60px] min-w-touch
                transition-all duration-150 ease-out
                ${isActive 
                  ? `${isDark || isTbiComfort ? 'text-blue-400' : 'text-blue-600'}` 
                  : `${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-500'}`}
                ${pressedItem === item.id ? 'scale-95 opacity-80' : ''}
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                ${isAaaContrast && isActive ? 'text-yellow-400' : ''}
              `}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              <div className="relative">
                {item.icon(isActive)}
                
                {/* Badge */}
                {badge && (
                  <span className={`
                    absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1
                    flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${isDark || isTbiComfort ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}
                  `}>
                    {badge}
                  </span>
                )}
                
                {/* New feature highlight */}
                {item.highlight && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                )}
              </div>
              
              {/* Label */}
              <span className={`
                text-[10px] font-medium mt-1 truncate max-w-full
                ${isActive ? 'font-bold' : ''}
              `}>
                {item.label}
              </span>
              
              {/* Active indicator bar */}
              {isActive && (
                <span className={`
                  absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full
                  ${isDark || isTbiComfort ? 'bg-blue-400' : 'bg-blue-600'}
                  ${isAaaContrast ? 'bg-yellow-400' : ''}
                `} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Spacer component to prevent content from being hidden behind the bottom nav
 */
export function MobileNavSpacer() {
  return <div className="h-[70px] md:hidden" aria-hidden="true" />;
}

/**
 * Hook to track which nav item should be active based on current view
 */
export function useMobileNavState(currentView) {
  const viewToNavItem = {
    'search': 'search',
    'smart-search': 'search',
    'command-search': 'search',
    'tactical-calculator': 'calculator',
    'calculator': 'calculator',
    'whatif-sandbox': 'calculator',
    'million-dollar': 'calculator',
    'my-packet': 'packet',
    'packet': 'packet',
    'mission-roadmap': 'missions',
    'missions': 'missions',
    'workflow-guide': 'missions',
  };
  
  return viewToNavItem[currentView] || null;
}
