import { useState, useMemo, useRef, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { generateFinancialInsights, getStrategicAdvice, isAIAvailable } from '@/services/gemini';
import { generateSummaryText } from '@/services/analysis';
import { CURRENCIES } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

export const AIAdvisorView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_AI_ADVISOR_OPENED); }, []);
  const { transactions, currency, plan } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string>('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => generateSummaryText(transactions, CURRENCIES[currency].symbol), [transactions, currency]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const result = await generateFinancialInsights(summary);
      setInsights(result);
    } finally { setInsightsLoading(false); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await getStrategicAdvice(summary, userMsg.text, messages);
      setMessages(prev => [...prev, { role: 'bot', text: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I couldn\'t process that request.' }]);
    } finally { setLoading(false); }
  };

  if (!isAIAvailable()) {
    return (
      <div className="card p-8 text-center animate-fade-in">
        <Icon name="ai" className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">AI Advisor Unavailable</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Please configure your Gemini API key in the environment variables to enable AI features.</p>
        <p className="text-xs text-slate-400 mt-2">Set VITE_GEMINI_API_KEY in your .env file</p>
      </div>
    );
  }

  if (!canAccessFeature(plan, 'ai_advisor')) {
    return <UpgradePrompt feature="AI Financial Advisor" description="Get personalized financial advice powered by AI" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick Insights */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI Financial Insights</h3>
          <button onClick={loadInsights} disabled={insightsLoading} className="btn-secondary text-xs px-3 py-1.5">
            {insightsLoading ? 'Analyzing...' : 'Generate Insights'}
          </button>
        </div>
        {insights ? (
          <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{insights}</div>
        ) : (
          <p className="text-sm text-slate-400">Click "Generate Insights" to get personalized financial advice based on your data.</p>
        )}
      </div>

      {/* Chat Interface */}
      <div className="card flex flex-col" style={{ height: '500px' }}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ask Your AI CFO</h3>
          <p className="text-xs text-slate-400">Ask questions about your spending, savings, or financial strategy</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Icon name="ai" className="w-10 h-10 text-brand-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {['How can I improve my savings rate?', 'What are my biggest spending leaks?', 'Am I on track for FIRE?', 'How to reduce subscriptions?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); }} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs hover:bg-slate-200 dark:hover:bg-slate-600">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              className="input-field flex-1"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4">
              <Icon name="send" className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
