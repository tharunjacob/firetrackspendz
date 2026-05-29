# TrackSpendZ v2 — Architecture Guide for AI Maintainers

> **READ THIS FIRST** before making any code changes.
> This file is the single source of truth for how the codebase works.

## Golden Rules

1. **Never hardcode strings.** Routes, table names, localStorage keys, and plan names all live in `src/config/`. Import from there.
2. **Never edit AppContext.tsx directly.** It's a compatibility wrapper. Edit `AuthContext`, `DataContext`, or `UIContext` instead.
3. **Never leave catch blocks empty.** At minimum, `console.warn('[FileName] what failed:', e)`.
4. **Check imports before editing.** If a file is imported by 10+ other files, your change affects the entire app. Be careful.
5. **One concern per file.** If a file does two unrelated things, split it.

---

## Directory Map

```
src/
├── config/              ← CENTRALIZED CONSTANTS (edit here, never hardcode)
│   ├── index.ts         ← Re-exports everything
│   ├── routes.ts        ← All URL paths (/dashboard, /help, etc.)
│   ├── database.ts      ← Supabase table names and RPC function names
│   ├── storage.ts       ← localStorage keys and free tier limits
│   └── plans.ts         ← Subscription plan names, features, pricing
│
├── contexts/            ← STATE MANAGEMENT (3 focused contexts + 1 wrapper)
│   ├── AuthContext.tsx   ← User identity: userId, email, profile, plan, login/logout
│   ├── DataContext.tsx   ← Transaction data: load, process, save, delete
│   ├── UIContext.tsx     ← Display state: currency, activeTab, toasts
│   ├── AppContext.tsx    ← COMPATIBILITY WRAPPER — combines all 3 into useApp()
│   └── AppProvider.tsx   ← Provider tree — mounted in main.tsx
│
├── types/               ← TYPE DEFINITIONS
│   ├── index.ts         ← Core types: Transaction, UserProfile, DashboardTab, etc.
│   └── assets.ts        ← Net asset types: AssetSnapshot, NetAssetConfig, etc.
│
├── services/            ← BUSINESS LOGIC (no UI, no React) — 20 files
│   ├── auth.ts          ← Supabase auth: login, logout, getProfile
│   ├── transformer.ts   ← File parsing: Excel/CSV/PDF → Transaction[]
│   ├── storage.ts       ← Transaction storage orchestration (local + cloud)
│   ├── cloudStorage.ts  ← Supabase CRUD for transactions
│   ├── localStorage.ts  ← Browser localStorage for transactions
│   ├── assetStorage.ts  ← IndexedDB + Supabase for net assets + Excel parsing
│   ├── learningRules.ts ← Category rules: load, save, apply, createRuleFromEdit
│   ├── notifications.ts ← Smart notification generation
│   ├── analysis.ts      ← FIRE metrics, anomaly detection, deep insights
│   ├── gemini.ts        ← AI advisor, file mapping, asset file detection
│   ├── logger.ts        ← Event logging to Supabase app_logs table
│   ├── stripe.ts        ← Payment processing via Stripe
│   ├── supabase.ts      ← Supabase client initialization
│   ├── exportService.ts ← CSV/JSON export helpers
│   ├── monteCarlo.ts    ← Monte Carlo simulations for FIRE
│   ├── referral.ts      ← Referral program (create/claim codes)
│   ├── achievements.ts  ← User achievement/gamification tracking
│   ├── analytics.ts     ← App analytics tracking
│   ├── adminAudit.ts    ← Admin audit logging
│   └── featureFlags.ts  ← Feature flag management
│
├── components/          ← UI COMPONENTS
│   ├── common/          ← Shared: Icons, Toast, ErrorBoundary
│   ├── layout/          ← Navbar
│   ├── upload/          ← FileUploader
│   ├── auth/            ← AuthModal
│   ├── dashboard/       ← DashboardShell, NotificationCenter, PaywallBanner, OnboardingGuide
│   │   └── views/       ← 14 dashboard tab views (Summary, FIRE, Monthly, etc.)
│   ├── assets/          ← AssetDashboard, AssetEntryForm, AssetCSVImport, etc.
│   └── enterprise/      ← APIAccessPanel
│
├── pages/               ← ROUTE-LEVEL PAGES (one per URL)
│   ├── LandingPage.tsx
│   ├── DashboardPage.tsx
│   ├── AdminPage.tsx
│   ├── HelpPage.tsx
│   ├── FamilyDashboard.tsx
│   ├── SettingsPage.tsx
│   ├── PricingPage.tsx
│   ├── FeaturesPage.tsx
│   ├── NetAssetPage.tsx
│   ├── PrivacyPage.tsx
│   ├── TermsPage.tsx
│   └── AuthCallback.tsx
│
├── utils/               ← PURE UTILITIES (no side effects)
│   ├── constants.ts     ← Currency configs, formatting helpers, default categories
│   └── errors.ts        ← Structured error classes (AppError, FileProcessingError, etc.)
│
├── App.tsx              ← Route definitions (imports from config/routes.ts)
└── main.tsx             ← Entry point — mounts AppProvider
```

