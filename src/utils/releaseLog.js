/**
 * SupplyLocker.org - Release Log
 * 
 * This file tracks resolved ticket IDs (FEAT-xxxx, BUG-xxxx) so veterans can
 * see when their reported issues have been fixed or features implemented.
 * 
 * HOW TO USE (Developer Workflow):
 * 1. When you fix a bug or implement a feature request, add the ticket ID here
 * 2. Optionally add the version it was released in
 * 3. Push to GitHub - veterans will see their tickets marked as "Completed" automatically!
 * 
 * Built by a fellow veteran. "Every ticket gets an answer."
 */

// ============================================
// RESOLVED TICKETS
// ============================================

/**
 * Array of resolved ticket IDs
 * Add your completed tickets here before pushing a release
 * Format: { id: 'FEAT-XXXXXXXX' or 'BUG-XXXXXXXX', version: '1.2.1', note: 'optional note' }
 */
export const resolvedTickets = [
  // Example entries (replace with actual resolved tickets):
  // { id: 'FEAT-EXAMPLE1', version: '1.2.0', note: 'Added dark mode toggle' },
  // { id: 'BUG-EXAMPLE2', version: '1.2.1', note: 'Fixed calculator rounding error' },
];

/**
 * Quick lookup Set for efficient checking
 * @type {Set<string>}
 */
export const resolvedTicketIds = new Set(resolvedTickets.map(t => t.id));

/**
 * Check if a ticket has been resolved
 * @param {string} ticketId - The ticket ID (e.g., 'FEAT-ABCD1234' or 'BUG-XYZ12345')
 * @returns {boolean}
 */
export const isTicketResolved = (ticketId) => {
  return resolvedTicketIds.has(ticketId);
};

/**
 * Get resolution details for a ticket
 * @param {string} ticketId - The ticket ID
 * @returns {Object|null} - Resolution details or null if not resolved
 */
export const getTicketResolution = (ticketId) => {
  return resolvedTickets.find(t => t.id === ticketId) || null;
};

/**
 * Get all resolved tickets for a specific version
 * @param {string} version - The version string (e.g., '1.2.1')
 * @returns {Array}
 */
export const getResolvedByVersion = (version) => {
  return resolvedTickets.filter(t => t.version === version);
};

/**
 * Check multiple tickets at once and return which ones are resolved
 * @param {string[]} ticketIds - Array of ticket IDs to check
 * @returns {Object} - { resolved: [...], pending: [...] }
 */
export const checkMultipleTickets = (ticketIds) => {
  const resolved = [];
  const pending = [];
  
  for (const id of ticketIds) {
    if (resolvedTicketIds.has(id)) {
      resolved.push({
        id,
        ...getTicketResolution(id)
      });
    } else {
      pending.push(id);
    }
  }
  
  return { resolved, pending };
};

export default {
  resolvedTickets,
  resolvedTicketIds,
  isTicketResolved,
  getTicketResolution,
  getResolvedByVersion,
  checkMultipleTickets
};
