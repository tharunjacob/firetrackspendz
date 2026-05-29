# TrackSpendZ — Changelog

## v2.2.0 — May 2026 (Latest) — Launch Prep

### Payments
- **Razorpay is now the active payment provider** (replaces Stripe for the launch). `paymentProvider.ts` is the facade the UI imports; `razorpay.ts` is the client; 5 `razorpay-*` Supabase edge functions handle subscriptions + webhook. `stripe.ts` remains only as a deprecated stub for a possible future USD revival.
- **API access removed from Enterprise** — it was advertised pre-launch but never built. Removed from `config/plans.ts`, PricingPage, HelpPage, and the `APIAccessPanel` component was deleted. `canAccessFeature(plan, 'api_access')` now returns `false` everywhere (asserted in `plans.test.ts`).

### Razorpay Compliance — Legal Pages
- New **Cancellation & Refund Policy** (`/refund-policy`), **Shipping & Delivery Policy** (`/shipping-policy`), and **Contact Us** (`/contact`) pages.
- Privacy & Terms updated to reference Razorpay (not Stripe) as the payment processor.
- All business details (legal name, address, phone, support email, refund window) centralized in `config/legal.ts` — every policy page reads from it. Footer + sitemap updated.

### Security
- **Server-side AI proxy** — all Gemini calls route through the `ai-proxy` Supabase edge function in production; the API key never ships in the client bundle. `VITE_GEMINI_API_KEY` is a local-dev-only fallback.
- PDF upload now requires a signed-in session (the proxy enforces auth) with a clear user-facing message instead of a silent failure.

### Bug Fixes
- **Checkout lockout** — an abandoned Razorpay checkout no longer permanently blocks a user from paying.
- **Auth race** — returning logged-in users no longer briefly see an empty dashboard or write to the wrong storage backend.
- **Duplicate transactions** — fixed for free users with 500+ rows (dedup now runs against the full dataset, not just the visible 500).

### UI Polish
- Dark-mode fixes for the OnboardingGuide card and the encrypted-PDF password prompt (previously unreadable light boxes in dark mode).
- Error toasts now persist 6s (was 3s) so failure messages aren't missed.

---

## v2.1.0 — March 2026

### New Features

**Smart Learning Rules (Data Tab)**
- When a user edits a transaction's category, the app now auto-creates a learning rule
- Future uploads with matching bank descriptions get categorized automatically
- `createRuleFromEdit()` in `learningRules.ts` handles rule creation
- Toast notification: "Learned: similar transactions will be categorized as X"
- Supports both `category` and `subCategory` learning
- `original_description` field preserved at import time for stable keyword matching

**SubCategory Column (Data Tab)**
- New "Sub-Cat" column visible in the transaction table
- SubCategory is editable in the inline edit panel
- SubCategory learning rules applied during import via `applyRules(notes, 'subCategory')`
- Shows "—" when subcategory is empty or "General"

**Excel Upload for Net Worth**
- `AssetCSVImport` now accepts `.xlsx`, `.xls`, `.csv`, `.tsv` files
- AI-powered column detection via `detectAssetFileStructure()` in Gemini service
- Multi-sheet Excel workbooks show a sheet selector UI
- `parseExcelToSheets()` + `applyAssetMapping()` in assetStorage.ts
- Backward compatible with existing CSV template format

**Referral Program Wiring**
- Landing page stores `?ref=CODE` param in localStorage
- On signup, `AuthContext.tsx` auto-claims referral via `claimReferral()`
- Fire-and-forget pattern with silent error handling

**Net Worth Bridge**
- NetWorthView (dashboard tab) now has a link card to `/net-assets`
- "Want detailed asset tracking with historical data?" with gradient card

### UI Polish & Accuracy Fixes

**Pricing Page**
- Added "just $4.08/month" and "just $12.42/month" sub-labels under annual prices
- Enterprise "API access" marked as "(coming soon)"
- FAQ: Replaced false "14-day Pro trial" claim with honest no-signup-required copy

**Help Page**
- Updated "12 interactive views" to "14 interactive views"
- Added Recurring and Year Review to dashboard tab documentation grid
- Removed false 14-day trial claim
- Replaced fake API `curl` examples with "Coming Soon" notice + email waitlist

**Features Page**
- Fixed "Gemini 2.5 Flash" to "Gemini 2.0 Flash" (matches actual model in gemini.ts)

**Landing Page**
- Removed unverified "Join thousands of people" social proof claim
- Replaced with honest actionable CTA: "Stop wondering where your money goes..."
- "Try It Free — No Sign Up Required" button

**FIRE Calculator Tool + Savings Rate Tool**
- Added currency-aware placeholder maps (INR: 75,000 / USD: 5,000 / JPY: 350,000 etc.)
- Tools now default to the app's global currency (from AppContext) instead of always USD
- Added AED (UAE Dirham) placeholders

**Dashboard**
- "Upload now →" in OnboardingGuide now scrolls to the FileUploader (was a no-op)
- SummaryView: Improved empty donut chart message to context-specific text
- RecurringView: Updated empty state to "Upload at least 2-3 months of data..."
- NetAssetPage: Fixed grammar in owner count toast ("1 owner" vs "4 owners")

**APIAccessPanel (Enterprise Settings)**
- Replaced fake API endpoint `curl` examples with Coming Soon amber card

---

## v2.0.0 — February 2026

### Core Platform
- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase backend (auth, database, storage)
- Google Gemini 2.0 Flash AI integration
- 14 dashboard tab views
- Upload-first experience (no signup required)
- Dual storage: localStorage (free) + Supabase cloud (pro)

### Dashboard Views
- Summary with donut charts and key metrics
- FIRE Calculator with scenarios and Monte Carlo simulation
- Yearly and Monthly analysis
- Category breakdown with drilldown
- Trend charts for top categories
- Period comparison (month vs month, year vs year)
- Transaction data table with inline editing
- AI Financial Advisor (Gemini-powered chat)
- Net Worth quick tracker
- Savings Goals with projections
- Recurring expense detection with confidence scoring
- Monthly budget tracker with alerts
- Year Review (Spotify Wrapped-style)

### File Processing
- Excel (.xlsx, .xls) via XLSX library
- CSV/TSV with auto-delimiter detection
- PDF via PDF.js (including password-protected)
- AI-powered column mapping for unknown formats
- 150+ built-in merchant keyword patterns

### Business Features
- 3-tier pricing (Free / Pro $49/yr / Enterprise $149/yr)
- Stripe payment integration
- Admin panel at secret URL with 12 management tabs
- Smart notifications (bills, budgets, anomalies, achievements)
- Social sharing (Spending DNA card — percentages only, privacy-safe)
- Referral program infrastructure
- Family Dashboard (Enterprise)
- PWA support with service worker

### Pages
- Landing page with features grid and 3-step flow
- Pricing with FAQ
- Features showcase
- Help center with 13 searchable sections
- Privacy policy and Terms of service
- Feedback submission
- Public FIRE Calculator and Savings Rate tools (SEO)
