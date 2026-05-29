import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '@/services/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase handles the token exchange automatically via detectSessionInUrl
        const { data: { session }, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (session) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/', { replace: true });
      }
    };
    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
