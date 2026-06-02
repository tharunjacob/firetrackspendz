import type { UserProfile } from '@/types';

interface UserDetail extends UserProfile {
  transactionCount?: number;
}

interface Props {
  users: UserDetail[];
  mimicEmail: string;
  setMimicEmail: (email: string) => void;
  startMimic: () => void;
}

export const MimicTab = ({ users, mimicEmail, setMimicEmail, startMimic }: Props) => {
  const targetUser = users.find(u => u.email?.toLowerCase() === mimicEmail.toLowerCase());

  return (
    <div className="max-w-lg space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-700 mb-2">Mimic User Session</h3>
        <p className="text-sm text-slate-500 mb-4">
          Opens a read-only view of the target user's dashboard for debugging.
          No modifications can be made to their data.
        </p>
        <div className="flex gap-2">
          <input
            type="email" value={mimicEmail} onChange={e => setMimicEmail(e.target.value)}
            placeholder="user@example.com"
            className="input-field flex-1"
            list="user-emails-list"
          />
          <datalist id="user-emails-list">
            {users.map(u => <option key={u.id} value={u.email || ''} />)}
          </datalist>
          <button onClick={startMimic} className="btn-primary px-6">Mimic</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Mimic mode is read-only. Target user's data loads in a new browser tab.
        </p>

        {/* Context card when a matching user is found */}
        {targetUser && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-bold text-amber-700 uppercase mb-2">Target User Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center font-bold">
                {(targetUser.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{targetUser.email}</p>
                <p className="text-xs text-slate-500">
                  {targetUser.full_name || 'No name'} · Plan: <strong>{targetUser.subscription_plan || 'free'}</strong>
                  {targetUser.transactionCount !== undefined && ` · ${targetUser.transactionCount} txns`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick pick */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 mb-2">Quick pick:</p>
          <div className="flex flex-wrap gap-2">
            {users.slice(0, 8).map(u => (
              <button key={u.id} onClick={() => setMimicEmail(u.email || '')}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                {u.email?.split('@')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
