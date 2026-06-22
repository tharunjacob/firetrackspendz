import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import { EVENTS } from '@/services/logger';

// ============================================================
// A/B Tests Tab — landing-page hero experiment results
//
// Reads the raw `landing_hero_view` / `landing_hero_cta` events from
// app_logs (admins can SELECT all rows via RLS) and aggregates them in
// the browser. No dedicated experiment table — keeps the feature
// schema-free and easy to extend with new experiments later.
//
//   Impression = a distinct session that saw a variant
//   Click      = a distinct session that clicked any hero CTA
//   CTR        = clicks / impressions
// ============================================================

interface HeroLogRow {
  event: string;
  session_id: string | null;
  metadata: { variant?: string; cta?: string } | null;
  created_at: string;
}

interface VariantStats {
  variant: string;
  impressions: number;      // distinct sessions that viewed
  clickSessions: number;    // distinct sessions that clicked any CTA
  uploadClicks: number;     // raw click events on the "upload" CTA
  demoClicks: number;       // raw click events on the "demo" CTA
}

const RANGE_DAYS = 30;

export const ABTestsTab = () => {
  const [rows, setRows] = useState<HeroLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - RANGE_DAYS * 86400000).toISOString();
    getSupabase()
      .from(TABLES.APP_LOGS)
      .select('event, session_id, metadata, created_at')
      .in('event', [EVENTS.LANDING_HERO_VIEW, EVENTS.LANDING_HERO_CTA])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000)
      .then(({ data, error: err }) => {
        if (err) {
          setError('Could not load A/B data. Connect Supabase to see hero experiment results here.');
        } else {
          setRows((data as HeroLogRow[]) || []);
        }
        setLoading(false);
      });
  }, []);

  const stats = useMemo<VariantStats[]>(() => {
    const map = new Map<string, {
      viewSessions: Set<string>;
      clickSessions: Set<string>;
      uploadClicks: number;
      demoClicks: number;
    }>();

    const bucket = (variant: string) => {
      if (!map.has(variant)) {
        map.set(variant, {
          viewSessions: new Set(),
          clickSessions: new Set(),
          uploadClicks: 0,
          demoClicks: 0,
        });
      }
      return map.get(variant)!;
    };

    for (const r of rows) {
      const variant = r.metadata?.variant;
      if (!variant) continue;
      const b = bucket(variant);
      const sid = r.session_id || `anon-${r.created_at}`;

      if (r.event === EVENTS.LANDING_HERO_VIEW) {
        b.viewSessions.add(sid);
      } else if (r.event === EVENTS.LANDING_HERO_CTA) {
        b.clickSessions.add(sid);
        if (r.metadata?.cta === 'upload') b.uploadClicks++;
        else if (r.metadata?.cta === 'demo') b.demoClicks++;
      }
    }

    return [...map.entries()]
      .map(([variant, b]) => ({
        variant,
        impressions: b.viewSessions.size,
        clickSessions: b.clickSessions.size,
        uploadClicks: b.uploadClicks,
        demoClicks: b.demoClicks,
      }))
      .sort((a, b) => a.variant.localeCompare(b.variant));
  }, [rows]);

  const totals = useMemo(() => {
    const impressions = stats.reduce((s, v) => s + v.impressions, 0);
    const clicks = stats.reduce((s, v) => s + v.clickSessions, 0);
    return { impressions, clicks };
  }, [stats]);

  // Highlight the leading variant by CTR (needs a minimum sample to be meaningful).
  const leader = useMemo(() => {
    const eligible = stats.filter(v => v.impressions >= 20);
    if (eligible.length < 2) return null;
    return eligible.reduce((best, v) =>
      (v.clickSessions / v.impressions) > (best.clickSessions / best.impressions) ? v : best
    );
  }, [stats]);

  const ctr = (v: VariantStats) => v.impressions > 0 ? (v.clickSessions / v.impressions) * 100 : 0;

  const VARIANT_LABEL: Record<string, string> = {
    A: 'A — “Where did your money actually go?”',
    B: 'B — “See where your money goes…”',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Loading A/B results...</div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="card p-8 text-center border-2 border-dashed border-slate-200">
        <div className="text-4xl mb-3">🧪</div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Landing Hero A/B Test</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Landing Hero A/B Test</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Headline variants on the landing page, last {RANGE_DAYS} days. CTR = distinct sessions that clicked a hero CTA ÷ sessions that saw the hero.
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {totals.impressions.toLocaleString()} impressions · {totals.clicks.toLocaleString()} clicks
        </span>
      </div>

      {stats.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hero events yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Once visitors land on the homepage, impressions and CTA clicks per variant appear here.
          </p>
        </div>
      ) : (
        <>
          {leader && (
            <div className="card p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-300">
                <span className="font-bold">Variant {leader.variant} is leading</span> at {ctr(leader).toFixed(1)}% CTR.
                Keep running until each variant has a few hundred impressions before calling it.
              </p>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Variant</th>
                    <th className="px-4 py-3 text-right">Impressions</th>
                    <th className="px-4 py-3 text-right">Clicked</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">Upload CTA</th>
                    <th className="px-4 py-3 text-right">Demo CTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {stats.map(v => {
                    const isLeader = leader?.variant === v.variant;
                    return (
                      <tr key={v.variant} className={isLeader ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {VARIANT_LABEL[v.variant] || `Variant ${v.variant}`}
                          </span>
                          {isLeader && <span className="ml-2 text-[10px] font-bold text-green-600">▲ leading</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{v.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{v.clickSessions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">{ctr(v).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-slate-500">{v.uploadClicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{v.demoClicks.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Note: results are statistically meaningful only at scale. With fewer than a few hundred impressions per
            variant, treat this as directional and lean on user interviews. Each visitor is locked to one variant on first visit.
          </p>
        </>
      )}
    </div>
  );
};

export default ABTestsTab;
