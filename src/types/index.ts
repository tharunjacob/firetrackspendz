// ============================================================
// TrackSpendZ v2 - Core Type Definitions
// ============================================================

export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface Transaction {
  id: string;
  user_id?: string;
  file_id?: string;

  owner: string;           // Entity / Account name
  type: TransactionType;
  date: string;            // YYYY-MM-DD
  time: string | null;
  amount: number;

  category: string;
  subCategory: string;
  project: string | null;
  merchant_name?: string;

  notes: string;           // User-edited description
  original_description?: string; // Raw bank text

  is_recurring?: boolean;
  is_excluded_from_fire?: boolean;
}

export interface FilterState {
  owners: string[];
  types: TransactionType[];
  excludedCategories: string[];
  excludedProjects: string[];
  dateRange?: { start: string; end: string };
}

export interface FileJob {
  file: File;
  owner: string;
  password?: string;
}

export interface FileMapping {
  dateColumn: string;
  dateFormat?: string;
  amountColumn?: string;
  categoryColumn?: string;
  subcategoryColumn?: string;
  descriptionColumn?: string;
  typeColumn?: string;
  projectColumn?: string;
  isCreditDebitSeparate: boolean;
  creditColumn?: string;
  debitColumn?: string;
  expenseTransferColumn?: string;
  incomeTransferColumn?: string;
}

export interface UserProfile {
  id: string;
  full_name?: string;
  age?: number;
  location?: string;
  gender?: string;
  dob?: string;
  retirement_year?: number;
  email?: string;
  avatar_url?: string;
  // Subscription
  subscription_plan: SubscriptionPlan;
  subscription_status?:
    | 'active'        // currently billing successfully
    | 'trialing'      // in trial window (reserved — not used today)
    | 'canceled'      // user-initiated cancel, access ended
    | 'past_due'      // payment failed, retry window
    | 'authenticated' // Razorpay: mandate authorized, awaiting first charge
    | 'pending'       // Razorpay: charge in flight
    | 'halted'        // Razorpay: too many failed retries, paused by Razorpay
    | 'completed'     // Razorpay: all billing cycles consumed
    | 'expired';      // Razorpay: auth payment window lapsed
  subscription_period?: 'monthly' | 'yearly';
  subscription_provider?: 'razorpay' | 'stripe';
  next_billing_date?: string;
  // True when a cancel-at-cycle-end has been requested: user keeps Pro until
  // next_billing_date, then the end-of-cycle webhook downgrades to free and
  // clears this. Drives the "Cancellation scheduled" banner in SubscriptionManager.
  cancel_at_period_end?: boolean;

  // Razorpay (current provider)
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;

  // Stripe (kept for future re-enablement — see RAZORPAY_SETUP.md)
  stripe_customer_id?: string;
  // Net Worth
  manual_assets?: Asset[];
  // Preferences
  preferred_currency?: Currency;
  created_at?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'savings' | 'investment' | 'property' | 'crypto' | 'vehicle' | 'other';
  value: number;
  currency: Currency;
  last_updated: string;
}

export interface LearningRule {
  id?: number;
  keyword: string;
  target_field: 'category' | 'type' | 'project' | 'merchant' | 'subCategory';
  value: string;
  source: 'user' | 'admin' | 'system';
  scope?: 'user' | 'admin' | 'system';
  status: 'active' | 'pending';
  user_id?: string;
  created_at?: string;
}

export interface UserFile {
  id: string;
  user_id: string;
  file_name: string;
  file_size_kb: number;
  row_count: number;
  entity_name: string;
  upload_date: string;
  status?: 'active' | 'archived';
  file_type?: string;
}

export interface AppLog {
  id: string;
  event: string;
  metadata: Record<string, unknown>;
  level: 'info' | 'error' | 'warn';
  user_id?: string;
  email?: string;
  session_id?: string;
  created_at: string;
  path?: string;
}

export interface AdminSessionStat {
  sessionId: string;
  userId: string;
  userEmail: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  filesUploaded: number;
  totalRows: number;
  locationHint: string;
  platform: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  subject: string;
  status: 'open' | 'closed' | 'resolved';
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_admin: boolean;
}

// Debt Payoff types
export interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type: 'credit_card' | 'personal_loan' | 'car_loan' | 'home_loan' | 'student_loan' | 'other';
  createdAt: string;
}

export type DebtPayoffMethod = 'snowball' | 'avalanche';

export interface DebtPayoffResult {
  method: DebtPayoffMethod;
  totalMonths: number;
  totalInterestPaid: number;
  debtFreeDate: string;
  // True when the simulation hit the month cap with balances still outstanding
  // (the monthly budget doesn't even cover the interest). When true, debtFreeDate
  // is '' and the UI must NOT present a payoff date.
  neverPaysOff: boolean;
  schedule: DebtPayoffMonth[];
}

export interface DebtPayoffMonth {
  month: number;
  monthLabel: string;
  remainingDebts: Array<{ id: string; name: string; balance: number; payment: number }>;
  totalPaid: number;
  interestPaid: number;
}

// Goals types
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  monthlyContribution: number;
  createdAt: string;
}

// Budget types
export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  currency: Currency;
  is_active: boolean;
}

// Family types
export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  status: 'owner' | 'active' | 'pending' | 'removed';
  addedAt: string;
  color: string;
}

// Currency
export type Currency = 'USD' | 'EUR' | 'INR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED';

