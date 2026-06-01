import { useRef, useState, useCallback } from 'react';
import { formatAmount } from '@/utils/constants';
import { canAccessFeature } from '@/config/plans';
import type { WrappedStats } from '@/types';

interface Props {
  stats: WrappedStats;
  currency: Parameters<typeof formatAmount>[1];
  plan: Parameters<typeof canAccessFeature>[0];
}

export const WrappedSummary = ({ stats, currency, plan }: Props) => {
  const canShare = canAccessFeature(plan, 'shareable_milestones');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#172554');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(129, 140, 248, 0.12)';
    ctx.beginPath();
    ctx.arc(W / 2, -180, 480, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MY ${stats.year} FINANCIAL WRAPPED`, W / 2, 100);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Year in Review', W / 2, 140);

    const cx = W / 2;
    const cy = 340;
    const r = 140;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.fill();

    const rateAngle = (Math.max(0, Math.min(100, stats.savingsRate)) / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + rateAngle);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 64px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${stats.savingsRate.toFixed(1)}%`, cx, cy - 10);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillText('Savings Rate', cx, cy + 35);

    const statsY = 560;
    const colW = W / 2;
    const statsItems = [
      { label: 'Top Category', value: stats.topCategory.name },
      { label: 'Category Share', value: `${stats.topCategory.pct.toFixed(1)}%` },
      { label: 'Total Transactions', value: String(stats.totalTransactions) },
      { label: 'Unique Merchants', value: String(stats.uniqueMerchants) },
    ];

    statsItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = colW * col + colW / 2;
      const y = statsY + row * 130;

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 36px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.value, x, y);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '18px -apple-system, sans-serif';
      ctx.fillText(item.label, x, y + 35);
    });

    const footerY = H - 80;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, footerY);
    ctx.lineTo(W - 100, footerY);
    ctx.stroke();

    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TrackSpendZ', W / 2, footerY + 30);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('trackspendz.com — Know where your money goes', W / 2, footerY + 56);
  }, [stats, currency]);

  const handleGenerate = () => {
    setShowPreview(true);
    requestAnimationFrame(() => drawCard());
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `financial-wrapped-${stats.year}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch (e) {
      console.warn('[WrappedView] Clipboard copy failed:', e);
    }
  };

  if (!canShare) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm text-center">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Shareable Year Review Card</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Generate a beautiful image of your year in review to share on social media.</p>
        <div className="inline-block bg-brand-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg opacity-80">
          Upgrade to Pro to Unlock
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!showPreview ? (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm text-center">
          <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-brand-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Share Your Year in Review</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Generate a shareable card showing your {stats.year} financial highlights.
          </p>
          <button onClick={handleGenerate} className="btn-primary px-6 py-2.5 text-sm">
            Generate Shareable Card
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Your {stats.year} Year Review</h3>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary text-sm px-4 py-2">
                Copy to Clipboard
              </button>
              <button onClick={handleDownload} className="btn-primary text-sm px-4 py-2">
                Download PNG
              </button>
            </div>
          </div>
          <div className="bg-white p-4 flex justify-center bg-slate-900 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '600px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
