import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Plus, 
  Trash2, 
  Clock, 
  Dumbbell, 
  FileText,
  Search,
  AlertTriangle
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { useSettings } from '../context/SettingsContext';
import { db } from '../db';
import { Exercise, SessionSet, SetType } from '../types';
import { NumericStepper } from '../components/ui/NumericStepper';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { suggestProgression, displayWeight, storeWeight } from '../utils/calculations';

interface LiveWorkoutViewProps {
  onBackToApp: () => void;
}

export const LiveWorkoutView: React.FC<LiveWorkoutViewProps> = ({ onBackToApp }) => {
  const { 
    activeSession, 
    sessionSets, 
    activeExercises, 
    elapsedSeconds, 
    completeSet, 
    updateSet, 
    addSet, 
    removeSet, 
    addExerciseToSession, 
    removeExerciseFromSession,
    finishWorkout, 
    discardWorkout,
    getLastPerformanceForExercise,
  } = useWorkout();

  const { formatWeightValue, unit } = useSettings();

  const [previousPerformances, setPreviousPerformances] = useState<Record<string, SessionSet[]>>({});
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>('all');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [activeNoteExerciseId, setActiveNoteExerciseId] = useState<string | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadHistories() {
      const records: Record<string, SessionSet[]> = {};
      for (const ex of activeExercises) {
        const past = await getLastPerformanceForExercise(ex.id);
        records[ex.id] = past;
      }
      setPreviousPerformances(records);
    }
    if (activeExercises.length > 0) {
      loadHistories();
    }
  }, [activeExercises, getLastPerformanceForExercise]);

  useEffect(() => {
    async function loadLibrary() {
      const all = await db.exercises.toArray();
      setAvailableExercises(all);
    }
    loadLibrary();
  }, []);

  // Screen Wake Lock API to prevent mobile screen sleep during workout
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let wakeLock: any = null;
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock.request('screen');
        }
      } catch {
        // Wake lock denied or unsupported
      }
    }
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock && typeof wakeLock.release === 'function') {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinish = async () => {
    await finishWorkout(workoutNotes);
    onBackToApp();
  };

  const handleDiscard = async () => {
    await discardWorkout();
    onBackToApp();
  };

  const filteredExercises = availableExercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
    const matchesMuscle = selectedMuscleFilter === 'all' || ex.muscleGroup === selectedMuscleFilter;
    const notAlreadyInSession = !activeExercises.some(e => e.id === ex.id);
    return matchesSearch && matchesMuscle && notAlreadyInSession;
  });

  const muscleFilters = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

  if (!activeSession) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <Dumbbell className="w-12 h-12 text-[#4B5563]" />
        <h3 className="text-lg font-bold text-[#F3F4F6]">No workout active</h3>
        <p className="text-xs text-[#9CA3AF]">Start today's session from the home screen.</p>
        <Button onClick={onBackToApp}>Go to Today</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Sticky Top Workout Control Bar */}
      <div className="sticky top-0 z-20 bg-[#0D0E11]/95 backdrop-blur-md -mx-4 px-4 py-3 border-b border-[#202530] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1E232E] transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-[#F3F4F6] truncate max-w-[180px] sm:max-w-xs">
              {activeSession.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-numeric font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDiscardConfirm(true)}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 h-8"
          >
            Discard
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowFinishConfirm(true)}
            className="h-8 px-3.5 text-xs font-bold"
          >
            Finish
          </Button>
        </div>
      </div>

      {/* Exercises Section */}
      <div className="space-y-5">
        {activeExercises.map((exercise, exerciseIdx) => {
          const sets = sessionSets
            .filter(s => s.exerciseId === exercise.id)
            .sort((a, b) => a.setIndex - b.setIndex);

          const pastSets = previousPerformances[exercise.id] || [];
          const progression = suggestProgression(pastSets);

          return (
            <Card key={exercise.id} className="p-4 sm:p-5 bg-[#14171E] border-[#222733] space-y-4">
              {/* Exercise Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      #{exerciseIdx + 1}
                    </span>
                    <Badge variant="muted" className="capitalize">{exercise.muscleGroup}</Badge>
                    <Badge variant="outline" className="capitalize text-[10px]">{exercise.equipment}</Badge>
                  </div>
                  <h3 className="text-base font-bold text-[#F3F4F6]">{exercise.name}</h3>

                  {/* Previous session & Progressive overload guide */}
                  <div className="pt-1 text-xs space-y-0.5">
                    {pastSets.length > 0 ? (
                      <p className="text-[#9CA3AF] font-numeric">
                        <span className="text-[#6B7280]">Previous:</span>{' '}
                        {pastSets.map(s => `${formatWeightValue(s.weight)} × ${s.reps}`).join(' · ')}
                      </p>
                    ) : (
                      <p className="text-[#6B7280]">No previous logs · Enter starting baseline</p>
                    )}

                    {progression.reason && (
                      <p className="text-emerald-400/90 font-medium text-[11px]">
                        Target: {progression.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions (Exercise note, remove) */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveNoteExerciseId(activeNoteExerciseId === exercise.id ? null : exercise.id)}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1E232E] transition-colors"
                    title="Exercise Notes"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeExerciseFromSession(exercise.id)}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-[#1E232E] transition-colors"
                    title="Remove Exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Optional Exercise Note */}
              {activeNoteExerciseId === exercise.id && (
                <div className="p-2.5 rounded-xl bg-[#0F1217] border border-[#222733] animate-in fade-in">
                  <textarea
                    value={exerciseNotes[exercise.id] || ''}
                    onChange={e => setExerciseNotes(prev => ({ ...prev, [exercise.id]: e.target.value }))}
                    placeholder="Cue notes (e.g. Keep elbows slightly tucked, slow 3s eccentric)"
                    rows={2}
                    className="w-full bg-transparent text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Set Logging Table */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1.5 sm:gap-2 px-1 text-[11px] font-semibold text-[#8E95A5] uppercase tracking-wider text-center">
                  <div className="col-span-1 text-left">Set</div>
                  <div className="col-span-2 text-left hidden sm:block">Prev</div>
                  <div className="col-span-5 sm:col-span-4">Weight ({unit})</div>
                  <div className="col-span-4 sm:col-span-3">Reps</div>
                  <div className="col-span-2 text-right">Log</div>
                </div>

                <div className="space-y-2">
                  {sets.map((set, sIdx) => {
                    const prevSet = pastSets[sIdx];
                    const weightStep = unit === 'lb' ? 5 : 2.5;

                    return (
                      <div
                        key={set.id}
                        className={`grid grid-cols-12 gap-1.5 sm:gap-2 items-center p-2 rounded-xl transition-all ${
                          set.isCompleted 
                            ? 'bg-emerald-950/20 border border-emerald-500/30' 
                            : 'bg-[#10131A] border border-[#222733]'
                        }`}
                      >
                        {/* Set Number & Type Toggle */}
                        <div className="col-span-1 text-left">
                          <button
                            type="button"
                            onClick={() => {
                              const nextType: SetType = set.type === 'normal' ? 'warmup' : set.type === 'warmup' ? 'failure' : 'normal';
                              updateSet(set.id, { type: nextType });
                            }}
                            className={`w-6 h-6 rounded-lg text-xs font-numeric font-bold flex items-center justify-center transition-colors ${
                              set.type === 'warmup'
                                ? 'bg-amber-500/20 text-amber-300'
                                : set.type === 'failure'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-[#1E232E] text-[#D1D5DB]'
                            }`}
                            title="Tap to toggle Warm-up / Normal / Failure"
                          >
                            {set.type === 'warmup' ? 'W' : set.type === 'failure' ? 'F' : set.setIndex}
                          </button>
                        </div>

                        {/* Previous reference */}
                        <div className="col-span-2 text-left hidden sm:block font-numeric text-xs text-[#6B7280] truncate">
                          {prevSet ? `${formatWeightValue(prevSet.weight)} × ${prevSet.reps}` : '—'}
                        </div>

                        {/* Weight Stepper */}
                        <div className="col-span-5 sm:col-span-4 flex justify-center">
                          <NumericStepper
                            value={displayWeight(set.weight, unit)}
                            onChange={val => updateSet(set.id, { weight: storeWeight(val, unit) })}
                            step={weightStep}
                            min={0}
                            size="sm"
                            disabled={set.isCompleted}
                            className="w-full max-w-[130px]"
                          />
                        </div>

                        {/* Reps Stepper */}
                        <div className="col-span-4 sm:col-span-3 flex justify-center">
                          <NumericStepper
                            value={set.reps}
                            onChange={val => updateSet(set.id, { reps: val })}
                            step={1}
                            min={1}
                            size="sm"
                            disabled={set.isCompleted}
                            className="w-full max-w-[110px]"
                          />
                        </div>

                        {/* Complete Checkbox */}
                        <div className="col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => completeSet(set.id)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                              set.isCompleted
                                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20 font-bold'
                                : 'bg-[#1C212B] hover:bg-[#252B38] text-[#6B7280] hover:text-[#F3F4F6] border border-[#2B3342]'
                            }`}
                            aria-label={set.isCompleted ? 'Mark set incomplete' : 'Complete set'}
                          >
                            <Check className={`w-4 h-4 stroke-[3] ${set.isCompleted ? 'text-black' : 'text-current'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Set Button */}
                <div className="pt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSet(exercise.id)}
                    className="h-8 text-xs text-emerald-400 hover:text-emerald-300 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Set
                  </Button>

                  {sets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSet(sets[sets.length - 1].id)}
                      className="h-8 text-xs text-[#6B7280] hover:text-red-400 gap-1"
                    >
                      Delete Last Set
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Exercise Action */}
      <div className="pt-2">
        <Button
          onClick={() => setShowAddExerciseModal(true)}
          variant="secondary"
          size="lg"
          className="w-full h-13 text-sm font-semibold border-dashed border-[#333C4E] hover:border-emerald-500/50 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Exercise to Workout
        </Button>
      </div>

      {/* Add Exercise Modal */}
      <Modal
        isOpen={showAddExerciseModal}
        onClose={() => setShowAddExerciseModal(false)}
        title="Add Exercise"
        subtitle="Search from exercise library"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E95A5]" />
            <input
              type="text"
              value={exerciseSearchQuery}
              onChange={e => setExerciseSearchQuery(e.target.value)}
              placeholder="Search exercise..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {muscleFilters.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMuscleFilter(m)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors ${
                  selectedMuscleFilter === m
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-[#181C26] text-[#9CA3AF] hover:text-[#F3F4F6]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
            {filteredExercises.length === 0 ? (
              <p className="text-xs text-center text-[#9CA3AF] py-6">
                No matching exercises found.
              </p>
            ) : (
              filteredExercises.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => {
                    addExerciseToSession(ex.id);
                    setShowAddExerciseModal(false);
                    setExerciseSearchQuery('');
                  }}
                  className="p-3 rounded-xl bg-[#181C25] hover:bg-[#202532] border border-[#232936] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-[#F3F4F6]">{ex.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#9CA3AF] capitalize">{ex.muscleGroup}</span>
                      <span className="text-[10px] text-[#6B7280]">·</span>
                      <span className="text-[10px] text-[#9CA3AF] capitalize">{ex.equipment}</span>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-400" />
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Discard Confirmation Dialog */}
      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Workout?"
        subtitle="This will permanently delete sets logged in this session."
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Are you sure? Any progress from this current training session will be lost.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Keep Training
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard Session
            </Button>
          </div>
        </div>
      </Modal>

      {/* Finish Confirmation Dialog */}
      <Modal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        title="Finish Workout?"
        subtitle="Ready to review and save your training summary?"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block">
              Session Notes (Optional)
            </label>
            <textarea
              value={workoutNotes}
              onChange={e => setWorkoutNotes(e.target.value)}
              placeholder="How did the lifts feel? Any joint soreness or energy notes?"
              rows={3}
              className="w-full bg-[#0F1217] border border-[#242936] rounded-xl p-3 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>
              Back to Workout
            </Button>
            <Button variant="primary" onClick={handleFinish} className="font-bold">
              Save & Finish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
