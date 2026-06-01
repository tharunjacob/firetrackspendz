import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(isProd ? '' : (env.VITE_GEMINI_API_KEY || '')),
      'import.meta.env.VITE_RAZORPAY_KEY_ID': JSON.stringify(env.VITE_RAZORPAY_KEY_ID || ''),
      // Stripe key retained for the deprecated stub — see src/services/stripe.ts.
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY || ''),
    },
  };
});
