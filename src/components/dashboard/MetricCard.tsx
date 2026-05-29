import type { ReactNode } from 'react';

// ============================================================
// MetricCard — the single intentional metric/insight card.
// Replaces the old `border-l-4` colored-left-rail pattern.
// Hierarchy: eyebrow label · large value · small semantic pill.
// Calm, information-dense, and reusable across the dashboard.
// ============================================================

export type Tone = 'positive' | 'negative' | 'warning' | 'brand' | 'neutral';

const pillStyles: Record<Tone, string> = {
  positive: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  negative: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  warning:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  brand:    'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  neutral:  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const valueStyles: Record<Tone, string> = {
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-600 dark:text-red-400',
  warning:  'text-amber-600 dark:text-amber-400',
  brand:    'text-brand-600 dark:text-brand-400',
  neutral:  'text-slate-800 dark:text-slate-100',
};

export interface MetricPill {
  label: string;
  tone: Tone;
  /** Optional trend arrow rendered before the label. */
  arrow?: 'up' | 'down';
}

export const DeltaPill = ({ label, tone, arrow }: MetricPill) => (
  <span className={`inline-flex items-center gap-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${pillStyles[tone]}`}>
    {arrow && <span aria-hidden="true">{arrow === 'up' ? '↑' : '↓'}</span>}
    {label}
  </span>
);

interface MetricCardProps {
  /** Small uppercase eyebrow label. */
  eyebrow: string;
  /** The headline value. */
  value: string;
  /** Colour role for the value. Defaults to neutral. */
  valueTone?: Tone;
  /** Optional semantic pill (delta / ratio / status). */
  pill?: MetricPill;
  /** Optional supporting footnote under the value. */
  description?: string;
  /** Optional footer node (e.g. a "→ Full analysis" affordance). */
  footer?: ReactNode;
  /** When provided the card becomes a keyboard-accessible button. */
  onClick?: () => void;
}

export const MetricCard = ({
  eyebrow, value, valueTone = 'neutral', pill, description, footer, onClick,
}: MetricCardProps) => {
  const interactive = typeof onClick === 'function';
  const className = `metric-card text-left w-full${interactive ? ' focus-ring cursor-pointer hover:shadow-md transition-shadow' : ''}`;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-eyebrow">{eyebrow}</p>
        {pill && <DeltaPill {...pill} />}
      </div>
      <p className={`text-2xl sm:text-3xl font-bold leading-tight truncate ${valueStyles[valueTone]}`} title={value}>
        {value}
      </p>
      {description && <p className="text-footnote">{description}</p>}
      {footer}
    </>
  );

  return interactive
    ? <button type="button" onClick={onClick} className={className}>{body}</button>
    : <div className={className}>{body}</div>;
};
