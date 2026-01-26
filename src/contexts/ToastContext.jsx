/**
 * ToastContext.jsx - Global Toast Notification System
 * 
 * Sprint 5: UI Polish - User feedback for Formation workflow
 * 
 * Features:
 * - Success, error, warning, info toast types
 * - Auto-dismiss after 5 seconds
 * - Manual dismiss with X button
 * - Stack multiple toasts
 * - Smooth slide-in/out animations
 * - Accessible (screen reader support)
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message, duration) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const warning = useCallback((message, duration) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const info = useCallback((message, duration) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div 
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          toast={toast} 
          onRemove={() => onRemove(toast.id)} 
        />
      ))}
    </div>
  );
};

const Toast = ({ toast, onRemove }) => {
  const { message, type } = toast;
  
  const typeStyles = {
    success: {
      bg: 'bg-green-600',
      icon: '✓',
      border: 'border-green-500'
    },
    error: {
      bg: 'bg-red-600',
      icon: '✕',
      border: 'border-red-500'
    },
    warning: {
      bg: 'bg-yellow-600',
      icon: '⚠',
      border: 'border-yellow-500'
    },
    info: {
      bg: 'bg-blue-600',
      icon: 'ℹ',
      border: 'border-blue-500'
    }
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div 
      className={`${style.bg} ${style.border} border-2 text-white px-4 py-3 rounded-lg shadow-2xl min-w-[300px] max-w-md pointer-events-auto animate-slide-in-right flex items-start gap-3`}
      role="alert"
    >
      <span className="text-2xl flex-shrink-0" aria-hidden="true">
        {style.icon}
      </span>
      <p className="flex-1 text-sm font-medium leading-relaxed">
        {message}
      </p>
      <button
        onClick={onRemove}
        className="text-white hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default ToastProvider;
