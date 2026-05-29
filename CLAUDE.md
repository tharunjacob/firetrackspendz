# TrackSpendZ v2 — AI Developer Context File

> **This file gives any AI assistant full context to work on this codebase.**
> Read ARCHITECTURE.md for structural rules. Read SETUP.md for environment setup.

## What Is TrackSpendZ?

A personal finance web app that lets users upload bank/credit card statements (Excel, CSV, PDF), auto-categorizes transactions using 150+ built-in merchant patterns + user-trained AI rules, and provides 14 interactive dashboard views for financial analysis, FIRE planning, net worth tracking, and budgeting.

**Tech stack:** React 18 + TypeScript + Vite + Tailwind CSS + Supabase (auth + DB) + Google Gemini 2.0 Flash (AI) + Recharts + XLSX + PDF.js

**Live URL:** https://trackspendz.com
**Admin panel:** /ctrl-room-7x9k (email-gated, fake 404 for non-admins)

---

## Core Business Logic You Must Understand

### Upload-First (No Signup Required)
- Dashboard at `/dashboard` is PUBLIC — anyone can upload files and see results
- Anonymous users: transactions held in memory, capped at 500 visible
- `PaywallBanner` appears when anonymous user has >500 transactions
- On signup: all in-memory transactions are promoted to Supabase cloud storage
- This is the PRIMARY conversion funnel — do not break it

### Smart Categorization & Learning Rules
- `transformer.ts` parses uploaded files → `Transaction[]`
- Built-in: 150+ keyword→category mappings in transformer.ts
- `learningRules.ts` provides additional user-trained rules stored in Supabase `category_rules` table
- When user edits a transaction's category in DataView, `createRuleFromEdit()` auto-saves a rule
- `original_description` preserves the raw bank text at import time (immutable)
- `notes` is the user-editable description field
- Rules: `applyRules(text, 'category')` does case-insensitive substring matching, longest keyword wins

### Dual Storage System
- **Free/Anonymous:** localStorage only (`localStorage.ts`)
- **Pro/Enterprise:** Supabase cloud (`cloudStorage.ts`)
- `storage.ts` orchestrates which backend to use based on auth state
- Net assets use IndexedDB locally + Supabase cloud (`assetStorage.ts`)

### AI Features (Google Gemini)
- `gemini.ts` — all AI functions
- `detectFileStructure()` — auto-detects column mapping for unknown file formats
- `detectAssetFileStructure()` — same for net asset Excel uploads
- `generateFinancialInsights()` — generates insights from transaction summary
- `getStrategicAdvice()` — chat-style financial advisor
- `isAIAvailable()` — checks if Gemini API key is configured
- Model: `gemini-2.0-flash` (NOT 2.5 — copy must match)

### Subscription Plans
- **Free:** 500 transactions, local storage, basic categorization
- **Pro:** Unlimited transactions, AI advisor, FIRE calculator, cloud sync, budgets
  - India: ₹199/mo or ₹1,499/yr — International: $4.99/mo or $49/yr
- **Enterprise:** Family accounts (5 members), API access (coming soon), custom rules
  - India: ₹499/mo or ₹3,999/yr — International: $14.99/mo or $149/yr
- Plan gating: `canAccessFeature(plan, feature)` in `config/plans.ts`
- **Payments: Razorpay** via `services/paymentProvider.ts` → `services/razorpay.ts`.
  Stripe (`services/stripe.ts`) is a deprecated stub kept for future USD revival.
  See `RAZORPAY_SETUP.md` for the activation checklist.

---

## The 15 Dashboard Tabs

Defined in `DASHBOARD_TABS` array in `types/index.ts`. Tabs are grouped into three sections (TAB_GROUPS): **Analyze**, **Take Control**, and **Plan Ahead**.

