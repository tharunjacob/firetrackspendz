// ============================================================
// ROUTE CONFIGURATION — Single source of truth for all routes
// ============================================================
//
// WHY THIS FILE EXISTS:
// Every route path is defined here ONCE. All components import
// from here instead of hardcoding strings like "/dashboard".
// This prevents broken links when routes change.
//
// HOW TO USE:
// import { ROUTES } from '@/config/routes';
// <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
// <Route path={ROUTES.DASHBOARD} element={...} />
//
// WHEN TO EDIT:
// - Adding a new page? Add the route here first.
// - Renaming a route? Change it here — all consumers update automatically.
// - NEVER hardcode a route string anywhere else in the codebase.
// ============================================================

export const ROUTES = {
  // Public pages (no auth required)
  HOME: '/',
  PRICING: '/pricing',
  FEATURES: '/features',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  REFUND: '/refund-policy',
  SHIPPING: '/shipping-policy',
  CONTACT: '/contact',
  HELP: '/help',
  AUTH_CALLBACK: '/auth/callback',

  // Dashboard (open to all — upload-first experience)
  DASHBOARD: '/dashboard',

  // Feedback (open to all — even anonymous users can report issues)
  FEEDBACK: '/feedback',

  // Protected pages (require sign-in)
  ASSETS: '/net-assets',
  SETTINGS: '/settings',
  FAMILY: '/family',

  // Public tool pages (SEO landing pages — no auth required)
  FIRE_CALCULATOR_TOOL: '/tools/fire-calculator',
  SAVINGS_RATE_TOOL: '/tools/savings-rate',

  // Admin (secret URL — requires admin email)
  ADMIN: '/ctrl-room-7x9k',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
