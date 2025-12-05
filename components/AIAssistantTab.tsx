
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Transaction } from '../types';
import { useCurrency } from '../Dashboard';
import { Icon } from '../constants';
import { getStrategicAdvice } from '../services/geminiService';
import { calculateFireMetrics, detectRecurring, getDeepInsights } from '../services/analysisEngine';

// --- CONSTANTS ---
// Changed from 10% to 6% as per user request for conservative liability matching
const CORPUS_GROWTH_RATE = 0.06; 

// --- TYPES ---
interface OneTimeExpense {
    id: string;
    name: string;
    currentCost: number;
    yearsFromNow: number;
    inflationRate: number;
}

// --- COMPONENTS ---

const OneTimeExpensesManager = ({ 
    expenses, 
    setExpenses 
}: { 
    expenses: OneTimeExpense[], 
    setExpenses: (v: OneTimeExpense[]) => void 
}) => {
    const { formatCurrency } = useCurrency();

    const addExpense = () => {
        setExpenses([...expenses, {
            id: Date.now().toString(),
            name: '',
            currentCost: 0,
            yearsFromNow: 5,
            inflationRate: 7 // Default inflation
        }]);
    };

    const updateExpense = (id: string, field: keyof OneTimeExpense, value: any) => {
        // Prevent NaN by defaulting invalid number inputs to 0 immediately
        let safeValue = value;
        if (field === 'currentCost' || field === 'yearsFromNow' || field === 'inflationRate') {
            if (isNaN(value)) safeValue = 0;
        }

        setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: safeValue } : e));
    };

    const removeExpense = (id: string) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                         <Icon name="calendar" className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Big Ticket Expenses</h3>
                        <p className="text-slate-500 text-sm">One-time future costs (Weddings, Education, Home)</p>
                    </div>
                </div>
            </div>

            {/* RESPONSIVE TABLE CONTAINER */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
                <table className="w-full min-w-[800px] border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">Expense</th>
                            <th className="text-right py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[15%]">Current Value</th>
                            <th className="text-right py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[12%]">How Many Years</th>
                            <th className="text-right py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[12%]">Expected Inflation</th>
                            <th className="text-right py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[15%]">Future Value</th>
                            <th className="text-right py-3 px-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-[15%]">Corpus Needed</th>
                            <th className="w-[6%]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {expenses.map((expense, idx) => {
                            const years = expense.yearsFromNow || 0;
                            const inflation = expense.inflationRate || 0;
                            const current = expense.currentCost || 0;

                            const futureCost = current * Math.pow(1 + (inflation / 100), years);
                            const corpusNeeded = futureCost / Math.pow(1 + CORPUS_GROWTH_RATE, years);
                            
                            return (
                                <tr key={expense.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-3">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Kids College"
                                            value={expense.name}
                                            onChange={e => updateExpense(expense.id, 'name', e.target.value)}
                                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:font-normal"
                                        />
                                    </td>
                                    <td className="py-3 px-3">
                                        <input 
                                            type="number" 
                                            placeholder="0"
                                            value={current || ''}
                                            onChange={e => updateExpense(expense.id, 'currentCost', parseFloat(e.target.value))}
                                            className="w-full bg-transparent border border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 text-sm font-mono text-right outline-none transition-all"
                                        />
                                    </td>
                                    <td className="py-3 px-3">
                                        <input 
                                            type="number" 
                                            value={years || ''}
                                            onChange={e => updateExpense(expense.id, 'yearsFromNow', parseFloat(e.target.value))}
                                            className="w-full bg-transparent border border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 text-sm font-mono text-right outline-none transition-all"
                                        />
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={inflation || ''}
                                                onChange={e => updateExpense(expense.id, 'inflationRate', parseFloat(e.target.value))}
                                                className="w-full bg-transparent border border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 text-sm font-mono text-right outline-none transition-all pr-5"
                                            />
                                            <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">%</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <span className="text-sm font-mono text-slate-600 block py-1.5">{formatCurrency(futureCost)}</span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <span className="text-sm font-bold font-mono text-blue-700 block py-1.5 bg-blue-50 rounded px-2">{formatCurrency(corpusNeeded)}</span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <button 
                                            onClick={() => removeExpense(expense.id)} 
                                            className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50" 
                                            title="Remove Item"
                                        >
                                            <Icon name="trash" className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {expenses.length === 0 && (
                     <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm mb-4">
                         No big expenses added yet. Add items like a home down payment or wedding.
                     </div>
            )}

            <div className="flex justify-between items-center mt-4">
                 <button 
                    onClick={addExpense} 
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                    <span>+ Add Expense</span>
                </button>
                <span className="text-[10px] text-slate-400 italic">
                    * 6% return on capital assumed for liability matching (safe assets).
                </span>
            </div>
        </div>
    )
}

const FireProjectionHero = ({ metrics, oneTimeExpenses = [] }: { metrics: any, oneTimeExpenses?: OneTimeExpense[] }) => {
    const { formatCurrency } = useCurrency();
    
    // --- SCENARIO EDITING STATE ---
    // We allow the user to override monthly spend and inflation locally to see "What If" scenarios
    const [monthlySpend, setMonthlySpend] = useState(metrics.avgMonthlyExpense);
    const [inflation, setInflation] = useState(metrics.personalInflation);
    
    // Edit mode toggles
    const [isEditingSpend, setIsEditingSpend] = useState(false);
    const [isEditingInflation, setIsEditingInflation] = useState(false);
    
    // Temp values for input fields
    const [editSpendVal, setEditSpendVal] = useState('');
    const [editInflationVal, setEditInflationVal] = useState('');

    const spendInputRef = useRef<HTMLInputElement>(null);
    const inflationInputRef = useRef<HTMLInputElement>(null);

    // Sync state with props ONLY if user hasn't started editing (or if data resets completely)
    // We want to respect the user's manual override if they've made one, but if the dataset changes significantly, we reset.
    useEffect(() => {
        setMonthlySpend(metrics.avgMonthlyExpense);
        setInflation(metrics.personalInflation);
    }, [metrics]);

    // Focus handling
    useEffect(() => {
        if (isEditingSpend && spendInputRef.current) {
            spendInputRef.current.focus();
            spendInputRef.current.select();
        }
    }, [isEditingSpend]);

    useEffect(() => {
        if (isEditingInflation && inflationInputRef.current) {
            inflationInputRef.current.focus();
            inflationInputRef.current.select();
        }
    }, [isEditingInflation]);

    // --- RECALCULATION LOGIC ---
    // Re-calculate the core FIRE numbers based on the (potentially overridden) state
    const currentAnnual = monthlySpend * 12;
    // 25x Rule
    const baseFireNumber = currentAnnual * 25; 

    // Calculate Extra Corpus Needed TODAY for one-time liabilities
    const extraCorpusToday = oneTimeExpenses.reduce((sum, item) => {
        const years = item.yearsFromNow || 0;
        const inf = item.inflationRate || 0;
        const current = item.currentCost || 0;
        
        const futureCost = current * Math.pow(1 + (inf / 100), years);
        const pv = futureCost / Math.pow(1 + CORPUS_GROWTH_RATE, years);
        return sum + pv;
    }, 0);

    const totalFireNumber = baseFireNumber + extraCorpusToday;

    // Projection calculation using the current STATE inflation and spend
    const getAdjustedProjection = (year: number) => {
        // Living Expenses Part
        const futureAnnualLiving = currentAnnual * Math.pow(1 + inflation, year);
        const livingCorpus = futureAnnualLiving * 25;

        // One-time Expenses Part
        const extraAtYearX = oneTimeExpenses.reduce((sum, item) => {
             const expenseYears = item.yearsFromNow || 0;
             const inf = item.inflationRate || 0;
             const current = item.currentCost || 0;
             
             if (expenseYears < year) return sum; 
             
             const futureCost = current * Math.pow(1 + (inf / 100), expenseYears);
             // Discount back to year X (not today)
             const pvAtX = futureCost / Math.pow(1 + CORPUS_GROWTH_RATE, expenseYears - year);
             return sum + pvAtX;
        }, 0);

        return livingCorpus + extraAtYearX;
    };

    // Handlers
    const handleSpendDoubleClick = () => {
        setEditSpendVal(Math.round(monthlySpend).toString());
        setIsEditingSpend(true);
    };

    const saveSpend = () => {
        const val = parseFloat(editSpendVal);
        if (!isNaN(val) && val > 0) setMonthlySpend(val);
        setIsEditingSpend(false);
    };

    const handleInflationDoubleClick = () => {
        setEditInflationVal((inflation * 100).toFixed(1));
        setIsEditingInflation(true);
    };

    const saveInflation = () => {
        const val = parseFloat(editInflationVal);
        if (!isNaN(val)) setInflation(val / 100); // Convert % back to decimal
        setIsEditingInflation(false);
    };

    const resetSpend = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMonthlySpend(metrics.avgMonthlyExpense);
    };

    const resetInflation = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInflation(metrics.personalInflation);
    };

    const isSpendModified = Math.abs(monthlySpend - metrics.avgMonthlyExpense) > 1;
    const isInflationModified = Math.abs(inflation - metrics.personalInflation) > 0.001;

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -ml-20 -mb-20"></div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                            Financial Freedom
                        </span>
                        <span className="text-slate-400 text-xs">Target Corpus (25x Living + Liabilities)</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-baseline gap-4">
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                            {formatCurrency(totalFireNumber)}
                        </h2>
                    </div>
                    {extraCorpusToday > 0 ? (
                        <div className="text-slate-400 text-sm flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <span>Base: {formatCurrency(baseFireNumber)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="text-blue-300 font-semibold">+ {formatCurrency(extraCorpusToday)} for Big Ticket Expenses</span>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-lg">Your "Freedom Number" to retire today.</p>
                    )}
                </div>
                
                <div className="flex flex-row gap-4 h-full">
                     <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex-1 group transition-all hover:bg-white/15 relative flex flex-col justify-between min-w-[140px]">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-sm text-slate-300 whitespace-nowrap font-medium">Avg Monthly Spend</span>
                            {isSpendModified && (
                                <button 
                                    onClick={resetSpend} 
                                    className="text-blue-300 hover:text-white transition-colors" 
                                    title="Reset to calculated value"
                                >
                                    <Icon name="refresh" className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
                        {isEditingSpend ? (
                            <input 
                                ref={spendInputRef}
                                type="number" 
                                className="w-full bg-transparent border-b border-blue-400 text-xl md:text-2xl font-bold text-white outline-none p-0 mt-1"
                                value={editSpendVal}
                                onChange={(e) => setEditSpendVal(e.target.value)}
                                onBlur={saveSpend}
                                onKeyDown={(e) => e.key === 'Enter' && saveSpend()}
                            />
                        ) : (
                            <div 
                                className="text-xl md:text-2xl font-bold text-white cursor-pointer hover:text-blue-200 transition-colors select-none mt-1" 
                                onDoubleClick={handleSpendDoubleClick}
                                title="Double click to simulate different spending"
                            >
                                {formatCurrency(monthlySpend)}
                            </div>
                        )}
                        <div className="text-xs text-slate-400 mt-1 truncate">Estimated Living Cost</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex-1 group transition-all hover:bg-white/15 relative flex flex-col justify-between min-w-[140px]">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-sm text-slate-300 whitespace-nowrap font-medium">Personal Inflation</span>
                            {isInflationModified && (
                                <button 
                                    onClick={resetInflation} 
                                    className="text-blue-300 hover:text-white transition-colors" 
                                    title="Reset to calculated value"
                                >
                                    <Icon name="refresh" className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {isEditingInflation ? (
                            <div className="flex items-center mt-1">
                                <input 
                                    ref={inflationInputRef}
                                    type="number" 
                                    className="w-full bg-transparent border-b border-blue-400 text-xl md:text-2xl font-bold text-white outline-none p-0"
                                    value={editInflationVal}
                                    onChange={(e) => setEditInflationVal(e.target.value)}
                                    onBlur={saveInflation}
                                    onKeyDown={(e) => e.key === 'Enter' && saveInflation()}
                                />
                                <span className="text-xl font-bold ml-1">%</span>
                            </div>
                        ) : (
                            <div 
                                className="text-xl md:text-2xl font-bold text-white cursor-pointer hover:text-blue-200 transition-colors select-none mt-1"
                                onDoubleClick={handleInflationDoubleClick}
                                title="Double click to simulate inflation"
                            >
                                {(inflation * 100).toFixed(1)}%
                            </div>
                        )}
                        <div className="text-xs text-slate-400 mt-1 truncate">Affects future projections</div>
                    </div>
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
                                <div className="text-white font-bold text-lg md:text-xl tracking-tight">
                                    {formatCurrency(getAdjustedProjection(year))}
                                </div>
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group h-full flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2.5 rounded-xl ${trend === 'good' ? 'bg-green-50 text-green-600' : trend === 'bad' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                <Icon name={icon} className="w-5 h-5" />
            </div>
            {trend === 'good' && <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-full h-fit">Positive</span>}
            {trend === 'bad' && <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-full h-fit">Attention</span>}
        </div>
        <div>
            <h4 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-2">{title}</h4>
            <div className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 group-hover:text-blue-600 transition-colors leading-none tracking-tight">{value}</div>
            <p className="text-slate-600 text-base font-medium leading-relaxed">{description}</p>
        </div>
    </div>
);

const IncomeGrowthCard = ({ growth, inflation }: { growth: number, inflation: number }) => {
    const realGrowth = growth - inflation;
    const isPositive = realGrowth > 0;
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2.5 rounded-xl ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    <Icon name="chart" className="w-5 h-5" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full h-fit ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {isPositive ? 'Building' : 'Losing'}
                </span>
            </div>
            <div>
                <h4 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-2">Real Income Growth</h4>
                <div className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 leading-none tracking-tight">{(growth * 100).toFixed(1)}%</div>
                <p className="text-slate-600 text-base font-medium leading-relaxed">
                    Income grew by <span className="font-bold text-slate-800">{(growth * 100).toFixed(1)}%</span>. Adjusted for inflation ({(inflation * 100).toFixed(1)}%), real buying power change is <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{(realGrowth * 100).toFixed(1)}%</span>.
                </p>
            </div>
        </div>
    );
};

const RecurringBox = ({ recurring }: { recurring: any[] }) => {
    const { formatCurrency } = useCurrency();
    const totalRecurring = recurring.reduce((sum, r) => sum + r.avgAmount, 0);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-lg">Recurring Commitments</h3>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{recurring.length} Found</span>
            </div>
            
            <div className="mb-4">
                <span className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">{formatCurrency(totalRecurring)}</span>
                <span className="text-slate-500 text-sm ml-1 block mt-1">/ month estimated fixed cost</span>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-grow h-[140px]">
                {recurring.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-bold text-slate-700 text-base truncate pr-2">{rec.name}</span>
                            <span className="text-xs text-slate-400 font-medium">Every ~{rec.frequency} days</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800 text-base whitespace-nowrap">{formatCurrency(rec.avgAmount)}</span>
                    </div>
                ))}
                {recurring.length === 0 && <div className="h-full flex items-center justify-center"><p className="text-slate-400 text-base italic">No clear subscriptions detected.</p></div>}
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
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg text-white h-full relative overflow-hidden flex flex-col justify-between">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[50px] opacity-20 -mr-10 -mt-10"></div>
             
             <div>
                <h3 className="text-emerald-100 font-bold text-lg mb-4 relative z-10">Total Savings Pool</h3>
                <div className="mb-2 relative z-10">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">{formatCurrency(savings)}</span>
                </div>
                <p className="text-emerald-100 text-sm mb-4 relative z-10 font-medium">Net saved across all time</p>
             </div>

             <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 relative z-10 mt-auto">
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-base font-medium text-emerald-100">Savings Rate</span>
                     <span className="text-2xl sm:text-3xl font-bold">{rate.toFixed(1)}%</span>
                 </div>
                 <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                     <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${Math.min(Math.max(rate, 0), 100)}%` }}></div>
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

export const FireCalculatorTab = ({ data }: { data: Transaction[] }) => {
    // --- STATE FOR ONE TIME EXPENSES ---
    const [oneTimeExpenses, setOneTimeExpenses] = useState<OneTimeExpense[]>(() => {
        try {
            const stored = localStorage.getItem('trackspendz_onetime_expenses');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Smart migration for old data structure if needed (ensure defaults exist)
    useEffect(() => {
        setOneTimeExpenses(prev => prev.map(e => ({
            ...e,
            inflationRate: e.inflationRate ?? 7, // Default 7% if missing
            yearsFromNow: e.yearsFromNow ?? 5
        })));
    }, []);

    const updateExpenses = (newExpenses: OneTimeExpense[]) => {
        setOneTimeExpenses(newExpenses);
        localStorage.setItem('trackspendz_onetime_expenses', JSON.stringify(newExpenses));
    };

    // --- RUN LOCAL INTELLIGENCE ---
    const fireMetrics = useMemo(() => calculateFireMetrics(data), [data]);
    const recurring = useMemo(() => detectRecurring(data), [data]);
    const deepInsights = useMemo(() => getDeepInsights(data), [data]);

    return (
        <div className="max-w-7xl mx-auto pb-12">
            
            {/* 1. FIRE HERO & TIMELINE (Top Row) */}
            <FireProjectionHero metrics={fireMetrics} oneTimeExpenses={oneTimeExpenses} />

            {/* 2. ONE TIME EXPENSES SECTION (Middle) */}
            <OneTimeExpensesManager expenses={oneTimeExpenses} setExpenses={updateExpenses} />

            {/* 3. GRID LAYOUT (Bottom) */}
            {/* Removed auto-rows-fr to allow natural height sizing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 items-stretch">
                
                {/* 1. Recurring */}
                <RecurringBox recurring={recurring} />

                {/* 2. Income Growth */}
                <IncomeGrowthCard growth={fireMetrics.annualIncomeGrowth || 0} inflation={fireMetrics.personalInflation} />

                {/* 3. Deep Insight 1 */}
                {deepInsights[0] ? (
                    <DeepInsightCard 
                        title={deepInsights[0].title}
                        value={deepInsights[0].value}
                        description={deepInsights[0].description}
                        trend={deepInsights[0].trend}
                        icon={deepInsights[0].trend === 'bad' ? 'flash' : deepInsights[0].trend === 'good' ? 'shield' : 'chart'}
                    />
                ) : (
                    <DeepInsightCard title="Insight" value="Analyzing..." description="More data needed." trend="neutral" icon="ai" />
                )}

                {/* 4. Savings Pool */}
                <SavingsBox data={data} />

                {/* 5. Deep Insight 2 */}
                {deepInsights[1] ? (
                    <DeepInsightCard 
                        title={deepInsights[1].title}
                        value={deepInsights[1].value}
                        description={deepInsights[1].description}
                        trend={deepInsights[1].trend}
                        icon={deepInsights[1].trend === 'bad' ? 'flash' : deepInsights[1].trend === 'good' ? 'shield' : 'chart'}
                    />
                ) : (
                    <DeepInsightCard title="Insight" value="Processing" description="Add more transactions." trend="neutral" icon="ai" />
                )}

                {/* 6. Deep Insight 3 */}
                {deepInsights[2] ? (
                    <DeepInsightCard 
                        title={deepInsights[2].title}
                        value={deepInsights[2].value}
                        description={deepInsights[2].description}
                        trend={deepInsights[2].trend}
                        icon={deepInsights[2].trend === 'bad' ? 'flash' : deepInsights[2].trend === 'good' ? 'shield' : 'chart'}
                    />
                ) : (
                    <DeepInsightCard title="Analyst" value="Ready" description="Upload data to unlock." trend="neutral" icon="ai" />
                )}
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
