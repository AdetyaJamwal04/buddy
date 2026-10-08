import React from 'react';
import { Timer, X, Plus } from 'lucide-react';
import { useWorkout } from '../../context/WorkoutContext';

export const RestTimerHUD: React.FC = () => {
  const { restTimer, adjustRestTimer, skipRestTimer } = useWorkout();

  if (!restTimer.active || restTimer.remaining <= 0) {
    return null;
  }

  const minutes = Math.floor(restTimer.remaining / 60);
  const seconds = restTimer.remaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progressPercent = restTimer.totalDuration > 0 
    ? Math.max(0, Math.min(100, ((restTimer.totalDuration - restTimer.remaining) / restTimer.totalDuration) * 100))
    : 0;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom duration-200">
      <div className="relative bg-[#151921] border border-[#2A3140] rounded-2xl shadow-xl shadow-black/60 overflow-hidden backdrop-blur-md">
        {/* Progress Bar Header */}
        <div className="w-full bg-[#1C222C] h-1.5">
          <div 
            className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-r-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-3.5 flex items-center justify-between gap-3">
          {/* Left: Timer info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Timer className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">REST</span>
                <span className="font-numeric font-bold text-lg text-[#F3F4F6] tracking-tight">
                  {timeFormatted}
                </span>
              </div>
              {restTimer.exerciseName && (
                <p className="text-[11px] text-[#9CA3AF] truncate max-w-[150px]">
                  Next: Set {(restTimer.setIndex || 1) + 1}
                </p>
              )}
            </div>
          </div>

          {/* Right: Quick actions (+15, +30, Skip) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustRestTimer(15)}
              className="h-8 px-2.5 rounded-lg bg-[#1E2430] hover:bg-[#283040] text-xs font-semibold text-[#D1D5DB] border border-[#2E3748] transition-colors active:scale-95 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              15s
            </button>
            <button
              onClick={() => adjustRestTimer(30)}
              className="h-8 px-2.5 rounded-lg bg-[#1E2430] hover:bg-[#283040] text-xs font-semibold text-[#D1D5DB] border border-[#2E3748] transition-colors active:scale-95 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              30s
            </button>
            <button
              onClick={skipRestTimer}
              className="h-8 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 border border-red-500/20 transition-colors active:scale-95 flex items-center gap-1"
              aria-label="Skip rest timer"
            >
              <X className="w-3.5 h-3.5" />
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
