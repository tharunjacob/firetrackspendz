
import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { useCurrency } from '../Dashboard';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { COLORS, Icon } from '../constants';

const formatPercent = (value: number) => new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

// Helper: Group data into Top 5 + Others
const groupTopN = (data: {name: string, value: number}[], n: number = 5) => {
    if (data.length <= n) return data;
    const topN = data.slice(0, n);
    const others = data.slice(n).reduce((sum, item) => sum + item.value, 0);
    if (others > 0) {
        topN.push({ name: 'Others', value: others });
    }
    return topN;
};

// Helper: Get nice rounded ticks for axis
const getNiceTickValues = (maxValue: number, tickCount: number = 5) => {
    if (maxValue === 0) return [0];
    const step = Math.ceil(maxValue / tickCount);
    const power = Math.pow(10, Math.floor(Math.log10(step)));
    const niceStep = Math.ceil(step / power) * power;
    
    const ticks = [];
    for (let i = 0; i * niceStep <= maxValue * 1.1 || ticks.length < tickCount; i++) {
        ticks.push(i * niceStep);
        if (i * niceStep >= maxValue * 1.05) break; // Stop if we comfortably cover max
    }
    return ticks;
};

// Helper: Smart Domain Calculation (98th Percentile + Outlier Clipping)
const calculateSmartDomain = (dataValues: number[]) => {
    if (dataValues.length === 0) return { domain: [0, 'auto'], ticks: undefined };
    
    // Sort positive values
    const values = dataValues.filter(v => v > 0).sort((a,b) => a - b);
    
    let limitValue = 0;
    
    if (values.length < 5) {
        limitValue = values[values.length - 1] || 1000;
    } else {
        const absoluteMax = values[values.length - 1];
        
        // Calculate 98th Percentile (P98)
        const pIndex = Math.floor(values.length * 0.98); 
        const p98Value = values[pIndex];

        // Outlier Detection Logic:
        if (absoluteMax > p98Value * 1.25) {
            limitValue = p98Value * 1.25;
        } else {
            limitValue = absoluteMax;
        }
    }

    // Ensure we have a small buffer at top
    const ticks = getNiceTickValues(limitValue);
    const maxTick = ticks[ticks.length - 1];
    
    return { domain: [0, maxTick], ticks };
};

// Distinct Palette for Categories (Per column coloring)
const CATEGORY_PALETTE = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#6366f1', // Indigo
    '#d946ef', // Fuchsia
];