export interface CurrencyConfig {
  symbol: string;
  locale: string;
  name: string;
}

// Analysis types
export interface FireMetrics {
  currentAnnualExpense: number;
  avgMonthlyExpense: number;
  personalInflation: number;
  yearsToFreedom: Record<number, number>;
  fireNumberCurrent: number;
  annualIncomeGrowth?: number;
  savingsRate?: number;
  monthsOfRunway?: number;
}

export interface RecurringTransaction {
  name: string;
  avgAmount: number;
  frequency: number;
  confidence: number;
  lastDate: string;
}

export interface Anomaly {
  transaction: Transaction;
  reason: string;
  deviation: number;
}

export interface DeepInsight {
  title: string;
  value: string;
  description: string;
  trend: 'neutral' | 'good' | 'bad';
  icon?: string;
}

export interface ProactiveInsight {
  id: string;
  type: 'warning' | 'tip' | 'achievement' | 'anomaly';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  category?: string;
  dismissed?: boolean;
}

// ============================================================
// Admin Types (Phase 2)
// ============================================================

export interface AdminAuditEntry {
  id: number;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserHealthScore {
  userId: string;
  score: number; // 0-100
  loginFrequency: number;  // 0-40 pts
  featureDepth: number;    // 0-30 pts
  dataFreshness: number;   // 0-30 pts
  churnRisk: 'low' | 'medium' | 'high';
}

// ============================================================
// Analytics Types (Phase 3)
// ============================================================

export interface FunnelStep {
  step: string;
  step_order: number;
  users: number;
  pct_of_top: number;
  pct_of_prev: number;
}

export interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  week_num: number;
  retained: number;
  retention_pct: number;
}

export interface FeatureAdoptionRow {
  feature: string;
  unique_users: number;
  total_uses: number;
  adoption_pct: number;
}

export interface RevenueMetrics {
  total_users: number;
  pro_users: number;
  enterprise_users: number;
  paying_users: number;
  arr: number;
  mrr: number;
  arpu: number;
  conversion_rate: number;
  ltv_estimate: number;
}

export interface SessionAnalytics {
  total_sessions: number;
  total_users: number;
  avg_duration_seconds: number;
  avg_pages_per_session: number;
}

export interface DAUPoint {
  date_day: string;
  dau: number;
}

export interface ErrorTimelinePoint {
  date_day: string;
  errors: number;
  warnings: number;
  total: number;
}

// ============================================================
// Referral & Achievement Types
// ============================================================

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: 'streak' | 'milestone' | 'wrapped' | 'referral';
  achievement_key: string;
  value: Record<string, unknown>;
  earned_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
  completed_at: string | null;
}

export interface ReferralStats {
  code: string;
  totalInvites: number;
  completed: number;
  pending: number;
  rewardsEarned: number;
}

// ============================================================
// FIRE Scenario Types
// ============================================================

export type FireVariant = 'lean' | 'regular' | 'fat' | 'coast' | 'barista';

export interface FireScenario {
  variant: FireVariant;
  label: string;
  fireNumber: number;
  monthlyExpense: number;
  yearsToFire: number;
  description: string;
}

export interface MonteCarloInput {
  currentSavings: number;
  monthlyContribution: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  withdrawalRate: number;
  expectedReturn: number;
  returnStdDev: number;
  inflationRate: number;
}

export interface MonteCarloResult {
  successRate: number;
  percentiles: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  medianEndingBalance: number;
  failureYear: number | null;
}

// ============================================================
// Financial Wrapped Types
// ============================================================

export interface WrappedStats {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  topCategory: { name: string; amount: number; pct: number };
  biggestExpense: { notes: string; amount: number; date: string };
  bestMonth: { month: string; savings: number };
  worstMonth: { month: string; savings: number };
  recurringTotal: number;
  fireProgress: { start: number; end: number; changePercent: number };
  totalTransactions: number;
  uniqueMerchants: number;
  monthlySavingsRates: { month: string; rate: number }[];
}

export type AdminTab =
  | 'overview'
  | 'users'
  | 'user-detail'
  | 'rules'
  | 'logs'
  | 'health'
  | 'mimic'
  | 'feedback'
  | 'analytics'
  | 'flags'
  | 'audit'
  | 'formats'
  | 'abandoned'
  | 'ab-tests';

// Tab definitions
export const DASHBOARD_TABS = [
  'Summary',
  'Yearly Analysis',
  'Monthly Analysis',
  'Categories',
  'Trends',
  'Compare',
  'Data',
  'Budgets',
  'Goals',
  'Recurring',
  'FIRE Calculator',
  'Net Worth',
  'Debt Payoff',
  'AI Advisor',
  'Year Review',
] as const;

export type DashboardTab = typeof DASHBOARD_TABS[number];

export const TAB_GROUPS = [
  { label: 'Analyze', tabs: ['Summary', 'Yearly Analysis', 'Monthly Analysis', 'Categories', 'Trends', 'Compare'] },
  { label: 'Take control', tabs: ['Data', 'Budgets', 'Goals', 'Recurring'] },
  { label: 'Plan ahead', tabs: ['FIRE Calculator', 'Net Worth', 'Debt Payoff', 'AI Advisor', 'Year Review'] },
] as const;

export const TAB_DISPLAY_NAMES: Partial<Record<DashboardTab, string>> = {
  'Data': 'Data (Add / Edit)',
};