---

## Context Architecture

The app state is split into 3 independent contexts to minimize coupling:

```
┌────────────────────────────────────────────┐
│                 AppProvider                  │
│  ┌──────────────────────────────────────┐  │
│  │           UIProvider                  │  │
│  │  currency, activeTab, toast           │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │        AuthProvider             │  │  │
│  │  │  userId, profile, plan, logout  │  │  │
│  │  │  ┌──────────────────────────┐  │  │  │
│  │  │  │      DataProvider        │  │  │  │
│  │  │  │  transactions, process,  │  │  │  │
│  │  │  │  update, delete          │  │  │  │
│  │  │  └──────────────────────────┘  │  │  │
│  │  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**For existing code:** `useApp()` still works — it combines all 3 contexts.
**For new code:** Prefer the specific hook (`useAuth()`, `useData()`, `useUI()`).

---

## Data Flow

```
User uploads file
      │
      ▼
FileUploader.tsx ──→ DataContext.processFiles(jobs)
      │                     │
      ▼                     ▼
  transformer.ts      deduplicateTransactions()
  (parse file)              │
      │                     ▼
      │             identifyInterAccountTransfers()
      ▼                     │
  Transaction[]             ▼
                      If signed in: saveToStorage() → Supabase
                      If anonymous: store in memory, show 500 most recent
                            │
                            ▼
                    DashboardShell renders active tab view
```

### Full upload → dashboard pipeline (text diagram)

```
FileUploader ─[FileJob[]]→ DataContext.processFiles
                                │
                                ├─→ for each job:
                                │     transformer.transformData(file, owner, password)
                                │           │
                                │           ├── if PDF:
                                │           │     pdf.js decrypt (if password)
                                │           │     → gemini.extractTransactionsFromPDF
                                │           │
                                │           └── if Excel/CSV:
                                │                 XLSX.read → header detection
                                │                 → mapping cascade:
                                │                     1. learningRules.getStoredMapping
                                │                     2. gemini.getFileMappingFromAI
                                │                     3. heuristic rule-based
                                │                     4. gemini.detectFileStructure
                                │                 → applyMapping (categorize each row via
                                │                   learningRules.applyRules →
                                │                   categorizer.CONFIG →
                                │                   smart_patterns)
                                │
                                ├─→ deduplicator.deduplicateTransactions (fuzzy match)
                                ├─→ deduplicator.identifyInterAccountTransfers
                                │
                                └─→ setState + saveToStorage
                                          │
                                          ├─ signed in → cloudStorage.cloudSave (Supabase)
                                          └─ anonymous → localStorage.localSave (IndexedDB)
```

### Storage routing (the `isAuthReady` pattern)

```
App mount
   │
   ▼
AuthProvider sets isAuthReady = false
   │
   ▼
await getCurrentUser() / onAuthStateChange fires
   │
   ▼
AuthProvider sets isAuthReady = true
   │
   ▼
DataProvider's useEffect wakes up (gated on isAuthReady)
   │
   ▼
storage.loadFromStorage()
   │
   ├─ mimic_user_id query param?  → cloudLoad(mimicId)
   ├─ _isLoggedIn cache = true?    → cloudLoad()
   └─ otherwise                    → localLoad()
```

**Why the gate matters:** without `isAuthReady`, `DataProvider` would call `loadFromStorage()` before Supabase's session hydrated. `storage.ts` has its own `_isLoggedIn` cache (populated by `initAuthCache()`), but it's racey on first paint — a signed-in user could briefly route to local storage and see "no data" for a frame. The gate is the single source of truth.

### Learning rules end-to-end

```
User edits a transaction's Category in DataView
   │
   ▼
DataView calls updateTransactions(updated)
   │
   ├─ context saves the edit (cloud or local)
   └─ DataView also calls learningRules.createRuleFromEdit(tx, 'category', newValue)
          │
          ▼
      saveRule(original_description, newValue, 'category', 'active')
          │
          ├─ push to in-memory ruleCache immediately
          └─ upsert into Supabase category_rules
   │
   ▼
Next file upload → transformer.applyMapping
   │
   ▼
learningRules.applyRules(description, 'category')
   │
   ▼
case-insensitive substring match; longest keyword wins
   │
   ▼
