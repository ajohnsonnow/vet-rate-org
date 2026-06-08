import { AdminAuthProvider } from "../../contexts/AdminAuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { LocalAIProvider } from "../../components/LocalAIPanel";
import { ToastProvider } from "../../contexts/ToastContext";
import { FocusModeProvider } from "../../contexts/FocusModeContext";
import { HelperModeProvider } from "../../contexts/HelperModeContext";

/**
 * AppProviders — the 6-deep provider stack that wraps <App />.
 *
 * Nesting order is intentional and load-bearing — do not reorder
 * without checking each context's consumers:
 *
 *   AdminAuth   (outermost: admin gates may short-circuit downstream)
 *   Language    (i18n strings used by every UI provider below)
 *   LocalAI     (model availability needed by Toast + HelperMode)
 *   Toast       (FocusMode + HelperMode emit toasts on transitions)
 *   FocusMode   (HelperMode reads focus state)
 *   HelperMode  (innermost: closest to the consuming UI)
 *
 * Extracted from App.jsx (audit #35, B81).
 */
export default function AppProviders({ children }) {
  return (
    <AdminAuthProvider>
      <LanguageProvider>
        <LocalAIProvider>
          <ToastProvider>
            <FocusModeProvider>
              <HelperModeProvider>{children}</HelperModeProvider>
            </FocusModeProvider>
          </ToastProvider>
        </LocalAIProvider>
      </LanguageProvider>
    </AdminAuthProvider>
  );
}
