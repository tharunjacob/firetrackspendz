import { describe, it, expect } from 'vitest';
import { canAccessFeature, isPlanAtLeast } from '../plans';

describe('Plan Resolution (isPlanAtLeast)', () => {
  it('correctly compares free to other plans', () => {
    expect(isPlanAtLeast('free', 'free')).toBe(true);
    expect(isPlanAtLeast('free', 'pro')).toBe(false);
    expect(isPlanAtLeast('free', 'enterprise')).toBe(false);
  });

  it('correctly compares pro to other plans', () => {
    expect(isPlanAtLeast('pro', 'free')).toBe(true);
    expect(isPlanAtLeast('pro', 'pro')).toBe(true);
    expect(isPlanAtLeast('pro', 'enterprise')).toBe(false);
  });

  it('correctly compares enterprise to other plans', () => {
    expect(isPlanAtLeast('enterprise', 'free')).toBe(true);
    expect(isPlanAtLeast('enterprise', 'pro')).toBe(true);
    expect(isPlanAtLeast('enterprise', 'enterprise')).toBe(true);
  });
});

describe('Feature Gating (canAccessFeature)', () => {
  it('denies premium features to free tier', () => {
    expect(canAccessFeature('free', 'fire_calculator')).toBe(false);
    expect(canAccessFeature('free', 'anomaly_detection')).toBe(false);
    expect(canAccessFeature('free', 'trend_analysis')).toBe(false);
    expect(canAccessFeature('free', 'basic_categorization')).toBe(true); // Basic tier feature
  });

  it('allows pro features to pro tier but denies enterprise', () => {
    expect(canAccessFeature('pro', 'fire_calculator')).toBe(true);
    expect(canAccessFeature('pro', 'anomaly_detection')).toBe(true);
    expect(canAccessFeature('pro', 'family_dashboard')).toBe(false); // Enterprise feature
  });

  it('allows all features to enterprise tier', () => {
    expect(canAccessFeature('enterprise', 'fire_calculator')).toBe(true);
    expect(canAccessFeature('enterprise', 'anomaly_detection')).toBe(true);
    expect(canAccessFeature('enterprise', 'family_dashboard')).toBe(true);
    expect(canAccessFeature('enterprise', 'api_access')).toBe(true);
  });
});