| Tab | Component | Group | What It Does |
|-----|-----------|-------|-------------|
| Summary | SummaryView | Analyze | Donut charts, key metrics, income vs expense bars, savings trend |
| Yearly Analysis | YearlyView | Analyze | Year-over-year comparison |
| Monthly Analysis | MonthlyView | Analyze | Month-by-month bars, cumulative savings |
| Categories | CategoriesView | Analyze | Category drilldown with stacked charts |
| Trends | TrendsView | Analyze | Multi-line trend charts for top categories |
| Compare | CompareView | Analyze | Side-by-side period comparison (month vs month or year vs year) |
| Data | DataView | Take Control | Transaction table with inline editing, search, sort, bulk delete |
| Budgets | BudgetsView | Take Control | Monthly category budgets with 80%/100% alerts |
| Goals | GoalsView | Take Control | Savings goals with progress bars and projections |
| Recurring | RecurringView | Take Control | Auto-detected recurring charges with confidence scores |
| FIRE Calculator | FireView | Plan Ahead | FIRE number, scenarios tab, Monte Carlo simulation |
| Net Worth | NetWorthView | Plan Ahead | Quick net worth with manual assets + link to full tracker |
| Debt Payoff | DebtPayoffView | Plan Ahead | Snowball/Avalanche payoff planner with debt-free date (Pro+) |
| AI Advisor | AIAdvisorView | Plan Ahead | Chat with Gemini about your finances |
| Year Review | WrappedView | Plan Ahead | Spotify Wrapped-style annual financial summary |

---

## State Management

Three independent React contexts (avoid prop drilling):

```
AppProvider
  └─ UIProvider     → currency, activeTab, toasts, isAuthOpen
      └─ AuthProvider → userId, email, profile, plan, login/logout
          └─ DataProvider → transactions, processFiles, updateTransactions, deleteTransactions
```

**For existing code:** `useApp()` combines all three (compatibility wrapper).
**For new code:** Use `useAuth()`, `useData()`, or `useUI()` directly.

---

## Key File Reference

### Critical (edit with extreme care)
| File | Why |
|------|-----|
| `types/index.ts` | 24+ imports — every type in the app |
| `contexts/AppContext.tsx` | 24+ imports — compatibility wrapper |
| `services/transformer.ts` | All file parsing — wrong = corrupt data |
| `utils/constants.ts` | All currency formatting, categories |
| `components/common/Icons.tsx` | 23+ imports — every icon |

### Business Logic (services/)
| File | Purpose |
|------|---------|
| `transformer.ts` | Parse Excel/CSV/PDF → Transaction[] |
| `learningRules.ts` | Save/load/apply category rules |
| `analysis.ts` | FIRE metrics, anomaly detection, monthly breakdown |
| `gemini.ts` | AI advisor, file structure detection, PDF extraction |
| `aiProxy.ts` | Routes AI calls — Supabase Edge Function in prod, direct API in dev |
| `monteCarlo.ts` | Monte Carlo simulations for FIRE |
| `assetStorage.ts` | Net asset CRUD + Excel parsing + AI mapping |
| `storage.ts` | Transaction storage orchestration (local vs cloud routing) |
| `cloudStorage.ts` | Supabase cloud read/write for transactions |
| `localStorage.ts` | IndexedDB local read/write for transactions |
| `userSettings.ts` | Per-user key/value store — localStorage for free, Supabase for Pro |
| `notifications.ts` | Smart notification generation (6 alert categories) |
| `referral.ts` | Referral program (generate codes, claim on signup, reward at 3) |
| `achievements.ts` | Gamification — upload/savings/budget streaks + FIRE milestones |
| `debtPayoff.ts` | Snowball/Avalanche payoff calculations for DebtPayoffView |
| `categorizer.ts` | 150+ keyword→category mappings + field synonym config |
| `deduplicator.ts` | Duplicate transaction detection on upload |
| `parser.ts` | Low-level CSV/Excel parsing helpers |
| `exportService.ts` | CSV/Excel export of transaction data |
| `auth.ts` | Supabase auth helpers (sign in, sign up, sign out) |
| `supabase.ts` | Supabase client initialisation |
| `razorpay.ts` | Razorpay Subscriptions API client — loads checkout.js, opens modal, calls edge functions |
| `paymentProvider.ts` | Thin facade — `upgrade()`, `cancelSubscription()`, `fetchSubscriptionDetails()`. UI imports this, not razorpay.ts directly |
| `stripe.ts` | **DEPRECATED** stub. Kept only as a re-enablement reference for future USD billing |
| `analytics.ts` | Usage analytics helpers |
| `featureFlags.ts` | Runtime feature flag evaluation |
| `formatLibrary.ts` | Bank statement format library for known institutions |
| `adminAudit.ts` | Admin audit log helpers |
| `logger.ts` | Event logging to Supabase `app_logs` table |

