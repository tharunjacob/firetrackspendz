interface Props {
  selectedYear: number;
  availableYears: number[];
  onSelectYear: (year: number) => void;
}

export const WrappedIntro = ({ selectedYear, availableYears, onSelectYear }: Props) => (
  <div className="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Year in Review</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your financial wrapped for {selectedYear}</p>
    </div>
    <select
      value={selectedYear}
      onChange={e => onSelectYear(Number(e.target.value))}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {availableYears.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>
);

export const WrappedEmpty = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-indigo-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    </div>
    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Transaction Data</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
      Upload your bank statements to see your financial year in review.
    </p>
  </div>
);
