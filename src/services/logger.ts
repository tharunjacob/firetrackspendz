import { supabase, isCloudEnabled } from './supabase';
import { TABLES } from '@/config/database';

// ============================================================
// EVENTS — Single source of truth for all analytics event names
// ============================================================
export const EVENTS = {
  // Session lifecycle
  SESSION_START:     'session_start',
  SESSION_HEARTBEAT: 'session_heartbeat',
  SESSION_END:       'session_end',

  // Page views
  PAGE_VIEW: 'page_view',

  // Auth
  AUTH_MODAL_OPENED:    'auth_modal_opened',
  AUTH_SIGNUP_ATTEMPTED:'auth_signup_attempted',
  AUTH_SIGNUP_SUCCESS:  'auth_signup_success',
  AUTH_SIGNUP_FAILED:   'auth_signup_failed',
  AUTH_LOGIN_ATTEMPTED: 'auth_login_attempted',
  AUTH_LOGIN_SUCCESS:   'auth_login_success',
  AUTH_LOGIN_FAILED:    'auth_login_failed',
  AUTH_OAUTH_INITIATED: 'auth_oauth_initiated',
  AUTH_MAGIC_LINK_SENT: 'auth_magic_link_sent',
  AUTH_LOGOUT:          'auth_logout',

  // Upload flow
  UPLOAD_FILE_SELECTED:      'upload_file_selected',
  UPLOAD_FILE_DROPPED:       'upload_file_dropped',
  UPLOAD_ANALYSIS_STARTED:   'upload_analysis_started',
  UPLOAD_ANALYSIS_COMPLETED: 'upload_analysis_completed',
  UPLOAD_ANALYSIS_FAILED:    'upload_analysis_failed',

  // Dashboard engagement
  DASHBOARD_TAB_SWITCHED: 'dashboard_tab_switched',
  DASHBOARD_TAB_TIME:     'dashboard_tab_time',

  // Feature usage (one per premium feature)
  FEATURE_FIRE_OPENED:       'feature_fire_opened',
  FEATURE_AI_ADVISOR_OPENED: 'feature_ai_advisor_opened',
  FEATURE_NET_WORTH_OPENED:  'feature_net_worth_opened',
  FEATURE_GOALS_OPENED:      'feature_goals_opened',
  FEATURE_BUDGETS_OPENED:    'feature_budgets_opened',
  FEATURE_RECURRING_OPENED:  'feature_recurring_opened',
  FEATURE_TRENDS_OPENED:     'feature_trends_opened',
  FEATURE_COMPARE_OPENED:    'feature_compare_opened',
  FEATURE_WRAPPED_OPENED:    'feature_wrapped_opened',

  // Conversion funnel
  PAYWALL_IMPRESSION:  'paywall_impression',
  PAYWALL_CTA_CLICKED: 'paywall_cta_clicked',
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  UPGRADE_CLICKED:     'upgrade_clicked',

  // Errors
  ERROR_BOUNDARY_CAUGHT: 'error_boundary_caught',

  // Admin actions
  ADMIN_PLAN_CHANGED:      'admin_plan_changed',
  ADMIN_RULE_PROMOTED:     'admin_rule_promoted',
  ADMIN_RULE_DELETED:      'admin_rule_deleted',
  ADMIN_MIMIC_STARTED:     'admin_mimic_started',
  ADMIN_FEEDBACK_RESOLVED: 'admin_feedback_resolved',

  // Legacy events — kept for backward compatibility
  FILE_PROCESSED:       'file_processed',
  RULE_PROPOSED:        'rule_proposed',
  DATA_SAVED_CLOUD:     'data_saved_cloud',
  DATA_SAVED_LOCAL:     'data_saved_local',
  DATA_DELETED_CLOUD:   'data_deleted_cloud',
  DATA_DELETED_LOCAL:   'data_deleted_local',
  SYNC_LOCAL_TO_CLOUD:  'sync_local_to_cloud',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

// ============================================================
// Internal state
// ============================================================
const SESSION_ID = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const SESSION_START_MS = Date.now();
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 10;

interface QueuedEvent {
  event: string;
  metadata: Record<string, unknown>;
  level: 'info' | 'error' | 'warn';
  path: string;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Cached from Supabase auth — updated via onAuthStateChange
let cachedUserId: string | null = null;
let cachedEmail: string | null = null;

// Wire up auth state cache so we don't call getSession() on every event
if (isCloudEnabled()) {
  const sb = supabase!;
  sb.auth.getSession().then(({ data: { session } }) => {
    cachedUserId = session?.user?.id || null;
    cachedEmail  = session?.user?.email || null;
  }).catch(() => {/* ignore */});

  sb.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id || null;
    cachedEmail  = session?.user?.email || null;
  });
}

