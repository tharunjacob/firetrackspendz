
import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, ComposedChart, Line, Tooltip } from 'recharts';
import { COLORS } from '../constants';
import { calculateFireMetrics, detectRecurring, getDeepInsights } from '../services/analysisEngine';

// --- DATA HELPERS ---
const groupTopN = (data: {name: string, value: number}[], n: number = 6) => {
    if (data.length <= n) return data;
    const topN = data.slice(0, n);
    const others = data.slice(n).reduce((sum, item) => sum + item.value, 0);
    if (others > 0) topN.push({ name: 'Others', value: others });
    return topN;
};

interface PDFReportProps {
    data: Transaction[];
    currency: string;
    formatCurrency: (value: number) => string;
}

const SectionTitle = ({ title, icon }: { title: string, icon?: any }) => (
    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-2 break-inside-avoid">
        <div className="w-1.5 h-6 bg-slate-800 rounded-full"></div>
        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{title}</h2>
    </div>
);

const Card = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm break-inside-avoid ${className}`}>
        {children}
    </div>
);

const KeyMetric = ({ label, value, subValue, color = "text-slate-800" }: { label: string, value: string, subValue?: string, color?: string }) => (
    <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        {subValue && <p className="text-xs text-slate-500 font-medium mt-1">{subValue}</p>}
    </div>
);

export const PDFReport = ({ data, currency, formatCurrency }: PDFReportProps) => {
    // --- 1. CORE ANALYTICS ---
    const fireMetrics = useMemo(() => calculateFireMetrics(data), [data]);
    const recurring = useMemo(() => detectRecurring(data), [data]);
    
    // --- 2. SUMMARY TOTALS ---
    const { totalIncome, totalExpenses, netSavings, savingsRate, avgMonthlyBurn } = useMemo(() => {
        let inc = 0, exp = 0;
        // Get date range for average calculation
        const dates = data.map(t => new Date(t.date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const monthsDiff = Math.max(1, (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth()) + 1);

        data.forEach(t => {
            if (t.type === 'Income') inc += t.amount;
            else if (t.type === 'Expense') exp += t.amount;
        });
        return { 
            totalIncome: inc, 
            totalExpenses: exp, 
            netSavings: inc - exp,
            savingsRate: inc > 0 ? ((inc - exp) / inc) * 100 : 0,
            avgMonthlyBurn: exp / monthsDiff
        };
    }, [data]);

    // --- 3. CATEGORY DATA ---
    const categoryData = useMemo(() => {
        const incomeMap = new Map<string, number>();
        const expenseMap = new Map<string, number>();
        data.forEach(t => {
            if (t.type === 'Income') incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + t.amount);
            else if (t.type === 'Expense') expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + t.amount);
        });
        return {
            income: Array.from(incomeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
            expenses: Array.from(expenseMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
        };
    }, [data]);

    // --- 4. TIME SERIES DATA (Monthly & Yearly) ---
    const { monthlyData, yearlyData } = useMemo(() => {
        const mMap = new Map<string, { income: number, expense: number, date: Date }>();
        const yMap = new Map<string, { income: number, expense: number }>();
        
        data.forEach(t => {
            const date = new Date(t.date);
            // Monthly
            const mKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!mMap.has(mKey)) mMap.set(mKey, { income: 0, expense: 0, date });
            const mEntry = mMap.get(mKey)!;
            
            // Yearly
            const yKey = `${date.getFullYear()}`;
            if (!yMap.has(yKey)) yMap.set(yKey, { income: 0, expense: 0 });
            const yEntry = yMap.get(yKey)!;

            if (t.type === 'Income') { mEntry.income += t.amount; yEntry.income += t.amount; }
            else if (t.type === 'Expense') { mEntry.expense += t.amount; yEntry.expense += t.amount; }
        });

        const mData = Array.from(mMap.values())
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(d => {
                const savings = d.income - d.expense;
                const rate = d.income > 0 ? (savings / d.income) * 100 : 0;
                return {
                    name: d.date.toLocaleString('default', { month: 'short', year: '2-digit' }),
                    Income: d.income,
                    Expense: d.expense,
                    Savings: savings,
                    Rate: rate
                }
            });

        const yData = Array.from(yMap.entries())
            .map(([year, val]) => ({ year, ...val }))
            .sort((a, b) => parseInt(b.year) - parseInt(a.year)); // Newest first for table

        return { monthlyData: mData, yearlyData: yData };
    }, [data]);

    // --- 5. TOP TRANSACTIONS (Outliers) ---
    const bigTicketItems = useMemo(() => {
        return data
            .filter(t => t.type === 'Expense')
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
    }, [data]);

    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="w-[800px] bg-slate-50 text-slate-900 font-sans mx-auto shadow-2xl">
            
            {/* --- PAGE 1: EXECUTIVE SUMMARY & FIRE --- */}
            <div id="pdf-page-1" className="w-full h-[1123px] bg-white p-12 flex flex-col relative overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-start mb-10 border-b-4 border-slate-900 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Track<span className="text-blue-600">Spendz</span></h1>
                        <p className="text-slate-500 font-medium tracking-wide">Strategic Financial Audit</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Report Date</p>
                        <p className="text-lg font-bold text-slate-800">{currentDate}</p>
                    </div>
                </div>

                {/* 1. High Level Metrics */}
                <div className="grid grid-cols-4 gap-6 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <KeyMetric label="Total Income" value={formatCurrency(totalIncome)} color="text-slate-800" />
                    <KeyMetric label="Net Wealth Added" value={formatCurrency(netSavings)} color="text-blue-600" />
                    <KeyMetric label="Avg Monthly Burn" value={formatCurrency(avgMonthlyBurn)} color="text-red-600" />
                    <KeyMetric label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} subValue={savingsRate > 20 ? "Target Met" : "Below Target"} color={savingsRate > 20 ? "text-green-600" : "text-orange-500"} />
                </div>

                {/* 2. FIRE Analysis Section */}
                <SectionTitle title="FIRE Readiness Assessment" />
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Left: FIRE Number */}
                    <Card className="bg-slate-900 text-white border-slate-800">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Freedom Number</p>
                                <p className="text-4xl font-black text-white mb-1">{formatCurrency(fireMetrics.fireNumberCurrent)}</p>
                                <p className="text-slate-400 text-xs">Target corpus (25x Annual Spend)</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Personal Inflation</p>
                                <p className="text-2xl font-bold text-blue-400">{(fireMetrics.personalInflation * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                        {/* Progress Bar (Simulated) */}
                        <div className="mb-2">
                             <div className="flex justify-between text-xs text-slate-400 mb-1">
                                 <span>Accumulation Progress (Simulated)</span>
                                 <span>{Math.min(((netSavings / fireMetrics.fireNumberCurrent) * 100), 100).toFixed(1)}%</span>
                             </div>
                             <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(((netSavings / fireMetrics.fireNumberCurrent) * 100), 100)}%` }}></div>
                             </div>
                        </div>
                    </Card>

                    {/* Right: Timeline Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 5, 10, 15].map(year => (
                            <div key={year} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                                <span className="text-xs font-bold text-slate-400 uppercase">In {year} Year{year > 1 ? 's' : ''}</span>
                                <span className="font-bold text-slate-700">{formatCurrency(fireMetrics.yearsToFreedom[year])}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* NOTE: Removed Savings Trend Chart per feedback */}

                {/* Footer P1 */}
                <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                    <span>Generated by TrackSpendz AI</span>
                    <span>Page 1 / 3</span>
                </div>
            </div>

            {/* --- PAGE 2: TRENDS & VISUALS --- */}
            <div id="pdf-page-2" className="w-full h-[1123px] bg-white p-12 flex flex-col relative overflow-hidden break-before-page">
                <div className="mb-8 border-b border-slate-100 pb-4">
                    <h2 className="text-2xl font-black text-slate-800">Cash Flow & Trends</h2>
                </div>

                {/* 1. Monthly Bar Chart */}
                <div className="mb-10">
                    <h3 className="font-bold text-slate-700 mb-4">Monthly Income vs Expenses</h3>
                    <div className="h-[280px] w-full border border-slate-100 rounded-xl p-4 bg-white">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyData.slice(-12)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Legend />
                                <Bar dataKey="Income" fill={COLORS.income.medium} barSize={12} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                <Bar dataKey="Expense" fill={COLORS.expense.medium} barSize={12} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                <Line type="monotone" dataKey="Savings" stroke="#3b82f6" strokeWidth={2} dot={{r: 2}} isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Yearly Summary Table (Replaces Sparklines) */}
                <div className="mb-10">
                    <h3 className="font-bold text-slate-700 mb-4">Yearly Financial Summary</h3>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Year</th>
                                    <th className="py-3 px-4 text-right">Income</th>
                                    <th className="py-3 px-4 text-right">Expenses</th>
                                    <th className="py-3 px-4 text-right">Net Savings</th>
                                    <th className="py-3 px-4 text-right">Savings Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {yearlyData.map(row => {
                                    const net = row.income - row.expense;
                                    const rate = row.income > 0 ? (net / row.income) * 100 : 0;
                                    return (
                                        <tr key={row.year} className="hover:bg-slate-50">
                                            <td className="py-3 px-4 font-bold text-slate-700">{row.year}</td>
                                            <td className="py-3 px-4 text-right font-mono text-green-600">{formatCurrency(row.income)}</td>
                                            <td className="py-3 px-4 text-right font-mono text-red-600">{formatCurrency(row.expense)}</td>
                                            <td className={`py-3 px-4 text-right font-mono font-semibold ${net >= 0 ? 'text-slate-800' : 'text-orange-600'}`}>
                                                {formatCurrency(net)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium text-slate-600">{rate.toFixed(1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Donut Charts Row */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4 text-center">Expense Breakdown</h3>
                        <div className="h-[250px] relative border border-slate-100 rounded-xl bg-white">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={groupTopN(categoryData.expenses)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
                                        {groupTopN(categoryData.expenses).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.expense.palette[index % COLORS.expense.palette.length]} />)}
                                    </Pie>
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Total</span>
                                    <div className="font-bold text-slate-800">{formatCurrency(totalExpenses)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4 text-center">Income Sources</h3>
                        <div className="h-[250px] relative border border-slate-100 rounded-xl bg-white">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={groupTopN(categoryData.income, 4)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
                                        {groupTopN(categoryData.income, 4).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.income.palette[index % COLORS.income.palette.length]} />)}
                                    </Pie>
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Total</span>
                                    <div className="font-bold text-slate-800">{formatCurrency(totalIncome)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer P2 */}
                <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                    <span>Confidential</span>
                    <span>Page 2 / 3</span>
                </div>
            </div>

            {/* --- PAGE 3: DEEP DIVE & RECURRING --- */}
            <div id="pdf-page-3" className="w-full h-[1123px] bg-white p-12 flex flex-col relative overflow-hidden break-before-page">
                <div className="mb-8 border-b border-slate-100 pb-4">
                    <h2 className="text-2xl font-black text-slate-800">Deep Dive & Audit</h2>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Left: Top Expense Categories */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 overflow-hidden">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                             <div className="w-1.5 h-4 bg-red-500 rounded-full"></div>
                             Top 10 Categories
                        </h3>
                        <table className="w-full text-xs">
                            <thead className="text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="text-left py-2 font-semibold">Category</th>
                                    <th className="text-right py-2 font-semibold">Total</th>
                                    <th className="text-right py-2 font-semibold">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {categoryData.expenses.slice(0, 10).map((cat, i) => (
                                    <tr key={i}>
                                        <td className="py-3 font-medium text-slate-700">{cat.name}</td>
                                        <td className="py-3 text-right font-mono text-slate-600">{formatCurrency(cat.value)}</td>
                                        <td className="py-3 text-right text-slate-500">{((cat.value / totalExpenses) * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Right: Detected Recurring */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 overflow-hidden flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                             <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                             Recurring Bills (Detected)
                        </h3>
                         <div className="flex-1 overflow-hidden">
                            {recurring.length > 0 ? (
                                <table className="w-full text-xs">
                                    <thead className="text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left py-2 font-semibold">Name</th>
                                            <th className="text-left py-2 font-semibold">Freq</th>
                                            <th className="text-right py-2 font-semibold">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {recurring.slice(0, 10).map((rec, i) => (
                                            <tr key={i}>
                                                <td className="py-3 font-medium text-slate-700 truncate max-w-[80px]">{rec.name}</td>
                                                <td className="py-3 text-slate-500">~{rec.frequency}d</td>
                                                <td className="py-3 text-right font-mono text-slate-700">{formatCurrency(rec.avgAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <p>No recurring bills detected.</p>
                                </div>
                            )}
                         </div>
                    </div>
                </div>

                {/* NEW: BIG TICKET AUDIT */}
                <div className="mb-10">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                        Largest Single Transactions (Audit)
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bigTicketItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 text-slate-500">{item.date}</td>
                                        <td className="px-4 py-3 font-medium text-slate-700">{item.notes || item.subCategory}</td>
                                        <td className="px-4 py-3 text-slate-500">{item.category}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recommendations Box */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-8 mt-auto mb-6 shadow-lg">
                    <h3 className="text-lg font-bold mb-2">Strategic Conclusion</h3>
                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                        To accelerate your FIRE journey, focus on the top 3 categories which consume <strong className="text-white">{((categoryData.expenses.slice(0,3).reduce((s, c) => s+c.value, 0) / (totalExpenses || 1)) * 100).toFixed(0)}%</strong> of your budget. 
                        Your personal inflation is <strong className="text-white">{(fireMetrics.personalInflation * 100).toFixed(1)}%</strong>. 
                        Audit the large transactions listed above to see if they were one-offs or lifestyle creep.
                    </p>
                </div>

                {/* Footer P3 */}
                <div className="pt-6 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                    <span>Generated by TrackSpendz.com</span>
                    <span>End of Report</span>
                </div>
            </div>
        </div>
    );
};
