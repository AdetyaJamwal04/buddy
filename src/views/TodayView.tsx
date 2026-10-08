import React, { useState, useEffect } from 'react';
import { 
  Play, 
  CheckCircle2, 
  Trophy, 
  ChevronRight, 
  Moon
} from 'lucide-react';
import { db } from '../db';
import { 
  WorkoutTemplate, 
  WeeklyScheduleEntry, 
  Exercise, 
  Supplement, 
  SupplementLog, 
  PersonalRecord,
  SessionSet 
} from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { suggestProgression } from '../utils/calculations';
import { sound } from '../utils/audio';

interface TodayViewProps {
  onStartLiveWorkout: () => void;
  onNavigateToWorkouts: () => void;
  onNavigateToProgress: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onStartLiveWorkout,
  onNavigateToWorkouts,
  onNavigateToProgress,
}) => {
  const { activeSession, startWorkout, getLastPerformanceForExercise } = useWorkout();
  const { formatWeightValue } = useSettings();

  const [todaySchedule, setTodaySchedule] = useState<WeeklyScheduleEntry | null>(null);
  const [todayTemplate, setTodayTemplate] = useState<WorkoutTemplate | null>(null);
  const [firstExercise, setFirstExercise] = useState<Exercise | null>(null);
  const [progressionInfo, setProgressionInfo] = useState<{ targetWeight: number; reason: string; prevSets: SessionSet[] } | null>(null);
  const [completedSessionsThisWeek, setCompletedSessionsThisWeek] = useState<number>(0);
  const [weekDaysStatus, setWeekDaysStatus] = useState<{ dayName: string; isToday: boolean; hasCompleted: boolean; isScheduled: boolean }[]>([]);
  const [recentPR, setRecentPR] = useState<PersonalRecord | null>(null);
  const [todaySupplements, setTodaySupplements] = useState<Supplement[]>([]);
  const [todayLogs, setTodayLogs] = useState<SupplementLog[]>([]);

  const todayDateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadTodayData() {
      try {
        const jsDay = new Date().getDay();
        const customDayIndex = (jsDay === 0 ? 6 : jsDay - 1);

        const sched = await db.weeklySchedule.get(customDayIndex);
        setTodaySchedule(sched || null);

        if (sched && sched.templateId) {
          const tpl = await db.workoutTemplates.get(sched.templateId);
          setTodayTemplate(tpl || null);

          if (tpl && tpl.exercises.length > 0) {
            const firstItem = tpl.exercises[0];
            const ex = await db.exercises.get(firstItem.exerciseId);
            setFirstExercise(ex || null);

            if (ex) {
              const prevSets = await getLastPerformanceForExercise(ex.id);
              const sugg = suggestProgression(prevSets, firstItem.targetRepsMin, firstItem.targetRepsMax);
              setProgressionInfo({
                targetWeight: sugg.targetWeight,
                reason: sugg.reason,
                prevSets,
              });
            }
          }
        }

        // Calculate Weekly Consistency
        const now = new Date();
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diffToMon));
        monday.setHours(0, 0, 0, 0);

        const pastWeekSessions = await db.workoutSessions
          .where('completedAt')
          .aboveOrEqual(monday.getTime())
          .toArray();

        setCompletedSessionsThisWeek(pastWeekSessions.length);

        const allSchedule = await db.weeklySchedule.toArray();
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const strip = dayLabels.map((lbl, idx) => {
          const schedDay = allSchedule.find(s => s.dayIndex === idx);
          const isToday = idx === customDayIndex;
          
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + idx);
          const dayStart = new Date(dayDate).setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayDate).setHours(23, 59, 59, 999);

          const hasCompleted = pastWeekSessions.some(
            s => s.completedAt && s.completedAt >= dayStart && s.completedAt <= dayEnd
          );

          return {
            dayName: lbl,
            isToday,
            hasCompleted,
            isScheduled: Boolean(schedDay && schedDay.templateId),
          };
        });
        setWeekDaysStatus(strip);

        const latestPR = await db.personalRecords.orderBy('achievedAt').last();
        setRecentPR(latestPR || null);

        const activeSups = await db.supplements.where('isActive').equals(1).toArray();
        setTodaySupplements(activeSups);

        const logs = await db.supplementLogs.where('dateStr').equals(todayDateStr).toArray();
        setTodayLogs(logs);
      } catch (err) {
        console.error('Failed to load today view data', err);
      }
    }

    loadTodayData();
  }, [getLastPerformanceForExercise, todayDateStr]);

  const toggleSupplement = async (supplementId: string) => {
    sound.triggerHaptic([15]);
    const existing = todayLogs.find(l => l.supplementId === supplementId);
    if (existing) {
      await db.supplementLogs.delete(existing.id);
      setTodayLogs(prev => prev.filter(l => l.id !== existing.id));
    } else {
      sound.playSetCompleted();
      const newLog: SupplementLog = {
        id: `suplog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        supplementId,
        dateStr: todayDateStr,
        takenAt: Date.now(),
      };
      await db.supplementLogs.add(newLog);
      setTodayLogs(prev => [...prev, newLog]);
    }
  };

  const handleStartWorkout = async () => {
    if (todayTemplate) {
      await startWorkout(todayTemplate.id, todayTemplate.name);
    } else {
      await startWorkout(undefined, 'Quick Workout');
    }
    onStartLiveWorkout();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const isRestDay = !todaySchedule?.templateId;
  const totalWorkingSets = todayTemplate?.exercises.reduce((sum: number, e) => sum + e.targetSets, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Editorial Header */}
      <div>
        <span className="text-xs uppercase tracking-widest font-semibold text-[#8E95A5] block">
          {getGreeting()}
        </span>
        <div className="flex items-baseline justify-between mt-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F3F4F6]">
            {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
            <span className="text-[#6B7280] font-normal mx-2">·</span>
            <span className={isRestDay ? 'text-amber-400' : 'text-emerald-400'}>
              {isRestDay ? 'Rest & Recovery' : todayTemplate?.name || 'Training'}
            </span>
          </h2>
        </div>
        {todayTemplate?.description && (
          <p className="text-xs text-[#9CA3AF] mt-1">{todayTemplate.description}</p>
        )}
      </div>

      {/* Main Action Banner: Start or Resume */}
      {activeSession ? (
        <Card elevated className="p-5 bg-gradient-to-r from-emerald-950/50 via-[#151921] to-[#12151B] border-emerald-500/40">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                SESSION IN PROGRESS
              </span>
              <h3 className="text-lg font-bold text-[#F3F4F6]">{activeSession.name}</h3>
            </div>
            <Button onClick={onStartLiveWorkout} size="lg" className="h-12 px-5 text-sm gap-2">
              <Play className="w-4 h-4 fill-current" />
              Resume
            </Button>
          </div>
        </Card>
      ) : !isRestDay ? (
        <Card elevated className="p-5 bg-[#151921] border-[#242A38]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="success">SCHEDULED TODAY</Badge>
                <span className="text-xs text-[#9CA3AF]">
                  ≈ {todayTemplate?.estimatedMinutes || 50} min
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#F3F4F6]">
                {todayTemplate?.name}
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                {todayTemplate?.exercises.length} exercises · {totalWorkingSets} working sets
              </p>
            </div>
            <Button 
              onClick={handleStartWorkout}
              size="lg" 
              className="h-13 px-6 text-sm sm:text-base gap-2 font-bold shadow-lg shadow-emerald-500/10"
            >
              <Play className="w-4 h-4 fill-current" />
              START WORKOUT
            </Button>
          </div>
        </Card>
      ) : (
        <Card elevated className="p-5 bg-[#16171D] border-[#282E3B]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
              <Moon className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="warning">REST DAY</Badge>
                <span className="text-xs text-[#9CA3AF]">Active Recovery</span>
              </div>
              <h3 className="text-base font-bold text-[#F3F4F6]">Muscle protein synthesis & adaptation</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Prioritize sleep, hydration, and hitting your protein goal. Growth happens during recovery.
              </p>
              <div className="pt-2 flex gap-2">
                <Button 
                  onClick={() => {
                    startWorkout(undefined, 'Bonus Session');
                    onStartLiveWorkout();
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  Train Anyway Today
                </Button>
                <Button
                  onClick={onNavigateToWorkouts}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#9CA3AF]"
                >
                  Browse Routines
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* NEXT UP / FIRST EXERCISE PREVIEW */}
      {!isRestDay && firstExercise && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
              NEXT UP
            </span>
            <span className="text-xs text-[#9CA3AF]">Exercise 1 of {todayTemplate?.exercises.length}</span>
          </div>
          <Card className="p-4 bg-[#14171E] border-[#222733]">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-[#F3F4F6]">{firstExercise.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="capitalize">{firstExercise.muscleGroup}</Badge>
                  <span className="text-xs text-[#9CA3AF]">
                    {todayTemplate?.exercises[0]?.targetSets} sets × {todayTemplate?.exercises[0]?.targetRepsMin}–{todayTemplate?.exercises[0]?.targetRepsMax} reps
                  </span>
                </div>
              </div>

              {progressionInfo && progressionInfo.targetWeight > 0 && (
                <div className="text-right">
                  <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wider block">Target Weight</span>
                  <span className="font-numeric font-bold text-base text-emerald-400">
                    {formatWeightValue(progressionInfo.targetWeight)}
                  </span>
                </div>
              )}
            </div>

            {progressionInfo && (
              <div className="mt-3 pt-3 border-t border-[#1F2430] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#9CA3AF]">
                <span>
                  {progressionInfo.prevSets.length > 0
                    ? `Previous: ${progressionInfo.prevSets.map(s => `${formatWeightValue(s.weight)} × ${s.reps}`).slice(0, 3).join(', ')}`
                    : 'Establish baseline today'}
                </span>
                <span className="text-emerald-400 font-medium">
                  {progressionInfo.reason}
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* WEEKLY CONSISTENCY & 7-DAY STRIP */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
            WEEKLY CONSISTENCY
          </span>
          <span className="text-xs font-semibold text-emerald-400">
            {completedSessionsThisWeek} sessions completed this week
          </span>
        </div>

        <Card className="p-3 bg-[#13161D] border-[#212632]">
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekDaysStatus.map((day, i) => (
              <div 
                key={i}
                className={`py-2 px-1 rounded-xl transition-all ${
                  day.isToday 
                    ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-[#181C25] border border-transparent text-[#9CA3AF]'
                }`}
              >
                <span className="text-[10px] font-semibold block">{day.dayName}</span>
                <div className="mt-1 flex justify-center">
                  {day.hasCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-950" />
                  ) : day.isScheduled ? (
                    <div className="w-3.5 h-3.5 rounded-full border border-dashed border-[#4B5563]" />
                  ) : (
                    <span className="text-[10px] text-[#4B5563]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* TODAY'S SUPPLEMENT CHECKLIST */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
            TODAY'S SUPPLEMENTS
          </span>
          <span className="text-xs text-[#9CA3AF]">
            {todayLogs.length} / {todaySupplements.length} taken
          </span>
        </div>

        <Card className="p-2.5 bg-[#14171E] border-[#222733] divide-y divide-[#1D222D]">
          {todaySupplements.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] p-3 text-center">
              No supplements configured yet.
            </p>
          ) : (
            todaySupplements.map(sup => {
              const isTaken = todayLogs.some(l => l.supplementId === sup.id);
              return (
                <div
                  key={sup.id}
                  onClick={() => toggleSupplement(sup.id)}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#181C26] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        isTaken 
                          ? 'bg-emerald-500 text-black font-bold' 
                          : 'border border-[#384152] text-transparent hover:border-emerald-400'
                      }`}
                    >
                      {isTaken && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                    </button>
                    <div>
                      <p className={`text-xs font-semibold ${isTaken ? 'line-through text-[#6B7280]' : 'text-[#F3F4F6]'}`}>
                        {sup.name}
                      </p>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {sup.dosage} · <span className="capitalize">{sup.timing.replace('_', ' ')}</span>
                      </span>
                    </div>
                  </div>

                  <span className={`text-[11px] font-medium ${isTaken ? 'text-emerald-400' : 'text-[#6B7280]'}`}>
                    {isTaken ? 'Taken' : 'Tap to take'}
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* RECENT RECORD HIGHLIGHT */}
      {recentPR && (
        <Card 
          onClick={onNavigateToProgress}
          className="p-4 bg-gradient-to-r from-amber-950/25 to-[#151921] border-amber-500/25 cursor-pointer hover:border-amber-500/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                  RECENT PERSONAL RECORD
                </span>
                <p className="text-sm font-bold text-[#F3F4F6] mt-0.5">
                  {recentPR.exerciseName}
                </p>
                <p className="text-xs text-[#D1D5DB] font-numeric">
                  {recentPR.value} {recentPR.type === 'reps_at_weight' ? 'reps' : 'kg'}
                  {recentPR.secondaryValue && recentPR.type === 'weight' && (
                    <span className="text-[#9CA3AF]"> × {recentPR.secondaryValue} reps</span>
                  )}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
          </div>
        </Card>
      )}
    </div>
  );
};
