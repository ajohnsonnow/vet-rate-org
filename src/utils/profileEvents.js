/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Window events about the saved profile. Kept in a file with no imports so the
 * console capture (which loads at boot, before the profile module) and the
 * profile module share the names without depending on each other.
 */

export const PROFILE_CHANGED_EVENT = "vetrate:profile-changed";
export const PROFILE_UNREADABLE_EVENT = "vetrate:profile-unreadable";
