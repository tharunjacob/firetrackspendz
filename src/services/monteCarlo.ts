import type { MonteCarloInput, MonteCarloResult } from '@/types';

// ============================================================
// Monte Carlo Retirement Simulation Engine
// ============================================================
//
// Runs N simulated retirement paths using randomized annual
// returns drawn from a normal distribution (Box-Muller transform).
//
// Each simulation:
//   1. Accumulation phase: contribute monthly, grow at random returns
//   2. Retirement phase: withdraw annually (inflation-adjusted), grow at random returns
//   3. Track if portfolio runs out ("failure") or survives ("success")
//
// Returns success rate and percentile bands for fan chart visualization.
//
// Performance: 1000 sims × 50 years ≈ 50ms on modern hardware.
// ============================================================

/** Box-Muller transform for normally-distributed random numbers */
const randomNormal = (mean: number, stdDev: number): number => {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
};

/** Clamp a return between -50% and +80% to avoid absurd outliers */
const clampReturn = (r: number): number => Math.max(-0.50, Math.min(0.80, r));

export const runMonteCarloSimulation = (
  input: MonteCarloInput,
  simulations = 1000
): MonteCarloResult => {
  const {
    currentSavings,
    monthlyContribution,
    yearsToRetirement,
    yearsInRetirement,
    withdrawalRate,
    expectedReturn,
    returnStdDev,
    inflationRate,
  } = input;

  const totalYears = yearsToRetirement + yearsInRetirement;
  const annualContribution = monthlyContribution * 12;

  // Store portfolio value at each year for all simulations
  const allPaths: number[][] = [];
  let successes = 0;
  let failureYearSum = 0;
  let failureCount = 0;

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [currentSavings];
    let portfolio = currentSavings;
    let failed = false;
    // Fixed real (inflation-adjusted) annual spend, locked in at retirement.
    // Carried per-simulation; set when this path enters its first retirement year.
    let baseWithdrawal = 0;

    for (let year = 1; year <= totalYears; year++) {
      const annualReturn = clampReturn(randomNormal(expectedReturn / 100, returnStdDev / 100));

      if (year <= yearsToRetirement) {
        // Accumulation: contribute + grow
        portfolio = (portfolio + annualContribution) * (1 + annualReturn);
      } else {
        // Retirement: standard 4%-rule model — withdraw a FIXED REAL amount.
        // The dollar withdrawal is set once at the start of retirement as a
        // percentage of the initial retirement portfolio, then grows with
        // inflation each year, INDEPENDENT of the current (fluctuating) balance.
        // (Contrast with taking withdrawalRate% of the live balance, which can
        // never fully deplete the portfolio and inflates the success rate.)
        const retirementYear = year - yearsToRetirement;
        if (retirementYear === 1) {
          baseWithdrawal = portfolio * (withdrawalRate / 100);
        }
        const annualWithdrawal = baseWithdrawal * Math.pow(1 + inflationRate / 100, retirementYear - 1);
        portfolio = (portfolio - annualWithdrawal) * (1 + annualReturn);
      }

      if (portfolio <= 0 && !failed) {
        portfolio = 0;
        failed = true;
        failureYearSum += year;
        failureCount++;
      }

      path.push(Math.max(0, portfolio));
    }

    if (!failed) successes++;
    allPaths.push(path);
  }

  // Compute percentile bands at each year
  const percentiles: MonteCarloResult['percentiles'] = { p10: [], p25: [], p50: [], p75: [], p90: [] };

  for (let year = 0; year <= totalYears; year++) {
    const valuesAtYear = allPaths.map(p => p[year]).sort((a, b) => a - b);
    const pct = (p: number) => valuesAtYear[Math.floor(p * simulations)] || 0;
    percentiles.p10.push(Math.round(pct(0.10)));
    percentiles.p25.push(Math.round(pct(0.25)));
    percentiles.p50.push(Math.round(pct(0.50)));
    percentiles.p75.push(Math.round(pct(0.75)));
    percentiles.p90.push(Math.round(pct(0.90)));
  }

  const medianEnding = percentiles.p50[totalYears] || 0;

  return {
    successRate: Math.round((successes / simulations) * 100),
    percentiles,
    medianEndingBalance: medianEnding,
    failureYear: failureCount > 0 ? Math.round(failureYearSum / failureCount) : null,
  };
};