### Recently Added/Modified Features
| Feature | Files Involved |
|---------|---------------|
| Smart learning on edit | `DataView.tsx`, `learningRules.ts`, `transformer.ts` |
| Excel asset import | `AssetCSVImport.tsx`, `assetStorage.ts`, `gemini.ts` |
| SubCategory column | `DataView.tsx`, `types/index.ts` |
| original_description | `transformer.ts`, `DataView.tsx` |
| Currency-aware tool placeholders | `FireCalculatorTool.tsx`, `SavingsRateTool.tsx` |
| Referral claim on signup | `AuthContext.tsx`, `referral.ts`, `LandingPage.tsx` |

---

## Supabase Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `user_profiles` | User identity, plan, preferences | Users own their row |
| `transactions` | All financial transactions | Users own their rows |
| `category_rules` | Learning rules (keyword→category) | Users own + read system rules |
| `app_logs` | Event logging for analytics | Insert-only for users |
| `asset_snapshots` | Net worth historical data | Users own their rows |
| `feedback` | Customer feedback | Anyone can insert, users read own |

Full schema in `SETUP.md` and `supabase/schema.sql`.

---

## Routing

Defined in `config/routes.ts`, rendered in `App.tsx`:

| Route | Auth Required | Component |
|-------|--------------|-----------|
| `/` | No (redirects to /dashboard if logged in) | LandingPage |
| `/dashboard` | No (upload-first) | DashboardPage → DashboardShell |
| `/pricing` | No | PricingPage |
| `/features` | No | FeaturesPage |
| `/help` | No | HelpPage |
| `/privacy` | No | PrivacyPage |
| `/terms` | No | TermsPage |
| `/feedback` | No | FeedbackPage |
| `/tools/fire-calculator` | No | FireCalculatorTool |
| `/tools/savings-rate` | No | SavingsRateTool |
| `/assets` | **Yes** | NetAssetPage |
| `/settings` | **Yes** | SettingsPage |
| `/family` | **Yes** | FamilyDashboard |
| `/ctrl-room-7x9k` | **Yes (admin)** | AdminPage |
| `/auth/callback` | No | AuthCallback |

---

## Common Tasks (How-To)

### Add a new dashboard tab
1. Add name to `DASHBOARD_TABS` in `types/index.ts`
2. Create `src/components/dashboard/views/NewView.tsx`
3. Import + add `case` in `DashboardShell.tsx → renderView()`
4. Update HelpPage.tsx dashboard section (view count + card)

### Add a new page route
1. Create `src/pages/NewPage.tsx` (default export)
2. Add route string to `config/routes.ts`
3. Add lazy import + `<Route>` in `App.tsx`
4. Add nav link in `Navbar.tsx` if needed
5. Add to `public/sitemap.xml` if public

### Add a new service
1. Create `src/services/newService.ts`
2. No React imports — pure business logic only
3. Export named functions, not a class
4. Use `console.warn('[ServiceName] error:', e)` in catch blocks

### Modify subscription plan features
1. Edit `config/plans.ts → PLAN_FEATURES`
2. Use `canAccessFeature(plan, 'feature')` in components
3. Update `PricingPage.tsx` feature lists
4. Update `HelpPage.tsx` if documented there

---

## Known Issues & Technical Debt

1. **Test coverage is thin** — Vitest is wired up (`vitest.config.ts`, `npx vitest run`). Existing tests: `deduplicator.test.ts`, `storage.test.ts`, `categorizer.test.ts` (placeholder only), `learningRules.test.ts`, `analysis.test.ts`, `config/__tests__/plans.test.ts`. Happy path + a few edge cases are covered; snapshot/integration coverage is absent.
2. **`VITE_GEMINI_API_KEY` dev fallback has no client-side rate limiting.** In production, all AI calls route through the Supabase Edge Function (`/functions/v1/ai-proxy`) which holds the server-side key — the client-side `VITE_GEMINI_API_KEY` is only used when no Supabase URL is configured (local dev fallback). For production safety: restrict the dev key to localhost in the Google Cloud Console, and ensure the edge function enforces per-user rate limits. The production path is already secure.
3. **API access is "coming soon"** — Enterprise plan lists API access but no backend exists. The `APIAccessPanel` shows a Coming Soon card.
4. **No CI/CD pipeline** — deploys manually via Vercel. No automated linting, type-checking, or testing.
5. **Family Dashboard** is minimal — basic multi-member view, needs more household features.
6. **Achievements system** is scaffolded but not fully wired into UI.

