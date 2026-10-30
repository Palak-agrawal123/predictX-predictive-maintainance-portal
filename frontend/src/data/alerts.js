/**
 * Real-time alert notifications for the industrial portal.
 * Real notifications are created dynamically from application events:
 * - Machine health & ML prediction risks (High/Critical risk, low RUL, sensor anomalies)
 * - Work order lifecycle (created, assigned, in progress, completed)
 * - Human-in-the-loop reviews (confirmations, priority overrides)
 * - Machine fleet updates (registration, status changes)
 * 
 * Strictly no dummy data: all notifications originate from backend database events.
 */
export const initialAlerts = [];
