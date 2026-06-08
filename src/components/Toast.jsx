/**
 * Toast Notification System
 * Non-intrusive notifications for errors, successes, and warnings
 * Military-themed messaging for veteran users
 */

import { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Toast severity levels
 */
export const ToastType = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  NETWORK: "network",
};

/**
 * Individual Toast component
 */
const Toast = ({
  id,
  type,
  title,
  message,
  action,
  duration,
  onClose,
  onAction,
}) => {
  const { _t } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);

  // Errors, warnings, and network drops interrupt (assertive); success/info
  // wait their turn (polite) so a screen reader isn't yanked off-task.
  const isUrgent =
    type === ToastType.ERROR ||
    type === ToastType.WARNING ||
    type === ToastType.NETWORK;

  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    handleClose();
  };

  // Icon and color based on type
  const getIcon = () => {
    switch (type) {
      case ToastType.SUCCESS:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case ToastType.ERROR:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case ToastType.WARNING:
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case ToastType.NETWORK:
        return <WifiOff className="w-5 h-5 text-orange-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case ToastType.SUCCESS:
        return "border-l-green-500";
      case ToastType.ERROR:
        return "border-l-red-500";
      case ToastType.WARNING:
        return "border-l-amber-500";
      case ToastType.NETWORK:
        return "border-l-orange-500";
      default:
        return "border-l-blue-500";
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 mb-3 
        bg-white dark:bg-gray-800 
        border-l-4 ${getBorderColor()}
        rounded-lg shadow-lg
        transform transition-all duration-300 ease-out
        ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
        min-w-[320px] max-w-[480px]
      `}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
            {title}
          </p>
        )}
        {message && (
          <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
        )}

        {action && (
          <button
            onClick={handleAction}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-va-blue dark:text-va-gold hover:underline focus:outline-none focus:ring-2 focus:ring-va-gold rounded px-1"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold rounded p-1"
        aria-label="Close notification"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

/**
 * Toast Container - Manages multiple toasts
 */
export const ToastContainer = ({ toasts, onClose, onAction }) => {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] pointer-events-none"
      aria-live="polite"
    >
      <div className="flex flex-col pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onClose}
            onAction={() =>
              onAction && onAction(toast.id, toast.action?.callback)
            }
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Toast Manager - Global state management
 */
class ToastManager {
  constructor() {
    this.toasts = [];
    this.listeners = [];
    this.nextId = 1;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.toasts));
  }

  add(toast) {
    const id = `toast-${this.nextId++}`;
    const newToast = {
      id,
      duration: 5000, // Default 5 seconds
      ...toast,
    };

    this.toasts = [...this.toasts, newToast];
    this.notify();
    return id;
  }

  remove(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  // Convenience methods
  success(title, message, action) {
    return this.add({ type: ToastType.SUCCESS, title, message, action });
  }

  error(title, message, action) {
    return this.add({
      type: ToastType.ERROR,
      title,
      message,
      action,
      duration: 0, // Errors don't auto-dismiss
    });
  }

  warning(title, message, action) {
    return this.add({ type: ToastType.WARNING, title, message, action });
  }

  info(title, message, action) {
    return this.add({ type: ToastType.INFO, title, message, action });
  }

  network(title, message, action) {
    return this.add({
      type: ToastType.NETWORK,
      title: title || "Connection Interrupted",
      message: message || "Network connection unstable. Your data is safe.",
      action: action || {
        label: "Retry Transmission",
        icon: RefreshCw,
      },
      duration: 0, // Network errors don't auto-dismiss
    });
  }
}

// Global singleton instance
export const toastManager = new ToastManager();

/**
 * React hook for using toasts
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  const handleClose = (id) => {
    toastManager.remove(id);
  };

  const handleAction = (id, callback) => {
    if (callback) {
      callback();
    }
    toastManager.remove(id);
  };

  return {
    toasts,
    onClose: handleClose,
    onAction: handleAction,
    toast: toastManager,
  };
};

export default ToastContainer;