// Generic Tooltip for Bar/Line Charts
const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-200 text-sm z-50 max-w-xs">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1">
                         <span style={{ color: pld.fill || pld.stroke }} className="font-medium">{pld.name}</span>
                         <span className="font-mono text-slate-600">{formatCurrency(pld.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Rich Tooltip for Monthly Chart (Top 5 Categories)
const MonthlyTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const incomeTop = data.incomeBreakdown || [];
        const expenseTop = data.expenseBreakdown || [];
        
        return (
            <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-sm z-50 min-w-[280px]">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 text-base">{label}</p>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs font-bold text-green-600 mb-1 uppercase">Income (Top 5)</p>
                        <p className="font-mono font-bold mb-1">{formatCurrency(data.income)}</p>
                        {incomeTop.slice(0, 5).map((cat: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-slate-500">
                                <span className="truncate max-w-[100px]">{cat.name}</span>
                                <span>{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                    </div>
                    <div>
                         <p className="text-xs font-bold text-red-600 mb-1 uppercase">Expense (Top 5)</p>
                         <p className="font-mono font-bold mb-1">{formatCurrency(data.expenses)}</p>
                         {expenseTop.slice(0, 5).map((cat: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-slate-500">
                                <span className="truncate max-w-[100px]">{cat.name}</span>
                                <span>{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// Category Stacked Bar Tooltip
const CategoryStackedTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        const total = payload.reduce((acc: number, p: any) => acc + (p.value || 0), 0);
        return (
            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-200 text-sm z-50 max-w-xs">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                <div className="flex justify-between mb-2 font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                </div>
                <div className="space-y-1">
                    {payload.map((pld: any, index: number) => {
                        const realName = pld.payload[`subName${pld.dataKey.replace('sub', '')}`];
                        if (!realName) return null;
                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <span style={{ color: pld.fill }} className="font-medium text-xs">{realName}</span>
                                <span className="font-mono text-slate-600 text-xs">{formatCurrency(pld.value)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};


// Yearly Tooltip with Subcategory Breakdown
const YearlyTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-sm z-50 min-w-[200px]">
                <p className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-1 text-base">{label}</p>
                {payload.map((pld: any, index: number) => {
                    const breakdown = pld.payload[pld.dataKey === 'income' ? 'incomeBreakdown' : 'expenseBreakdown'] || [];
                    return (
                        <div key={index} className="mb-4 last:mb-0">
                             <div className="flex items-center justify-between gap-4 mb-2">
                                <span style={{ color: pld.fill }} className="font-bold text-base">{pld.name} Total</span>
                                <span className="font-mono font-bold text-slate-700">{formatCurrency(pld.value)}</span>
                             </div>
                             {breakdown.length > 0 && (
                                 <div className="pl-2 border-l-2 border-slate-100 space-y-1">
                                     <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Top Categories</p>
                                     {breakdown.slice(0, 5).map((item: any, i: number) => (
                                         <div key={i} className="flex justify-between text-xs text-slate-600">
                                             <span>{item.name}</span>
                                             <span>{formatCurrency(item.value)}</span>
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

// Specific Tooltip for Donut Charts
const DonutTooltip = ({ active, payload, formatCurrency, total }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        const percent = total > 0 ? (data.value / total) : 0;

        return (
            <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-sm z-50 min-w-[180px]">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.fill }}></div>
                    <p className="font-bold text-slate-800 text-base">{data.name}</p>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Amount:</span>
                        <span className="font-mono font-semibold text-slate-700">{formatCurrency(data.value)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Percentage:</span>
                        <span className="font-mono font-semibold text-blue-600">{formatPercent(percent)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const DonutChartCard = ({ title, data, colors, formatCurrency }: { title: string, data: {name: string, value: number}[], colors: string[], formatCurrency: (v:number) => string }) => {
    const groupedData = useMemo(() => groupTopN(data, 5), [data]);
    const total = useMemo(() => data.reduce((sum, entry) => sum + entry.value, 0), [data]);
    
    const chartData = useMemo(() => groupedData.map((entry, index) => ({
        ...entry,
        fill: colors[index % colors.length]
    })), [groupedData, colors]);

    if (data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col items-center justify-center min-h-[400px]">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">{title}</h3>
                 <p className="text-slate-500">No data available.</p>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">{title}</h3>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 items-center h-[350px]">
                {/* Chart Section (2/3 width on desktop, full on mobile) */}
                <div className="col-span-1 md:col-span-2 h-full relative min-h-[250px]">
                    {/* Absolute Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl sm:text-2xl font-bold text-slate-800">{formatCurrency(total)}</span>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={chartData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius="60%" 
                                outerRadius="80%" 
                                paddingAngle={2}
                            >
                                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />)}
                            </Pie>
                            <Tooltip content={<DonutTooltip formatCurrency={formatCurrency} total={total} />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Custom Legend Section (Right Side on desktop, below on mobile) */}
                <div className="col-span-1 md:col-span-1 flex flex-row md:flex-col flex-wrap md:flex-nowrap justify-center gap-3 pl-0 md:pl-4 md:border-l border-slate-100 h-auto md:h-full overflow-y-auto custom-scrollbar pt-4 md:pt-0">
                    {chartData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm w-full sm:w-auto md:w-full">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.fill }}></div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-medium text-slate-700 truncate" title={entry.name}>{entry.name}</span>
                                <span className="text-xs text-slate-500 font-mono">{formatCurrency(entry.value)} ({formatPercent(entry.value/total)})</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
};

const SummaryTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const categoryData = useMemo(() => {
        const incomeMap = new Map<string, number>();
        const expenseMap = new Map<string, number>();
        data.forEach(t => {
            if (t.type === 'Income') {
                incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + t.amount);
            } else if (t.type === 'Expense') {
                expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + t.amount);
            }
        });
        const income = Array.from(incomeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        const expense = Array.from(expenseMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        return { income, expense };
    }, [data]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DonutChartCard title="Income Sources" data={categoryData.income} colors={COLORS.income.palette} formatCurrency={formatCurrency} />
            <DonutChartCard title="Top Expense Categories" data={categoryData.expense} colors={COLORS.expense.palette} formatCurrency={formatCurrency} />
        </div>
    );
};

const YearlyAnalysisTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    
    const yearlyData = useMemo(() => {
        const yearMap = new Map<number, { income: number, expenses: number, incomeBreakdown: any[], expenseBreakdown: any[] }>();
        const breakdownMap = new Map<number, { income: Map<string, number>, expenses: Map<string, number> }>();

        data.forEach(t => {
            const year = new Date(t.date + 'T00:00:00').getFullYear();
            if (!yearMap.has(year)) {
                yearMap.set(year, { income: 0, expenses: 0, incomeBreakdown: [], expenseBreakdown: [] });
                breakdownMap.set(year, { income: new Map(), expenses: new Map() });
            }
            
            const yearTotals = yearMap.get(year)!;
            const yearBreakdown = breakdownMap.get(year)!;

            if (t.type === 'Income') {
                yearTotals.income += t.amount;
                yearBreakdown.income.set(t.category, (yearBreakdown.income.get(t.category) || 0) + t.amount);
            } else if (t.type === 'Expense') {
                yearTotals.expenses += t.amount;
                yearBreakdown.expenses.set(t.category, (yearBreakdown.expenses.get(t.category) || 0) + t.amount);
            }
        });

        return Array.from(yearMap.entries())
            .map(([year, totals]) => {
                const breakdowns = breakdownMap.get(year)!;
                const getTop5 = (map: Map<string, number>) => Array.from(map.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);

                return { 
                    year: year.toString(), 
                    ...totals,
                    incomeBreakdown: getTop5(breakdowns.income),
                    expenseBreakdown: getTop5(breakdowns.expenses)
                };
            })
            .sort((a, b) => parseInt(a.year) - parseInt(b.year));
    }, [data]);
    
    const tableData = useMemo(() => yearlyData.map(y => ({
        ...y,
        net: y.income - y.expenses,
        savingsRate: y.income > 0 ? (y.income - y.expenses) / y.income : 0
    })).reverse(), [yearlyData]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Yearly Income vs. Expenses</h3>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                        <BarChart data={yearlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
                            <YAxis tickFormatter={formatCurrency} tick={{ fill: '#475569', fontSize: 12 }} />
                            <Tooltip content={<YearlyTooltip formatCurrency={formatCurrency} />} />
                            <Legend />
                            <Bar dataKey="income" fill={COLORS.income.dark} name="Income" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expenses" fill={COLORS.expense.dark} name="Expenses" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Yearly Summary</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Year</th>
                                <th scope="col" className="px-6 py-3 text-right">Income</th>
                                <th scope="col" className="px-6 py-3 text-right">Expenses</th>
                                <th scope="col" className="px-6 py-3 text-right">Net Savings</th>
                                <th scope="col" className="px-6 py-3 text-right">Savings Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map(row => (
                                <tr key={row.year} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{row.year}</td>
                                    <td className="px-6 py-4 text-right text-green-600">{formatCurrency(row.income)}</td>
                                    <td className="px-6 py-4 text-right text-red-600">{formatCurrency(row.expenses)}</td>
                                    <td className={`px-6 py-4 text-right font-semibold ${row.net >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatCurrency(row.net)}</td>
                                    <td className="px-6 py-4 text-right">{formatPercent(row.savingsRate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const MonthlyAnalysisTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const monthlyData = useMemo(() => {
        const monthMap = new Map<string, { income: number, expenses: number, date: Date, label: string, incomeBreakdown: any[], expenseBreakdown: any[] }>();
        const breakdownMap = new Map<string, { income: Map<string, number>, expenses: Map<string, number> }>();

        data.forEach(t => {
            const date = new Date(t.date + 'T00:00:00');
            date.setDate(1); 
            const key = `${date.getFullYear()}-${date.getMonth()}`; 
            const label = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
            
            if (!monthMap.has(key)) {
                 monthMap.set(key, { income: 0, expenses: 0, date: date, label: label, incomeBreakdown: [], expenseBreakdown: [] });
                 breakdownMap.set(key, { income: new Map(), expenses: new Map() });
            }

            const monthTotals = monthMap.get(key)!;
            const monthBD = breakdownMap.get(key)!;

            if (t.type === 'Income') {
                monthTotals.income += t.amount;
                monthBD.income.set(t.category, (monthBD.income.get(t.category) || 0) + t.amount);
            } else if (t.type === 'Expense') {
                monthTotals.expenses += t.amount;
                monthBD.expenses.set(t.category, (monthBD.expenses.get(t.category) || 0) + t.amount);
            }
        });

        return Array.from(monthMap.values())
            .map(m => {
                const key = `${m.date.getFullYear()}-${m.date.getMonth()}`;
                const bd = breakdownMap.get(key)!;
                const getTop = (map: Map<string, number>) => Array.from(map.entries()).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value);
                return { ...m, incomeBreakdown: getTop(bd.income), expenseBreakdown: getTop(bd.expenses) };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());

    }, [data]);

    // Smart Scaling: 98th Percentile Rule
    const { domain, ticks } = useMemo(() => {
        const values = monthlyData.flatMap(d => [d.income, d.expenses]);
        return calculateSmartDomain(values);
    }, [monthlyData]);

    // Scroll to end on load
    useEffect(() => {
        setTimeout(() => {
             if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, 300);
    }, [monthlyData]);
    
    const tableData = useMemo(() => monthlyData.map(y => ({
        ...y,
        net: y.income - y.expenses,
        savingsRate: y.income > 0 ? (y.income - y.expenses) / y.income : 0
    })).reverse(), [monthlyData]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Monthly Income vs. Expenses</h3>
                {/* Responsive height container */}
                <div className="flex h-[400px] md:h-[500px] border border-slate-100 rounded-lg overflow-hidden">
                     {/* Fixed Left Y-Axis Pane */}
                     <div className="w-[80px] md:w-[100px] h-full bg-white z-10 border-r border-slate-100 shadow-sm relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} layout="horizontal" margin={{ top: 20, bottom: 40 }}>
                                <YAxis 
                                    tickFormatter={formatCurrency} 
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                                    width={80} 
                                    axisLine={false}
                                    tickLine={false}
                                    domain={domain as any}
                                    ticks={ticks}
                                    allowDataOverflow={true} 
                                />
                                <XAxis dataKey="label" hide />
                                {/* Dummy bars to force correct axis scaling without rendering content */}
                                <Bar dataKey="income" fill="transparent" isAnimationActive={false} />
                                <Bar dataKey="expenses" fill="transparent" isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                     </div>

                     {/* Scrollable Right Content Pane */}
                     <div className="flex-1 overflow-x-auto custom-scrollbar relative" ref={scrollContainerRef}>
                         {/* Minimum width ensures bars aren't squashed on mobile */}
                         <div style={{ width: `${Math.max(monthlyData.length * 60, 600)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="label" 
                                        tick={{ fill: '#64748b', fontSize: 12 }} 
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0} 
                                        height={40}
                                    />
                                    <YAxis hide domain={domain as any} ticks={ticks} allowDataOverflow={true} />
                                    <Tooltip content={<MonthlyTooltip formatCurrency={formatCurrency} />} cursor={{fill: '#f8fafc'}} />
                                    <Legend verticalAlign="top" align="right" iconType="circle"/>
                                    <Bar dataKey="income" fill={COLORS.income.dark} name="Income" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="expenses" fill={COLORS.expense.dark} name="Expenses" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                     </div>
                </div>
            </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Monthly Summary</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                             <tr>
                                <th scope="col" className="px-6 py-3">Month</th>
                                <th scope="col" className="px-6 py-3 text-right">Income</th>
                                <th scope="col" className="px-6 py-3 text-right">Expenses</th>
                                <th scope="col" className="px-6 py-3 text-right">Net Savings</th>
                                <th scope="col" className="px-6 py-3 text-right">Savings Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map(row => (
                                <tr key={row.label} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{row.label}</td>
                                    <td className="px-6 py-4 text-right text-green-600">{formatCurrency(row.income)}</td>
                                    <td className="px-6 py-4 text-right text-red-600">{formatCurrency(row.expenses)}</td>
                                    <td className={`px-6 py-4 text-right font-semibold ${row.net >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatCurrency(row.net)}</td>
                                    <td className="px-6 py-4 text-right">{formatPercent(row.savingsRate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const CategoryBreakdownTable = ({ data, type, selectedYear, formatCurrency }: { data: Transaction[], type: TransactionType, selectedYear: number | 'all', formatCurrency: (v: number) => string }) => {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const months = useMemo(() => {
        let targetDate = new Date();
        if (selectedYear !== 'all') {
             const now = new Date();
             if (selectedYear === now.getFullYear()) targetDate = now;
             else targetDate = new Date(selectedYear, 11, 31);
        } else {
             const maxDateStr = data.reduce((max, t) => t.date > max ? t.date : max, new Date().toISOString());
             targetDate = new Date(maxDateStr);
        }
        
        const result = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date(targetDate);
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            if (selectedYear !== 'all' && d.getFullYear() !== selectedYear) continue;
            result.push({
                key: `${d.getFullYear()}-${d.getMonth()}`,
                label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                date: d
            });
        }
        return result;
    }, [selectedYear, data]);

    const processedData = useMemo(() => {
        const yearlyTotalMap = new Map<string, number>();
        const monthlyMaps = months.map(() => new Map<string, number>());
        const subCatMap = new Map<string, Map<string, { total: number, months: number[] }>>();
        
        const filtered = data.filter(t => 
            t.type === type && 
            (selectedYear === 'all' || new Date(t.date).getFullYear() === selectedYear)
        );

        const rolling12Total = new Map<string, number>();
        const rollingDateCutoff = new Date();
        rollingDateCutoff.setMonth(rollingDateCutoff.getMonth() - 12);

        filtered.forEach(t => {
            yearlyTotalMap.set(t.category, (yearlyTotalMap.get(t.category) || 0) + t.amount);

            const tDate = new Date(t.date);
            const tKey = `${tDate.getFullYear()}-${tDate.getMonth()}`;
            const monthIdx = months.findIndex(m => m.key === tKey);
            if (monthIdx !== -1) {
                monthlyMaps[monthIdx].set(t.category, (monthlyMaps[monthIdx].get(t.category) || 0) + t.amount);
            }

            if (!subCatMap.has(t.category)) subCatMap.set(t.category, new Map());
            const subs = subCatMap.get(t.category)!;
            if (!subs.has(t.subCategory)) subs.set(t.subCategory, { total: 0, months: new Array(months.length).fill(0) });
            
            const subData = subs.get(t.subCategory)!;
            subData.total += t.amount;
            if (monthIdx !== -1) subData.months[monthIdx] += t.amount;
        });

        data.filter(t => t.type === type).forEach(t => {
            const d = new Date(t.date);
            if (d >= rollingDateCutoff) {
                 rolling12Total.set(t.category, (rolling12Total.get(t.category) || 0) + t.amount);
            }
        });

        return Array.from(yearlyTotalMap.keys()).map(cat => {
            return {
                name: cat,
                total: yearlyTotalMap.get(cat) || 0,
                months: monthlyMaps.map(m => m.get(cat) || 0),
                avg12m: (rolling12Total.get(cat) || 0) / 12,
                subs: Array.from(subCatMap.get(cat)!.entries()).map(([subName, val]) => ({
                    name: subName,
                    total: val.total, 
                    months: val.months
                })).sort((a, b) => b.total - a.total)
            };
        }).sort((a, b) => b.total - a.total);

    }, [data, type, selectedYear, months]);

    if (processedData.length === 0) return <div className="text-center text-slate-500 p-8">No data available.</div>;

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                        <th className="px-6 py-4">Category / Subcategory</th>
                        <th className="px-6 py-4 text-right">Yearly Total</th>
                        {months.map(m => <th key={m.key} className="px-6 py-4 text-right">{m.label}</th>)}
                        <th className="px-6 py-4 text-right">12M Avg</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {processedData.map(cat => (
                        <React.Fragment key={cat.name}>
                            <tr 
                                className="bg-white hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100" 
                                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                            >
                                <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-2">
                                    <span className={`inline-block w-4 transition-transform text-slate-400 ${expandedCategory === cat.name ? 'rotate-90' : ''}`}>▶</span>
                                    {cat.name}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-medium">{formatCurrency(cat.total)}</td>
                                {cat.months.map((v, i) => <td key={i} className="px-6 py-4 text-right font-mono text-slate-600">{formatCurrency(v)}</td>)}
                                <td className="px-6 py-4 text-right font-mono text-slate-500">{formatCurrency(cat.avg12m)}</td>
                            </tr>
                            {expandedCategory === cat.name && cat.subs.map(sub => (
                                <tr key={sub.name} className="bg-slate-50/50 text-xs border-b border-slate-100">
                                    <td className="pl-14 py-3 text-slate-600">{sub.name}</td>
                                    <td className="px-6 py-3 text-right text-slate-500">{formatCurrency(sub.total)}</td>
                                    {sub.months.map((v, i) => <td key={i} className="px-6 py-3 text-right text-slate-500">{formatCurrency(v)}</td>)}
                                    <td className="px-6 py-3 text-right text-slate-400">-</td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    )
};

const CategoriesAnalysisTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const years = useMemo(() => [...new Set(data.map(t => new Date(t.date + 'T00:00:00').getFullYear()))].sort((a, b) => b - a), [data]);

    const [selectedYear, setSelectedYear] = useState<number | 'all'>(years[0] || 'all');
    const [selectedType, setSelectedType] = useState<TransactionType>('Expense');

    const filteredData = useMemo(() => {
        return data.filter(t => {
            const yearMatch = selectedYear === 'all' || new Date(t.date + 'T00:00:00').getFullYear() === selectedYear;
            return yearMatch && t.type === selectedType;
        });
    }, [data, selectedYear, selectedType]);

    // Cluster Monochrome Stacking
    const chartData = useMemo(() => {
        const categoryMap = new Map<string, { value: number, subBreakdown: Record<string, number> }>();
        
        filteredData.forEach(t => {
            if (!categoryMap.has(t.category)) categoryMap.set(t.category, { value: 0, subBreakdown: {} });
            const cat = categoryMap.get(t.category)!;
            cat.value += t.amount;
            cat.subBreakdown[t.subCategory] = (cat.subBreakdown[t.subCategory] || 0) + t.amount;
        });

        const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1].value - a[1].value);

        return sortedCategories.map(([name, data], catIndex) => {
            const sortedSubs = Object.entries(data.subBreakdown).sort((a, b) => b[1] - a[1]);
            const item: any = { name, value: data.value };
            
            const baseColor = CATEGORY_PALETTE[catIndex % CATEGORY_PALETTE.length];

            sortedSubs.slice(0, 5).forEach(([subName, val], i) => {
                item[`sub${i}`] = val;
                item[`subName${i}`] = subName;
                item[`subColor${i}`] = baseColor;
                item[`subOpacity${i}`] = Math.max(0.3, 1 - (i * 0.15)); 
            });
            
            const others = sortedSubs.slice(5).reduce((sum, curr) => sum + curr[1], 0);
            if (others > 0) {
                item['sub5'] = others;
                item['subName5'] = 'Others';
                item[`subColor5`] = baseColor;
                item[`subOpacity5`] = 0.2;
            }
            return item;
        });
    }, [filteredData]);
    
    const colors = selectedType === 'Income' ? COLORS.income.palette : COLORS.expense.palette;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-200">
                 <h3 className="text-lg font-bold text-slate-800">Categories Analysis</h3>
                 <div className="flex items-center gap-4">
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500">
                        <option value="all">All Time</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value as TransactionType)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500">
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                    </select>
                 </div>
            </div>
            
            {chartData.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 h-[500px]">
                        <div className="xl:col-span-3 h-full">
                            <h4 className="text-sm font-semibold text-slate-500 mb-4 text-center uppercase tracking-wide">{selectedType} Distribution (Stacked)</h4>
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: '#475569', fontSize: 12 }} />
                                    <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#475569', fontSize: 12 }} interval={0} />
                                    <Tooltip content={<CategoryStackedTooltip formatCurrency={formatCurrency} />} cursor={{fill: '#f1f5f9'}} />
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <Bar key={i} dataKey={`sub${i}`} stackId="a">
                                            {chartData.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}-${i}`} 
                                                    fill={entry[`subColor${i}`]} 
                                                    fillOpacity={entry[`subOpacity${i}`]} 
                                                />
                                            ))}
                                        </Bar>
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="xl:col-span-2 h-full">
                            <DonutChartCard 
                                title={`${selectedType} Breakdown`} 
                                data={chartData.map((d, i) => ({...d, fill: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}))} 
                                colors={CATEGORY_PALETTE} 
                                formatCurrency={formatCurrency} 
                            />
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <h4 className="text-lg font-bold text-slate-800 mb-6">Category Breakdown ({selectedYear === 'all' ? 'Last 3 Active Months' : selectedYear})</h4>
                        <CategoryBreakdownTable data={data} type={selectedType} selectedYear={selectedYear} formatCurrency={formatCurrency} />
                    </div>
                </>
            ) : <p className="text-center text-slate-500 py-16">No data available.</p>}
        </div>
    );
};

const CategoryTrendChart = ({ data, type, formatCurrency }: { data: Transaction[], type: TransactionType, formatCurrency: (v: number) => string }) => {
    const { yearlyData, topCategories } = useMemo(() => {
        const years = [...new Set(data.map(t => new Date(t.date + 'T00:00:00').getFullYear()))].sort();
        const catTotals = new Map<string, number>();
        data.filter(t => t.type === type).forEach(t => {
            catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.amount);
        });
        const topCats = Array.from(catTotals.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5).map(c => c[0]);
        
        const yearly = years.map(year => {
            const yearData: { [key: string]: string | number } = { year: year.toString() };
            let otherTotal = 0;
            data.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === year && t.type === type)
                .forEach(t => {
                    if (topCats.includes(t.category)) yearData[t.category] = ((yearData[t.category] as number) || 0) + t.amount;
                    else otherTotal += t.amount;
                });
            yearData['Others'] = otherTotal;
            return yearData;
        });
        return { yearlyData: yearly, topCategories: [...topCats, 'Others'] };
    }, [data, type]);
    
    const colors = type === 'Income' ? COLORS.income.palette : COLORS.expense.palette;

    const { domain } = useMemo(() => {
        const values = yearlyData.map(y => {
             let sum = 0;
             topCategories.forEach(c => sum += (y[c] as number || 0));
             return sum;
         });
         return calculateSmartDomain(values);
    }, [yearlyData, topCategories]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{type} Trends (Top 5 + Others)</h3>
            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                    <BarChart data={yearlyData} margin={{top: 5, right: 20, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
                        <YAxis tickFormatter={formatCurrency} tick={{ fill: '#475569', fontSize: 12 }} domain={domain as any} allowDataOverflow={true} />
                        <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                        <Legend />
                        {topCategories.map((cat, i) => (
                            <Bar key={cat} dataKey={cat} stackId="a" name={cat} fill={colors[i % colors.length]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

const TrendsTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const trendData = useMemo(() => {
        const trendMap = new Map<string, { income: number, expenses: number, date: Date }>();
        data.forEach(t => {
            const date = new Date(t.date + 'T00:00:00');
            date.setDate(1);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!trendMap.has(monthKey)) trendMap.set(monthKey, { income: 0, expenses: 0, date });
            const monthTotals = trendMap.get(monthKey)!;
            if (t.type === 'Income') monthTotals.income += t.amount;
            else if (t.type === 'Expense') monthTotals.expenses += t.amount;
        });
        const result = Array.from(trendMap.values()).sort((a,b) => a.date.getTime() - b.date.getTime());
        return result.map(d => ({...d, month: `${d.date.toLocaleString('default', {month: 'short'})} '${d.date.getFullYear().toString().slice(2)}`}));
    }, [data]);
    
    const { domain } = useMemo(() => {
         const values = trendData.flatMap(d => [d.income, d.expenses]);
         return calculateSmartDomain(values);
    }, [trendData]);

    return (
        <div className="space-y-6">
             <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Overall Income vs Expense Trends</h3>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }}/>
                            <YAxis tickFormatter={formatCurrency} tick={{ fill: '#475569', fontSize: 12 }} domain={domain as any} allowDataOverflow={true}/>
                            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency}/>}/>
                            <Legend />
                            <Line type="monotone" dataKey="income" name="Income" stroke={COLORS.income.dark} strokeWidth={2} dot={{r: 2}} activeDot={{r: 6}} />
                            <Line type="monotone" dataKey="expenses" name="Expenses" stroke={COLORS.expense.dark} strokeWidth={2} dot={{r: 2}} activeDot={{r: 6}}/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryTrendChart data={data} type="Income" formatCurrency={formatCurrency} />
                <CategoryTrendChart data={data} type="Expense" formatCurrency={formatCurrency} />
            </div>
        </div>
    );
};

const CompareTab = ({ data }: { data: Transaction[] }) => {
    const { formatCurrency } = useCurrency();
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const { years, months } = useMemo(() => {
        const yearSet = new Set<number>();
        const monthSet = new Set<string>();
        data.forEach(t => {
            const date = new Date(t.date + 'T00:00:00');
            yearSet.add(date.getFullYear());
            monthSet.add(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
        });
        return { years: Array.from(yearSet).sort((a, b) => b - a), months: Array.from(monthSet).sort((a, b) => b.localeCompare(a)), };
    }, [data]);

    const [periodType, setPeriodType] = useState<'Yearly' | 'Monthly'>('Yearly');
    const options = periodType === 'Yearly' ? years.map(y => String(y)) : months;
    const [period1, setPeriod1] = useState<string>(options.length > 1 ? options[1] : '');
    const [period2, setPeriod2] = useState<string>(options.length > 0 ? options[0] : '');

    const comparisonData = useMemo(() => {
        if (!period1 || !period2) return null;
        type CategoryData = { total: number; subCategories: Record<string, number> };
        const getPeriodData = (period: string) => {
            const filtered = data.filter(t => {
                const date = new Date(t.date + 'T00:00:00');
                if (periodType === 'Yearly') return date.getFullYear().toString() === period;
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}` === period;
            });
            const process = (type: TransactionType) => {
                const catMap = new Map<string, CategoryData>();
                filtered.filter(t => t.type === type).forEach(t => {
                    if (!catMap.has(t.category)) catMap.set(t.category, { total: 0, subCategories: {} });
                    const catData = catMap.get(t.category)!;
                    catData.total += t.amount;
                    catData.subCategories[t.subCategory] = (catData.subCategories[t.subCategory] || 0) + t.amount;
                });
                return Object.fromEntries(catMap);
            };
            return { 
                totalIncome: filtered.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0),
                totalExpenses: filtered.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
                incomeCats: process('Income'), 
                expenseCats: process('Expense') 
            };
        };
        return { data1: getPeriodData(period1), data2: getPeriodData(period2) };
    }, [data, periodType, period1, period2]);

    const formatLabel = (value: string) => {
        if (!value) return '';
        if (periodType === 'Yearly') return value;
        try {
            const [y, m] = value.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1);
            return `${date.toLocaleString('default', { month: 'short' })} '${y.slice(2)}`;
        } catch (e) {
            return value;
        }
    };

    const ChangeIndicator = ({ current, prev, type }: { current: number, prev: number, type: 'income' | 'expense' }) => {
        if (prev === 0 && current === 0) return <span className="text-gray-400">-</span>;
        if (prev === 0) return <span className="text-slate-500 font-bold">New</span>;
        const change = (current - prev) / Math.abs(prev);
        const isIncrease = change > 0;
        let color = 'text-slate-600';
        if (type === 'income') color = isIncrease ? 'text-green-600' : 'text-red-600';
        else color = isIncrease ? 'text-red-600' : 'text-green-600';
        return <span className={`font-bold ${color}`}>{isIncrease ? '▲' : '▼'} {formatPercent(Math.abs(change))}</span>;
    };
    
    const ComparisonTable = ({ title, cats1, cats2, type }: { title: string, cats1: Record<string, any>, cats2: Record<string, any>, type: 'income' | 'expense' }) => {
        const allCats = [...new Set([...Object.keys(cats1), ...Object.keys(cats2)])];
        const toggleCategory = (cat: string) => setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

        return (
            <>
                <tr className="bg-slate-100"><td colSpan={4} className="px-6 py-3 font-bold text-slate-700 border-b border-slate-200">{title}</td></tr>
                {allCats.map(cat => {
                    const data1 = cats1[cat] || { total: 0, subCategories: {} };
                    const data2 = cats2[cat] || { total: 0, subCategories: {} };
                    const isExpanded = expandedCategories.includes(cat);
                    const hasSubcats = Object.keys(data1.subCategories).length > 0 || Object.keys(data2.subCategories).length > 0;
                    return (
                        <React.Fragment key={cat}>
                            <tr className="bg-white border-b hover:bg-slate-50 transition-colors" onClick={() => hasSubcats && toggleCategory(cat)} style={{ cursor: hasSubcats ? 'pointer' : 'default' }}>
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    {hasSubcats && <span className={`inline-block w-4 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9656;</span>}
                                    {cat}
                                </td>
                                <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(data1.total)}</td>
                                <td className="px-6 py-3 text-right text-slate-600 font-semibold">{formatCurrency(data2.total)}</td>
                                <td className="px-6 py-3 text-right"><ChangeIndicator current={data2.total} prev={data1.total} type={type} /></td>
                            </tr>
                            {isExpanded && Object.keys({...data1.subCategories, ...data2.subCategories}).map(subCat => {
                                const v1 = data1.subCategories[subCat] || 0;
                                const v2 = data2.subCategories[subCat] || 0;
                                return (
                                <tr key={`${cat}-${subCat}`} className="bg-slate-50 border-b text-slate-500 text-xs">
                                    <td className="pl-14 py-2">{subCat || '(Unspecified)'}</td>
                                    <td className="py-2 text-right px-6">{formatCurrency(v1)}</td>
                                    <td className="py-2 text-right px-6">{formatCurrency(v2)}</td>
                                    <td className="py-2 text-right px-6"><ChangeIndicator current={v2} prev={v1} type={type} /></td>
                                </tr>
                                )
                            })}
                        </React.Fragment>
                    );
                })}
            </>
        )
    };
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-800">Comparison Analysis</h3>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    <select value={periodType} onChange={e => { 
                        const newType = e.target.value as 'Yearly' | 'Monthly';
                        setPeriodType(newType);
                        const newOptions = newType === 'Yearly' ? years.map(String) : months;
                        setPeriod1(newOptions.length > 1 ? newOptions[1] : '');
                        setPeriod2(newOptions.length > 0 ? newOptions[0] : '');
                        setExpandedCategories([]);
                    }} className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Yearly</option>
                        <option>Monthly</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center justify-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <select value={period1} onChange={e => setPeriod1(e.target.value)} className="px-4 py-2 bg-white border border-blue-200 rounded-lg font-medium text-slate-700 shadow-sm">
                    {options.map(o => <option key={`p1-${o}`} value={o}>{formatLabel(o)}</option>)}
                </select>
                <span className="text-blue-400 font-bold text-xl">VS</span>
                <select value={period2} onChange={e => setPeriod2(e.target.value)} className="px-4 py-2 bg-white border border-blue-200 rounded-lg font-medium text-slate-700 shadow-sm">
                    {options.map(o => <option key={`p2-${o}`} value={o}>{formatLabel(o)}</option>)}
                </select>
            </div>
            {comparisonData && <div className="overflow-hidden rounded-xl border border-slate-200">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Metric / Category</th>
                            <th className="px-6 py-4 text-right font-semibold">{formatLabel(period1)}</th>
                            <th className="px-6 py-4 text-right font-semibold">{formatLabel(period2)}</th>
                            <th className="px-6 py-4 text-right font-semibold">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white border-b">
                            <td className="px-6 py-4 font-bold text-slate-700">Total Income</td>
                            <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(comparisonData.data1.totalIncome)}</td>
                            <td className="px-6 py-4 text-right text-slate-800 font-bold">{formatCurrency(comparisonData.data2.totalIncome)}</td>
                            <td className="px-6 py-4 text-right"><ChangeIndicator current={comparisonData.data2.totalIncome} prev={comparisonData.data1.totalIncome} type="income" /></td>
                        </tr>
                        <tr className="bg-white border-b">
                            <td className="px-6 py-4 font-bold text-slate-700">Total Expenses</td>
                            <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(comparisonData.data1.totalExpenses)}</td>
                            <td className="px-6 py-4 text-right text-slate-800 font-bold">{formatCurrency(comparisonData.data2.totalExpenses)}</td>
                            <td className="px-6 py-4 text-right"><ChangeIndicator current={comparisonData.data2.totalExpenses} prev={comparisonData.data1.totalExpenses} type="expense" /></td>
                        </tr>
                        <ComparisonTable title="Income Categories" cats1={comparisonData.data1.incomeCats} cats2={comparisonData.data2.incomeCats} type="income" />
                        <ComparisonTable title="Expense Categories" cats1={comparisonData.data1.expenseCats} cats2={comparisonData.data2.expenseCats} type="expense" />
                    </tbody>
                </table>
            </div>}
        </div>
    );
};

const SummaryViews = ({ activeTab, data }: { activeTab: string, data: Transaction[] }) => {
    switch (activeTab) {
        case 'Summary': return <SummaryTab data={data} />;
        case 'Yearly Analysis': return <YearlyAnalysisTab data={data} />;
        case 'Monthly Analysis': return <MonthlyAnalysisTab data={data} />;
        case 'Categories Analysis': return <CategoriesAnalysisTab data={data} />;
        case 'Trends': return <TrendsTab data={data} />;
        case 'Compare': return <CompareTab data={data} />;
        default: return <div className="bg-white p-6 rounded-2xl shadow-sm text-slate-500">Select a view</div>;
    }
};

export default SummaryViews;