If matched → use learned category instead of heuristic
```

---

## Key Design Decisions

### 1. Upload-First Experience
Users can upload files and see results WITHOUT signing up. This is controlled by:
- `AppContext.isAnonymousPreview` — true when user uploaded without auth
- `AppContext.allTransactionsCount` — total count (visible + hidden)
- `PaywallBanner` component — shown when anonymous with >500 txns
- When user signs up, `allTransactionsRaw` is promoted to their cloud storage

### 2. Secret Admin Panel
- URL: `/ctrl-room-7x9k` (defined in `config/routes.ts`)
- Non-admin users see a fake 404 page (not "Access Denied")
- Admin emails set via `VITE_ADMIN_EMAILS` env var
- Never expose the admin URL in robots.txt description or UI

### 3. Dual Storage (Local + Cloud)
- Free users: localStorage only (via `localStorage.ts`)
- Pro/Enterprise users: Supabase cloud (via `cloudStorage.ts`)
- `storage.ts` orchestrates: decides which backend based on auth state
- **Risk:** If cloud save fails, local has data but cloud doesn't. Always check `.error` on Supabase responses.

### 4. Learning Rules (Smart Categorization)
- 150+ built-in merchant→category mappings in `transformer.ts`
- User edits create new rules automatically via `createRuleFromEdit()` in `learningRules.ts`
- Rules are cached in memory (`ruleCache`) for fast lookup, stored in Supabase `category_rules` table
- Supports `category`, `type`, `project`, `merchant`, and `subCategory` as target fields
- `applyRules(text, field)` does case-insensitive substring matching — longest keyword wins
- `original_description` (set at import time in transformer.ts) provides stable keywords for matching
- Admin can promote user rules to system-wide via the Rules tab in admin panel

### 5. Net Asset Tracker (Excel + AI)
- Separate from dashboard — lives at `/net-assets` (auth-required)
- Supports CSV template format AND arbitrary Excel files (.xlsx/.xls)
- AI-powered column detection via `detectAssetFileStructure()` in gemini.ts
- Multi-sheet Excel workbooks show a sheet selector UI
- `parseExcelToSheets()` + `applyAssetMapping()` in assetStorage.ts handle parsing
- Historical snapshots tracked by date → timeline view of wealth growth

### 6. Referral Program
- Landing page stores `?ref=CODE` in localStorage as `tsz_referral_code`
- On signup, `AuthContext.tsx` calls `claimReferral(code, userId)` automatically
- Fire-and-forget — silent failure, removes code from localStorage on success

---

## Danger Zones (High-Impact Files)

These files are imported by many others. Edit with extreme care:

| File | Fan-In | Risk | What breaks if wrong |
|------|--------|------|---------------------|
| `types/index.ts` | 24 | CRITICAL | Every component's type checking |
| `contexts/AppContext.tsx` | 24 | CRITICAL | Every component's state access |
| `components/common/Icons.tsx` | 23 | HIGH | Every icon in every view |
| `utils/constants.ts` | 22 | HIGH | All currency formatting, categories |
| `services/transformer.ts` | 5 | CRITICAL | All file parsing — wrong = wrong data |
| `services/analysis.ts` | 7 | HIGH | FIRE calculator, insights, anomalies |

---

## How to Safely Make Common Changes

### Adding a new page
1. Create `src/pages/NewPage.tsx` with a default export
2. Add route to `src/config/routes.ts`
3. Add lazy import + `<Route>` in `src/App.tsx`
4. Add nav link in `src/components/layout/Navbar.tsx`
5. Update `public/sitemap.xml` if public

### Adding a new dashboard tab
1. Add tab name to `DASHBOARD_TABS` in `src/types/index.ts`
2. Create view component in `src/components/dashboard/views/`
3. Add `case` in `DashboardShell.tsx → renderView()`
4. Add icon mapping in `DashboardShell.tsx → tabIcons`
5. Update HelpPage.tsx dashboard section (bump view count + add card)

### Adding a new localStorage key
1. Add key to `src/config/storage.ts → STORAGE_KEYS`
2. Import from there — never hardcode the key string

### Adding a new Supabase table
1. Add table name to `src/config/database.ts → TABLES`
2. Import from there — never hardcode the table name string
3. Update `SETUP.md` with the CREATE TABLE SQL

### Changing subscription plan features
1. Edit `src/config/plans.ts → PLAN_FEATURES`
2. Use `canAccessFeature(plan, 'feature_name')` in components
3. Update `PricingPage.tsx` feature lists if user-facing

---

## Error Handling Standards

```typescript
// ❌ WRONG — swallows errors silently
try { doThing(); } catch {}

// ❌ WRONG — any type loses safety
catch (e: any) { showToast(e.message, 'error'); }

// ✅ CORRECT — logs context, uses type guard
catch (e: unknown) {
  const msg = e instanceof Error ? e.message : 'Unknown error';
  console.error('[FileName] operation failed:', e);
  showToast(msg, 'error');
}

// ✅ BEST — uses structured errors
import { getUserMessage } from '@/utils/errors';
catch (e: unknown) {
  console.error('[FileName] operation failed:', e);
  showToast(getUserMessage(e), 'error');
}
```

---

## File Count: 143 source files | Last updated: May 2026

Last updated: March 2026
