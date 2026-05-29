// One-time script to generate public/og-image.png (1200x630)
// Run: node scripts/generate-og-image.cjs
'use strict';

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background: white
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, W, H);

// Left accent bar (brand indigo)
ctx.fillStyle = '#4f46e5';
ctx.fillRect(0, 0, 12, H);

// Top gradient band
const grad = ctx.createLinearGradient(0, 0, W, 0);
grad.addColorStop(0, '#eef2ff');   // indigo-50
grad.addColorStop(1, '#ffffff');
ctx.fillStyle = grad;
ctx.fillRect(12, 0, W - 12, 160);

// Brand name
ctx.fillStyle = '#1e293b';         // slate-800
ctx.font = 'bold 80px sans-serif';
ctx.fillText('TrackSpendZ', 72, 108);

// Accent dot on the Z
ctx.fillStyle = '#4f46e5';
ctx.beginPath();
ctx.arc(W - 80, 80, 18, 0, Math.PI * 2);
ctx.fill();

// Tagline
ctx.fillStyle = '#475569';         // slate-600
ctx.font = '36px sans-serif';
ctx.fillText('See exactly where your money goes.', 72, 210);

// Divider line
ctx.strokeStyle = '#e2e8f0';       // slate-200
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(72, 260);
ctx.lineTo(W - 72, 260);
ctx.stroke();

// Feature pills
const features = [
  { icon: '📊', label: 'AI-powered categorization' },
  { icon: '🔥', label: 'FIRE Calculator' },
  { icon: '💰', label: 'Net Worth Tracker' },
  { icon: '🏦', label: 'Works with any bank' },
];

let px = 72;
const py = 330;
ctx.font = '26px sans-serif';
features.forEach(f => {
  const label = `${f.icon}  ${f.label}`;
  const metrics = ctx.measureText(label);
  const pw = metrics.width + 40;
  const ph = 52;

  // Pill background
  ctx.fillStyle = '#f1f5f9';       // slate-100
  ctx.beginPath();
  ctx.roundRect(px, py - 36, pw, ph, 26);
  ctx.fill();

  ctx.fillStyle = '#334155';       // slate-700
  ctx.fillText(label, px + 20, py + 2);
  px += pw + 20;
});

// Bottom strip
ctx.fillStyle = '#4f46e5';
ctx.fillRect(0, H - 80, W, 80);

// Bottom text
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 28px sans-serif';
ctx.fillText('Free to start  ·  Works with any bank  ·  AI-powered insights', 72, H - 28);

// URL hint (right-aligned)
ctx.font = '24px sans-serif';
ctx.fillStyle = '#c7d2fe';         // indigo-200
const urlText = 'trackspendz.com';
const urlW = ctx.measureText(urlText).width;
ctx.fillText(urlText, W - urlW - 60, H - 28);

// Write file
const outPath = path.join(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
console.log(`✓ og-image.png written to ${outPath} (${W}×${H})`);
