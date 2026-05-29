import { useRef, useMemo, useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getCategoryBreakdown } from '@/services/analysis';
import { Icon } from '@/components/common/Icons';

// ============================================================
// Social Media Share Card â€” Exportable spending breakdown image
// ============================================================
//
// HOW IT WORKS:
// 1. Generates a visually appealing spending breakdown card
// 2. Shows ONLY percentages â€” never absolute dollar amounts (privacy)
// 3. User can export as PNG image for social media sharing
// 4. Includes TrackSpendZ branding as a subtle watermark
//
// DESIGN:
// - Dark gradient background (looks good on Instagram/Twitter)
// - Donut chart in the center with category percentages
// - Top 6 categories with color-coded bars
// - "My Spending DNA" title for shareability
// - CTA: "Track yours at trackspendz.com"
//
// DEPENDS ON: AppContext, analysis.ts (getCategoryBreakdown)
// CONSUMED BY: DashboardShell (via share button) or CategoriesView
// ============================================================

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;
const TOP_CATEGORIES = 8;

const SHARE_COLORS = [
  '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#60a5fa',
  '#a78bfa', '#fb7185', '#2dd4bf', '#f59e0b', '#38bdf8',
];

export const ShareCard = () => {
  const { transactions } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const breakdown = useMemo(() => {
    const cats = getCategoryBreakdown(transactions, 'Expense');
    return cats.slice(0, TOP_CATEGORIES);
  }, [transactions]);

  const months = useMemo(() => {
    const monthSet = new Set(transactions.filter(t => t.type === 'Expense').map(t => t.date.substring(0, 7)));
    return monthSet.size;
  }, [transactions]);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    // --- Background: dark gradient ---
    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CARD_WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < CARD_HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_WIDTH, y); ctx.stroke();
    }

    // --- Header ---
    ctx.fillStyle = 'rgba(129, 140, 248, 0.15)';
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, -200, 500, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0e7ff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MY SPENDING DNA', CARD_WIDTH / 2, 80);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`Based on ${months} month${months !== 1 ? 's' : ''} of data`, CARD_WIDTH / 2, 115);

    // --- Donut Chart ---
    const cx = CARD_WIDTH / 2;
    const cy = 310;
    const outerR = 150;
    const innerR = 90;

    let startAngle = -Math.PI / 2;
    breakdown.forEach((cat, i) => {
      const sliceAngle = (cat.percentage / 100) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = SHARE_COLORS[i % SHARE_COLORS.length];
      ctx.fill();

      // Label on the slice if big enough
      if (cat.percentage > 8) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = (outerR + innerR) / 2;
        const lx = cx + Math.cos(midAngle) * labelR;
        const ly = cy + Math.sin(midAngle) * labelR;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${cat.percentage.toFixed(0)}%`, lx, ly);
      }

      startAngle = endAngle;
    });

    // Other slice if breakdown doesn't cover 100%
    const coveredPct = breakdown.reduce((s, c) => s + c.percentage, 0);
    if (coveredPct < 99.5) {
      const otherAngle = ((100 - coveredPct) / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + otherAngle);
      ctx.arc(cx, cy, innerR, startAngle + otherAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.fill();
    }

    // Center text
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 32px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('100%', cx, cy - 10);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('of expenses', cx, cy + 18);

    // --- Category Legend (bar-style) ---
    const legendY = 510;
    const legendX = 100;
    const barMaxWidth = CARD_WIDTH - 200;
    const barHeight = 36;
    const barGap = 12;

    breakdown.forEach((cat, i) => {
      const y = legendY + i * (barHeight + barGap);
      const barWidth = Math.max(40, (cat.percentage / 100) * barMaxWidth);

      // Bar background
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.beginPath();
      ctx.roundRect(legendX, y, barMaxWidth, barHeight, 8);
      ctx.fill();

      // Filled bar
      ctx.fillStyle = SHARE_COLORS[i % SHARE_COLORS.length];
      ctx.beginPath();
      ctx.roundRect(legendX, y, barWidth, barHeight, 8);
      ctx.fill();

      // Category name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(cat.name, legendX + 12, y + barHeight / 2);

      // Percentage
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 18px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${cat.percentage.toFixed(1)}%`, legendX + barMaxWidth - 12, y + barHeight / 2);
    });

    // --- Footer ---
    // Divider
    const footerY = CARD_HEIGHT - 80;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, footerY);
    ctx.lineTo(CARD_WIDTH - 100, footerY);
    ctx.stroke();

    // Branding
    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TrackSpendZ', CARD_WIDTH / 2, footerY + 30);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('trackspendz.com â€” Know where your money goes', CARD_WIDTH / 2, footerY + 56);
  }, [breakdown, months]);

  const handleGenerate = () => {
    setGenerating(true);
    setShowPreview(true);
    // Use requestAnimationFrame so canvas is in DOM before drawing
    requestAnimationFrame(() => {
      drawCard();
      setGenerating(false);
    });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'my-spending-dna.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyToClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch (e) {
      console.warn('[ShareCard] Clipboard copy failed:', e);
    }
  };

  if (breakdown.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-sm">Need expense data to generate a share card.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!showPreview ? (
        <div className="card p-6 text-center">
          <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="share" className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Share Your Spending DNA</h3>
          <p className="text-sm text-slate-500 mb-4">
            Generate a beautiful, privacy-safe image showing your spending breakdown as percentages â€” no actual amounts shown.
          </p>
          <button onClick={handleGenerate} className="btn-primary px-6 py-2.5 text-sm">
            Generate Share Card
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Your Spending DNA</h3>
            <div className="flex gap-2">
              <button onClick={handleCopyToClipboard} className="btn-secondary text-sm px-4 py-2">
                Copy to Clipboard
              </button>
              <button onClick={handleDownload} className="btn-primary text-sm px-4 py-2">
                <Icon name="download" className="w-4 h-4 inline mr-1" /> Download PNG
              </button>
            </div>
          </div>
          <div className="card p-4 flex justify-center bg-slate-900 rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '600px' }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center">
            Only percentages are shown â€” your actual amounts stay private.
          </p>
        </div>
      )}
    </div>
  );
};
