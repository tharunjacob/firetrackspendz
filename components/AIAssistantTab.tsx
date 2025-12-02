
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Transaction } from '../types';
import { useCurrency } from '../Dashboard';
import { Icon } from '../constants';
import { getStrategicAdvice } from '../services/geminiService';
import { calculateFireMetrics, detectRecurring, getDeepInsights } from '../services/analysisEngine';

// --- COMPONENTS ---

const FireProjectionHero = ({ metrics }: { metrics: any }) => {
    const { formatCurrency } = useCurrency();
    const { fireNumberCurrent, yearsToFreedom, avgMonthlyExpense, personalInflation } = metrics;
    
    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -ml-20 -mb-20"></div>

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                            Financial Freedom
                        </span>
                        <span className="text-slate-400 text-xs">Based on {formatCurrency(avgMonthlyExpense)}/mo avg expense</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                        {formatCurrency(fireNumberCurrent)}
                    </h2>
                    <p className="text-slate-400 text-lg">Your "Freedom Number" to retire today (25x Rule).</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[200px]">
                    <div className="text-sm text-slate-300 mb-1">Personal Inflation Rate</div>
                    <div className="text-2xl font-bold text-white">{(personalInflation * 100).toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Used for future projections</div>
                </div>
            </div>

            {/* Timeline Scroll */}
            <div className="mt-10">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Required Capital if Retiring In...</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[1, 5, 7, 10, 15].map(year => (
                        <div key={year} className="bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-xl p-4 flex flex-col justify-between h-28">
                            <span className="text-blue-300 font-bold text-lg">{year} Year{year > 1 ? 's' : ''}</span>
                            <div>
                                <div className="text-white font-bold text-xl tracking-tight">{formatCurrency(yearsToFreedom[year])}</div>
                                <div className="text-[10px] text-slate-400 mt-1">Inflation adj.</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DeepInsightCard = ({ title, value, description, trend, icon }: { title: string, value: string, description: string, trend: string, icon: string }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group h-full">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${trend === 'good' ? 'bg-green-50 text-green-600' : trend === 'bad' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                <Icon name={icon} className="w-6 h-6" />
            </div>
            {trend === 'good' && <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-full">Positive</span>}
            {trend === 'bad' && <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-full">Attention</span>}
        </div>
        <h4 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">{title}</h4>
        <div className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{value}</div>
        <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
);

const RecurringBox = ({ recurring }: { recurring: any[] }) => {
    const { formatCurrency } = useCurrency();
    const totalRecurring = recurring.reduce((sum, r) => sum + r.avgAmount, 0);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Recurring Commitments</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{recurring.length} Found</span>
            </div>
            
            <div className="mb-6">
                <span className="text-3xl font-black text-slate-800">{formatCurrency(totalRecurring)}</span>
                <span className="text-slate-500 text-sm ml-2">/ month estimated fixed cost</span>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                {recurring.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-700 text-sm">{rec.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Every ~{rec.frequency} days</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(rec.avgAmount)}</span>
                    </div>
                ))}
                {recurring.length === 0 && <p className="text-slate-400 text-sm italic py-4 text-center">No clear subscriptions detected.</p>}
            </div>
        </div>
    );
};

const SavingsBox = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const income = data.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expense = data.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    const savings = income - expense;
    const rate = income > 0 ? (savings / income) * 100 : 0;

    return (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg text-white h-full relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[50px] opacity-20 -mr-10 -mt-10"></div>
             
             <h3 className="text-emerald-100 font-bold text-lg mb-8 relative z-10">Total Savings Pool</h3>
             
             <div className="mb-2 relative z-10">
                 <span className="text-4xl font-black">{formatCurrency(savings)}</span>
             </div>
             <p className="text-emerald-100 text-sm mb-8 relative z-10">Net saved across all time</p>

             <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 relative z-10">
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-sm font-medium text-emerald-100">Savings Rate</span>
                     <span className="text-xl font-bold">{rate.toFixed(1)}%</span>
                 </div>
                 <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                     <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${Math.min(rate, 100)}%` }}></div>
                 </div>
             </div>
        </div>
    );
};

const StrategicChat = ({ context }: { context: any }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
        { role: 'bot', text: "👋 I'm your FIRE Strategist. I've analyzed your inflation rate, recurring bills, and spending patterns. Ask me how to reach your number faster!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Only scroll the CHAT container, NOT the window
    useEffect(() => { 
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            const contextStr = JSON.stringify(context);
            const response = await getStrategicAdvice(contextStr, userMsg);
            setMessages(prev => [...prev, { role: 'bot', text: response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'bot', text: "Connection issue. Try again." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Strategic Advisor
                </h3>
                <span className="text-xs text-slate-400 font-medium">Powered by Gemini AI</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatContainerRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-slate-800 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm border border-slate-200'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {loading && <div className="flex justify-start"><div className="bg-slate-50 px-4 py-2 rounded-full text-xs text-slate-400 animate-pulse border border-slate-100">Thinking...</div></div>}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl">
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all placeholder:text-slate-400"
                        placeholder="Ask about your FIRE number or savings strategy..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button onClick={handleSend} disabled={loading} className="bg-slate-900 text-white px-5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-200">
                        <Icon name="send" className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
};

// Renamed from AIAssistantTab to FireCalculatorTab
export const FireCalculatorTab = ({ data }: { data: Transaction[] }) => {
    // --- RUN LOCAL INTELLIGENCE ---
    const fireMetrics = useMemo(() => calculateFireMetrics(data), [data]);
    const recurring = useMemo(() => detectRecurring(data), [data]);
    const deepInsights = useMemo(() => getDeepInsights(data), [data]);

    return (
        <div className="max-w-7xl mx-auto pb-12">
            
            {/* 1. FIRE HERO & TIMELINE */}
            <FireProjectionHero metrics={fireMetrics} />

            {/* 2. GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
                
                {/* Column 1: Recurring & Savings (Vertical Stack) */}
                <div className="flex flex-col gap-6 h-full">
                    <div className="flex-1 min-h-[250px]">
                        <RecurringBox recurring={recurring} />
                    </div>
                    <div className="flex-1 min-h-[250px]">
                         <SavingsBox data={data} />
                    </div>
                </div>

                {/* Column 2 & 3: Deep Insights (2x2 Grid ideally, or vertical) */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                    {deepInsights.map((insight, idx) => (
                        <div key={idx} className="h-full">
                            <DeepInsightCard 
                                title={insight.title}
                                value={insight.value}
                                description={insight.description}
                                trend={insight.trend}
                                icon={insight.trend === 'bad' ? 'flash' : insight.trend === 'good' ? 'shield' : 'chart'}
                            />
                        </div>
                    ))}
                    {/* Fallback if not enough insights */}
                    {deepInsights.length < 3 && (
                        <div className="h-full">
                            <DeepInsightCard 
                                title="Data Analyst"
                                value="Learning..."
                                description="Add more transactions to unlock deeper behavioral insights."
                                trend="neutral"
                                icon="ai"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const AIChatTab = ({ data }: { data: Transaction[] }) => {
    // Re-calculate context for the chat
    const fireMetrics = useMemo(() => calculateFireMetrics(data), [data]);
    const recurring = useMemo(() => detectRecurring(data), [data]);
    const deepInsights = useMemo(() => getDeepInsights(data), [data]);

    const contextData = { 
        fireMetrics, 
        recurringCount: recurring.length, 
        insights: deepInsights 
    };

    return (
        <div className="max-w-5xl mx-auto h-[calc(100vh-280px)] min-h-[500px]">
            <StrategicChat context={contextData} />
        </div>
    );
};
