
export const Toast = ({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void }) => {
  const bg = type === 'error' ? 'bg-red-900 border-red-700' : type === 'info' ? 'bg-brand-900 border-brand-700' : 'bg-slate-900 border-slate-700';
  const dot = type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-brand-400' : 'bg-green-500';
  return (
  <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
    <div className={`text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 border ${bg}`}>
      <div className={`${dot} rounded-full p-1`}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
          {type === 'error'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : type === 'info'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />}
        </svg>
      </div>
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
  );
};

export const ErrorBoundaryFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="p-8 text-center">
    <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
    <p className="text-slate-600 dark:text-slate-400 mb-4">{error.message}</p>
    <button onClick={resetError} className="btn-primary">Try Again</button>
  </div>
);
