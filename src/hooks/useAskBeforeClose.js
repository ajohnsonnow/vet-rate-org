/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * useAskBeforeClose - closing a tool with an edit that has not been saved
 * asks first. `requestClose` goes wherever the tool's close button and
 * Escape went; it closes at once when there is nothing to lose.
 */
import { useState } from "react";

export default function useAskBeforeClose(hasUnsavedEdit, onClose) {
  const [asking, setAsking] = useState(false);
  return {
    asking,
    requestClose: () => {
      if (hasUnsavedEdit) setAsking(true);
      else onClose();
    },
    stay: () => setAsking(false),
    closeAnyway: () => {
      setAsking(false);
      onClose();
    },
  };
}
