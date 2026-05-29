import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/common/Icons';
import { useApp } from '@/contexts/AppContext';
import { ROUTES } from '@/config/routes';

interface UpgradePromptProps {
  feature: string;
  description: string;
}

export const UpgradePrompt = ({ feature, description }: UpgradePromptProps) => {
  const { user, setIsAuthOpen } = useApp();
  const navigate = useNavigate();

  const handleClick = () => {
    if (!user) {
      setIsAuthOpen(true);
    } else {
      navigate(ROUTES.PRICING);
    }
  };

  return (
    <div className="text-center py-16 animate-fade-in">
      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon name="shield" className="w-8 h-8 text-brand-600" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{feature}</h3>
      <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
      <button onClick={handleClick} className="btn-primary px-8 py-3">
        {user ? 'Upgrade to Pro' : 'Sign Up to Unlock'}
      </button>
    </div>
  );
};