### ✅ Resolved (May 2026)
- **GoalsView cloud sync** — Now uses the `userSettings` service (`src/services/userSettings.ts`). Free users get localStorage; Pro/Enterprise users get automatic Supabase cloud sync via the `user_settings` table. Goals persist across page refreshes for all users.
- **BudgetsView persistence** — Same fix as GoalsView. Budgets are saved via `setUserSetting(STORAGE_KEYS.BUDGETS, budgets)` on every change, with a hydration guard to prevent saving before initial load. No longer lost on refresh.

---

## Environment Setup (Quick Reference)

```bash
npm install
cp .env.example .env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# Optional: VITE_GEMINI_API_KEY, VITE_RAZORPAY_KEY_ID, VITE_ADMIN_EMAILS
npm run dev
```

### Environment Variables — What Each One Does

| Var | Required? | Purpose | Exposed to client? |
|-----|-----------|---------|--------------------|
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL. Reads/writes to transactions, profiles, rules, etc. | Yes |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon key. Safe to ship — RLS policies protect data. | Yes |
| `VITE_GEMINI_API_KEY` | No | Enables AI features (file auto-mapping, advisor, proactive insights). **Ships to client** — see known issue #2. | Yes |
| `VITE_RAZORPAY_KEY_ID` | No | Razorpay publishable key (`rzp_test_...` / `rzp_live_...`) — enables checkout. Server secrets (key secret, webhook secret, plan IDs) live in Supabase Edge Function secrets, see RAZORPAY_SETUP.md. | Yes |
| `VITE_ADMIN_EMAILS` | No | Comma-separated emails allowed into `/ctrl-room-7x9k`. **Client-side gate only** — also enforced server-side via RLS on admin-touched tables. | Yes |

> Anything prefixed `VITE_` is embedded in the client bundle at build time. Never put secrets here — use a Supabase Edge Function instead.

See `SETUP.md` for full Supabase schema SQL, auth config, and deployment instructions.

---

## Debugging Common Issues

### "No transactions appear after upload"
1. Open DevTools → Console. Filter for `[processFiles]` or `[transformer]`.
2. If you see `Could not extract transactions. Check if file has Date and Amount columns.`, the mapping cascade failed. Most common fix: ensure the file has a recognizable date/amount header (see `CONFIG.field_synonyms` in `categorizer.ts`).
3. If categorization looks wrong, check `ruleCache` in the console via `window.__rules` (after manual `getAllRules()` call) — a pending rule may be shadowing a built-in mapping.

### "Dashboard shows empty state after refresh for a signed-in user"
- Verify `isAuthReady` is firing. `DataContext.load()` is gated on it — if auth never settles, data never loads. Check the Network tab for a failing `/auth/v1/token` call (expired refresh token).
- Check `supabase` RLS policies. If `transactions` policy is misconfigured, queries return empty rows silently.

### "AI features silently do nothing"
- `VITE_GEMINI_API_KEY` missing or quota exhausted. `isAIAvailable()` returns false without logging — the UI hides those tabs, so the feature just "disappears".
- Check DevTools → Network for `generativelanguage.googleapis.com` 4xx responses.

### "Transactions saved but disappear on next login"
- Mimic Mode may be active. Check URL for `?mimic_user_id=` — writes are blocked under this flag (by design, to protect admin-viewed accounts).
- Or the user is still in anonymous preview (`isAnonymousPreview: true`). Promotion happens on sign-in via `syncLocalToCloud()` — check for a failure there in console.

### "Tests pass locally but not in CI"
- There is no CI yet (known issue #5). Until then, run `npx vitest run` manually before pushing.

---

## File Count: 143 source files | Last updated: May 2026