// ============================================================
// Batch flush
// ============================================================
const flush = async () => {
  flushTimer = null;
  if (eventQueue.length === 0 || !isCloudEnabled()) { eventQueue = []; return; }

  const batch = eventQueue.splice(0, eventQueue.length);
  try {
    const rows = batch.map(e => ({
      user_id:    cachedUserId || null,
      email:      cachedEmail  || 'Guest',
      session_id: SESSION_ID,
      event:      e.event,
      metadata:   { ...e.metadata, timezone: TIMEZONE },
      level:      e.level,
      path:       e.path,
    }));
    await supabase!.from(TABLES.APP_LOGS).insert(rows);
  } catch {
    // Fail silently — logging must never break the app
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
};

// ============================================================
// Core logEvent — the single public API for all tracking
// ============================================================
export const logEvent = async (
  eventName: string,
  metadata: Record<string, unknown> = {},
  level: 'info' | 'error' | 'warn' = 'info'
): Promise<void> => {
  try { if (localStorage.getItem('tsz_consent') === 'false') return; } catch { /* not available */ }

  if (import.meta.env.DEV) {
    const color = level === 'error' ? 'color:#c00' : level === 'warn' ? 'color:#a60' : 'color:#33c';
    console.log(`%c[${level}] ${eventName}`, color, metadata);
  }

  eventQueue.push({ event: eventName, metadata, level, path: window.location.pathname });

  // Flush immediately on errors or when batch is full
  if (level === 'error' || eventQueue.length >= FLUSH_BATCH_SIZE) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    await flush();
  } else {
    scheduleFlush();
  }
};

// ============================================================
// Convenience helpers
// ============================================================
export const logPageView = (path: string): void => {
  logEvent(EVENTS.PAGE_VIEW, { path });
};

export const getSessionId = () => SESSION_ID;

// ============================================================
// Session lifecycle — fires automatically on import
// ============================================================
logEvent(EVENTS.SESSION_START, {
  referrer:     document.referrer || null,
  userAgent:    navigator.userAgent,
  screenWidth:  screen.width,
  screenHeight: screen.height,
});

// Heartbeat every 60s while the tab is visible
const _heartbeatInterval = setInterval(() => {
  if (document.visibilityState === 'visible') {
    logEvent(EVENTS.SESSION_HEARTBEAT, { elapsed_ms: Date.now() - SESSION_START_MS });
  }
}, 60_000);

// Flush remaining events on tab close
window.addEventListener('beforeunload', () => {
  clearInterval(_heartbeatInterval);
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

  logEvent(EVENTS.SESSION_END, {
    duration_ms: Date.now() - SESSION_START_MS,
  });

  // Best-effort drain via fetch+keepalive on tab close
  if (eventQueue.length > 0 && isCloudEnabled()) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
      const rows = eventQueue.map(e => ({
        user_id:    cachedUserId || null,
        email:      cachedEmail  || 'Guest',
        session_id: SESSION_ID,
        event:      e.event,
        metadata:   { ...e.metadata, timezone: TIMEZONE },
        level:      e.level,
        path:       e.path,
      }));
      try {
        fetch(`${url}/rest/v1/app_logs`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(rows),
          keepalive: true,
        });
      } catch {
        // Best-effort — if this fails on tab close, events are lost (acceptable)
      }
      eventQueue = [];
    }
  }
});
