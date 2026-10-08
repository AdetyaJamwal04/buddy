import React from 'react';
import { Trophy } from 'lucide-react';
import { PersonalRecord } from '../../types';

interface PRNotificationProps {
  prs: PersonalRecord[];
  onDismiss: () => void;
}

export const PRNotification: React.FC<PRNotificationProps> = ({ prs, onDismiss }) => {
  if (prs.length === 0) return null;

  const latest = prs[prs.length - 1];

  const typeLabels = {
    weight: 'Heaviest Weight',
    reps_at_weight: 'Rep Record',
    est_1rm: 'Estimated 1RM Record',
    volume: 'Volume Record',
  };

  return (
    <div className="fixed top-5 left-4 right-4 max-w-sm mx-auto z-50 animate-in slide-in-from-top duration-300">
      <div 
        onClick={onDismiss}
        className="bg-[#1C1A14] border border-amber-500/40 rounded-2xl p-4 shadow-xl shadow-black/70 flex items-start gap-3.5 cursor-pointer backdrop-blur-md"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
          <Trophy className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
              NEW PERSONAL RECORD
            </span>
          </div>
          <p className="text-sm font-bold text-[#F3F4F6] truncate mt-0.5">
            {latest.exerciseName}
          </p>
          <p className="text-xs text-[#D1D5DB] font-numeric mt-0.5">
            <span className="font-semibold text-amber-300">
              {latest.value} {latest.type === 'reps_at_weight' ? 'reps' : 'kg'}
            </span>
            {latest.secondaryValue && latest.type === 'weight' && (
              <span className="text-[#9CA3AF]"> × {latest.secondaryValue} reps</span>
            )}
            <span className="text-[#9CA3AF] ml-1.5">({typeLabels[latest.type]})</span>
          </p>
        </div>
      </div>
    </div>
  );
};
