-- Migration 005: Allow 'abandoned' status for user_profiles.subscription_status
-- This enables tracking users who initiated premium checkout but did not complete payment.

DO $$ BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;
  ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_subscription_status_check
    CHECK (subscription_status IN (
      'active', 'trialing', 'canceled', 'past_due',
      'authenticated', 'pending', 'halted', 'completed', 'expired', 'abandoned'
    ));
END $$;
