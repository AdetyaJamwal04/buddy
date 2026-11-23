import React, { useState } from 'react';
import { Trophy, CheckCircle, Flame, Dumbbell, Star } from 'lucide-react';
import { WorkoutSummaryData } from '../../context/WorkoutContext';
import { useSettings } from '../../context/SettingsContext';
import { formatPRValue, formatVolume } from '../../utils/calculations';
import { Button } from './Button';
import { db } from '../../db';

interface WorkoutSummaryModalProps {
  data: WorkoutSummaryData;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({ data, onClose }) => {
  const { formatWeightValue, unit } = useSettings();
  const [rating, setRating] = useState<number>(data.session.rating || 5);
  const [notes, setNotes] = useState<string>(data.session.notes || '');

  const minutes = Math.round(data.session.durationSeconds / 60);
  const totalVolume = data.session.totalVolumeKg;
  const volumeString = formatVolume(totalVolume, unit);

  const handleSaveAndClose = async () => {
    if (rating !== data.session.rating || notes !== data.session.notes) {
      await db.workoutSessions.update(data.session.id, { rating, notes });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#14171E] border border-[#262C38] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-b from-emerald-950/40 to-transparent border-b border-[#202530] text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-7 h-7" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
            WORKOUT COMPLETED
          </span>
          <h2 className="text-xl font-bold text-[#F3F4F6] mt-0.5">{data.session.name}</h2>
          <p className="text-xs text-[#9CA3AF] mt-1 font-numeric">
            {new Date(data.session.startedAt).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#191D26] border border-[#262C3A] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wider block">Duration</span>
              <span className="font-numeric font-bold text-lg text-[#F3F4F6] mt-0.5 block">
                {minutes} <span className="text-xs font-normal text-[#9CA3AF]">min</span>
              </span>
            </div>
            <div className="bg-[#191D26] border border-[#262C3A] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wider block">Volume</span>
              <span className="font-numeric font-bold text-base text-emerald-400 mt-0.5 block truncate">
                {volumeString}
              </span>
            </div>
            <div className="bg-[#191D26] border border-[#262C3A] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wider block">Sets</span>
              <span className="font-numeric font-bold text-lg text-[#F3F4F6] mt-0.5 block">
                {data.session.totalSets} <span className="text-xs font-normal text-[#9CA3AF]">sets</span>
              </span>
            </div>
          </div>

          {/* PRs Section if any */}
          {data.prs.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-4 h-4" />
                <span>{data.prs.length} New Personal Record{data.prs.length > 1 ? 's' : ''} Hit!</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {data.prs.map(pr => (
                  <div key={pr.id} className="flex items-center justify-between text-xs py-1 border-t border-amber-500/20">
                    <span className="text-[#F3F4F6] font-medium">{pr.exerciseName}</span>
                    <span className="font-numeric font-semibold text-amber-300">
                      {formatPRValue(pr, unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exercise Volume Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF]">
              Exercise Breakdown
            </h4>
            <div className="space-y-1.5">
              {data.volumeByExercise.map(item => (
                <div key={item.exerciseName} className="flex items-center justify-between p-2.5 rounded-lg bg-[#181C25] border border-[#242A36] text-xs">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span className="font-medium text-[#F3F4F6]">{item.exerciseName}</span>
                  </div>
                  <div className="flex items-center gap-3 font-numeric text-[#9CA3AF]">
                    <span>{item.sets} sets</span>
                    <span className="font-semibold text-[#D1D5DB]">{formatWeightValue(item.volume)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Session */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block">
              Session Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-2 rounded-lg transition-colors ${
                    rating >= star 
                      ? 'text-amber-400 bg-amber-400/10' 
                      : 'text-[#4B5563] hover:text-[#9CA3AF]'
                  }`}
                  aria-label={`Rate ${star} stars`}
                >
                  <Star className="w-5 h-5 fill-current" />
                </button>
              ))}
            </div>
          </div>

          {/* Workout Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block">
              Workout Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did today's session feel? Any pain, fatigue, or notable wins?"
              rows={2}
              className="w-full bg-[#181C25] border border-[#262C38] rounded-xl p-3 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222733] bg-[#12151B]">
          <Button onClick={handleSaveAndClose} className="w-full h-12 text-sm">
            Done & Save Summary
          </Button>
        </div>
      </div>
    </div>
  );
};
