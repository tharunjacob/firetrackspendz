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

const formatInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const MarkdownText = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'ol' | 'ul' | null = null;

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      if (listType === 'ul') {
        elements.push(<ul key={`ul-${key}`} className="list-disc pl-5 my-2 space-y-1">{...currentList}</ul>);
      } else {
        elements.push(<ol key={`ol-${key}`} className="list-decimal pl-5 my-2 space-y-1">{...currentList}</ol>);
      }
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(idx);
      elements.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }

    const bulletMatch = line.match(/^(\s*)[*\-]\s+(.*)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList(idx);
        listType = 'ul';
      }
      currentList.push(<li key={`li-${idx}`} className="text-slate-700 dark:text-slate-200">{formatInline(bulletMatch[2])}</li>);
      return;
    }

    const numberMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (numberMatch) {
      if (listType !== 'ol') {
        flushList(idx);
        listType = 'ol';
      }
      currentList.push(<li key={`li-${idx}`} className="text-slate-700 dark:text-slate-200">{formatInline(numberMatch[2])}</li>);
      return;
    }

    flushList(idx);
    elements.push(<p key={`p-${idx}`} className="mb-2 leading-relaxed text-slate-700 dark:text-slate-200">{formatInline(line)}</p>);
  });

  flushList(lines.length);

  return <div className="space-y-1">{elements}</div>;
};

export const AIAdvisorView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_AI_ADVISOR_OPENED); }, []);
  const { transactions, currency, plan } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('tsz_ai_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string>(() => {
    try {
      return sessionStorage.getItem('tsz_ai_insights') || '';
    } catch {
      return '';
    }
  });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('tsz_ai_messages', JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tsz_ai_insights', insights);
    } catch { /* ignore */ }
  }, [insights]);

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
        <p className="text-xs text-slate-500 mt-2">Set VITE_GEMINI_API_KEY in your .env file</p>
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
          <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-400">
            <MarkdownText text={insights} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Click "Generate Insights" to get personalized financial advice based on your data.</p>
        )}
      </div>

      {/* Chat Interface */}
      <div className="card flex flex-col" style={{ height: '500px' }}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ask Your AI CFO</h3>
          <p className="text-xs text-slate-500">Ask questions about your spending, savings, or financial strategy</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Icon name="ai" className="w-10 h-10 text-brand-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Try asking:</p>
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
                <div className={msg.role === 'user' ? 'whitespace-pre-wrap' : ''}>
                  {msg.role === 'user' ? msg.text : <MarkdownText text={msg.text} />}
                </div>
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
              id="ai-cfo-question"
              name="ai-cfo-question"
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
