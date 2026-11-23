import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  History, 
  Trash2, 
  ChevronRight, 
  Copy, 
  Trophy,
  Search,
  Check
} from 'lucide-react';
import { db } from '../db';
import { 
  WorkoutTemplate, 
  WeeklyScheduleEntry, 
  WorkoutSession, 
  SessionSet, 
  Exercise, 
  TemplateExercise 
} from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { useSettings } from '../context/SettingsContext';
import { formatVolume } from '../utils/calculations';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { NumericStepper } from '../components/ui/NumericStepper';

interface WorkoutsViewProps {
  onStartLiveWorkout: () => void;
}

export const WorkoutsView: React.FC<WorkoutsViewProps> = ({ onStartLiveWorkout }) => {
  const { startWorkout } = useWorkout();
  const { formatWeightValue, unit } = useSettings();

  const [activeTab, setActiveTab] = useState<'routines' | 'planner' | 'history'>('routines');

  // Routines state
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});

  // Routine Builder modal state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderCategory, setBuilderCategory] = useState<WorkoutTemplate['category']>('push');
  const [builderExercises, setBuilderExercises] = useState<TemplateExercise[]>([]);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [searchExerciseQuery, setSearchExerciseQuery] = useState('');
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  // Weekly Planner state
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleEntry[]>([]);
  const [editingDay, setEditingDay] = useState<WeeklyScheduleEntry | null>(null);

  // History state
  const [historySessions, setHistorySessions] = useState<WorkoutSession[]>([]);
  const [historySets, setHistorySets] = useState<Record<string, SessionSet[]>>({});
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const allEx = await db.exercises.toArray();
      const exMap: Record<string, Exercise> = {};
      allEx.forEach((e: Exercise) => { exMap[e.id] = e; });
      setExercisesMap(exMap);
      setAvailableExercises(allEx);

      const tpls = await db.workoutTemplates.toArray();
      setTemplates(tpls);

      const sched = await db.weeklySchedule.toArray();
      sched.sort((a: WeeklyScheduleEntry, b: WeeklyScheduleEntry) => a.dayIndex - b.dayIndex);
      setWeeklySchedule(sched);

      const pastSessions = await db.workoutSessions
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('completedAt');
      setHistorySessions(pastSessions);

      const setsMap: Record<string, SessionSet[]> = {};
      for (const sess of pastSessions.slice(0, 15)) {
        const s = await db.sessionSets.where('sessionId').equals(sess.id).toArray();
        setsMap[sess.id] = s;
      }
      setHistorySets(setsMap);
    } catch (err) {
      console.error('Error loading workouts data', err);
    }
  }

  const handleOpenBuilder = (template?: WorkoutTemplate) => {
    if (template) {
      setBuilderId(template.id);
      setBuilderName(template.name);
      setBuilderCategory(template.category);
      setBuilderExercises([...template.exercises]);
    } else {
      setBuilderId(null);
      setBuilderName('');
      setBuilderCategory('custom');
      setBuilderExercises([]);
    }
    setIsBuilderOpen(true);
  };

  const handleSaveBuilder = async () => {
    if (!builderName.trim() || builderExercises.length === 0) return;

    const tplId = builderId || `tpl_${Date.now()}`;
    const newTemplate: WorkoutTemplate = {
      id: tplId,
      name: builderName.trim(),
      category: builderCategory,
      exercises: builderExercises,
      createdAt: Date.now(),
      estimatedMinutes: Math.max(30, builderExercises.length * 12),
    };

    await db.workoutTemplates.put(newTemplate);
    await loadAllData();
    setIsBuilderOpen(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    await db.workoutTemplates.delete(id);
    await loadAllData();
  };

  const handleDuplicateTemplate = async (tpl: WorkoutTemplate) => {
    const dup: WorkoutTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}`,
      name: `${tpl.name} (Copy)`,
      createdAt: Date.now(),
    };
    await db.workoutTemplates.add(dup);
    await loadAllData();
  };

  const handleAddExerciseToBuilder = (exId: string) => {
    setBuilderExercises(prev => [
      ...prev,
      {
        exerciseId: exId,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetRpe: 8,
        restSeconds: 90,
      },
    ]);
    setIsExercisePickerOpen(false);
    setSearchExerciseQuery('');
  };

  const handleRemoveBuilderExercise = (index: number) => {
    setBuilderExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleAssignDay = async (dayIndex: number, templateId: string | null) => {
    await db.weeklySchedule.update(dayIndex, { templateId });
    await loadAllData();
    setEditingDay(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Subtab Navigation Pill Bar */}
      <div className="flex p-1 bg-[#13161E] border border-[#232936] rounded-xl">
        <button
          onClick={() => setActiveTab('routines')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'routines'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344] shadow-xs'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Routines & Splits
        </button>
        <button
          onClick={() => setActiveTab('planner')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'planner'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344] shadow-xs'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Weekly Planner
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344] shadow-xs'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Training History
        </button>
      </div>

      {/* TAB 1: ROUTINES & TEMPLATES */}
      {activeTab === 'routines' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#F3F4F6]">Workout Templates</h3>
              <p className="text-xs text-[#9CA3AF]">Customizable splits & workout routines</p>
            </div>
            <Button onClick={() => handleOpenBuilder()} size="sm" className="gap-1 text-xs">
              <Plus className="w-4 h-4" />
              New Routine
            </Button>
          </div>

          <div className="space-y-3">
            {templates.map(tpl => {
              const totalSets = tpl.exercises.reduce((sum: number, e: TemplateExercise) => sum + e.targetSets, 0);

              return (
                <Card key={tpl.id} className="p-4 bg-[#14171E] border-[#222733] hover:border-[#2D3444] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="muted" className="capitalize">{tpl.category}</Badge>
                        <span className="text-xs text-[#9CA3AF]">≈ {tpl.estimatedMinutes || 50} min</span>
                      </div>
                      <h4 className="text-base font-bold text-[#F3F4F6]">{tpl.name}</h4>
                      <p className="text-xs text-[#9CA3AF]">
                        {tpl.exercises.length} exercises · {totalSets} sets
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={async () => {
                          await startWorkout(tpl.id, tpl.name);
                          onStartLiveWorkout();
                        }}
                        size="sm"
                        className="h-9 px-3 gap-1.5 text-xs font-bold"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start
                      </Button>
                    </div>
                  </div>

                  {/* Exercises List Summary */}
                  <div className="mt-3 pt-3 border-t border-[#1F2532] text-xs text-[#9CA3AF] space-y-1">
                    {tpl.exercises.map((item: TemplateExercise, idx: number) => {
                      const ex = exercisesMap[item.exerciseId];
                      return (
                        <div key={idx} className="flex justify-between">
                          <span className="text-[#D1D5DB] font-medium">{ex ? ex.name : 'Exercise'}</span>
                          <span className="font-numeric text-[#8E95A5]">
                            {item.targetSets} × {item.targetRepsMin}–{item.targetRepsMax}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-3 pt-2 border-t border-[#1C212B] flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDuplicateTemplate(tpl)}
                      className="text-xs text-[#8E95A5] hover:text-[#D1D5DB] flex items-center gap-1 p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleOpenBuilder(tpl)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 p-1 ml-2 font-medium"
                    >
                      Edit Routine
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="text-xs text-red-400 hover:text-red-300 p-1 ml-2"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WEEKLY PLANNER */}
      {activeTab === 'planner' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#F3F4F6]">Weekly Split Planner</h3>
            <p className="text-xs text-[#9CA3AF]">Assign workouts or rest days across your training week</p>
          </div>

          <div className="space-y-2">
            {weeklySchedule.map(day => {
              const assignedTemplate = day.templateId ? templates.find(t => t.id === day.templateId) : null;
              const isRest = !day.templateId;

              return (
                <Card 
                  key={day.dayIndex}
                  onClick={() => setEditingDay(day)}
                  className={`p-3.5 rounded-xl border cursor-pointer hover:border-[#384154] transition-all flex items-center justify-between ${
                    isRest ? 'bg-[#11141B] border-[#1E232E]' : 'bg-[#151922] border-[#252B3A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 text-center font-bold text-xs uppercase text-[#8E95A5]">
                      {day.dayName.substring(0, 3)}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isRest ? 'text-amber-400/90' : 'text-[#F3F4F6]'}`}>
                        {isRest ? (day.customLabel || 'Rest Day') : (assignedTemplate?.name || 'Workout')}
                      </h4>
                      <p className="text-[11px] text-[#8E95A5]">
                        {isRest ? 'Recovery & Mobility' : `${assignedTemplate?.exercises.length || 0} exercises`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={isRest ? 'warning' : 'success'}>
                      {isRest ? 'REST' : 'TRAIN'}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TRAINING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#F3F4F6]">Training History</h3>
            <p className="text-xs text-[#9CA3AF]">Chronological record of every completed session</p>
          </div>

          {historySessions.length === 0 ? (
            <Card className="p-8 text-center bg-[#13161E] border-[#202530] space-y-3">
              <History className="w-10 h-10 text-[#4B5563] mx-auto" />
              <h4 className="text-sm font-bold text-[#F3F4F6]">Your training history starts here</h4>
              <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto">
                Complete your first workout to start logging volume, sets, and personal records.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {historySessions.map(session => {
                const dateObj = new Date(session.startedAt);
                const isExpanded = expandedSessionId === session.id;
                const sets = historySets[session.id] || [];

                return (
                  <Card key={session.id} className="p-4 bg-[#14171E] border-[#222733] space-y-3">
                    <div 
                      onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs text-[#8E95A5]">
                        <span className="font-numeric uppercase tracking-wider font-semibold">
                          {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="font-numeric">{Math.round(session.durationSeconds / 60)} min</span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <h4 className="text-base font-bold text-[#F3F4F6]">{session.name}</h4>
                        {session.prCount > 0 && (
                          <Badge variant="pr" className="gap-1">
                            <Trophy className="w-3 h-3" />
                            {session.prCount} PR{session.prCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs font-numeric text-[#9CA3AF]">
                        <span>{session.totalSets} sets</span>
                        <span>·</span>
                        <span>{session.totalReps} reps</span>
                        <span>·</span>
                        <span className="text-emerald-400 font-semibold">
                          {formatVolume(session.totalVolumeKg, unit)}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-[#1F2532] space-y-3 animate-in fade-in">
                        {session.notes && (
                          <p className="text-xs italic text-[#9CA3AF] bg-[#0E1116] p-2.5 rounded-lg border border-[#1E232E]">
                            "{session.notes}"
                          </p>
                        )}

                        <div className="space-y-2">
                          <h5 className="text-[11px] uppercase tracking-wider font-semibold text-[#8E95A5]">
                            Logged Sets
                          </h5>
                          {sets.length === 0 ? (
                            <p className="text-xs text-[#8E95A5]">No detailed sets stored.</p>
                          ) : (
                            <div className="space-y-1">
                              {sets.map(s => {
                                const ex = exercisesMap[s.exerciseId];
                                return (
                                  <div key={s.id} className="flex justify-between text-xs py-1 px-2 rounded-md bg-[#10131A] font-numeric">
                                    <span className="text-[#D1D5DB] font-sans font-medium">
                                      {ex ? ex.name : 'Exercise'} (Set {s.setIndex})
                                    </span>
                                    <span className="text-emerald-400 font-semibold">
                                      {formatWeightValue(s.weight)} × {s.reps} reps
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Routine Builder Modal */}
      <Modal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        title={builderId ? 'Edit Routine' : 'Create Routine'}
        subtitle="Design your exercise sequence and rep targets"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block">
              Routine Name
            </label>
            <input
              type="text"
              value={builderName}
              onChange={e => setBuilderName(e.target.value)}
              placeholder="e.g. Push A (Chest & Delts)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block">
              Category Split
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setBuilderCategory(cat)}
                  className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    builderCategory === cat 
                      ? 'bg-emerald-500 text-black font-semibold' 
                      : 'bg-[#181C26] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise List in Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Exercises ({builderExercises.length})
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExercisePickerOpen(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 gap-1 h-7"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Exercise
              </Button>
            </div>

            {builderExercises.length === 0 ? (
              <div className="p-5 border border-dashed border-[#2A3140] rounded-xl text-center text-xs text-[#8E95A5]">
                No exercises added yet. Tap "Add Exercise" to select movements.
              </div>
            ) : (
              <div className="space-y-2">
                {builderExercises.map((item, idx) => {
                  const ex = exercisesMap[item.exerciseId];
                  return (
                    <div key={idx} className="p-3 rounded-xl bg-[#181C25] border border-[#232936] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F3F4F6]">
                          {idx + 1}. {ex ? ex.name : 'Exercise'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBuilderExercise(idx)}
                          className="text-xs text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-numeric">
                        <div>
                          <span className="text-[10px] text-[#8E95A5] block">Target Sets</span>
                          <NumericStepper
                            value={item.targetSets}
                            onChange={(val: number) => {
                              const updated = [...builderExercises];
                              updated[idx].targetSets = val;
                              setBuilderExercises(updated);
                            }}
                            min={1}
                            max={10}
                            size="sm"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-[#8E95A5] block">Reps Min</span>
                          <NumericStepper
                            value={item.targetRepsMin}
                            onChange={(val: number) => {
                              const updated = [...builderExercises];
                              updated[idx].targetRepsMin = val;
                              setBuilderExercises(updated);
                            }}
                            min={1}
                            max={50}
                            size="sm"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-[#8E95A5] block">Reps Max</span>
                          <NumericStepper
                            value={item.targetRepsMax}
                            onChange={(val: number) => {
                              const updated = [...builderExercises];
                              updated[idx].targetRepsMax = val;
                              setBuilderExercises(updated);
                            }}
                            min={item.targetRepsMin}
                            max={50}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#202532]">
            <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBuilder} disabled={!builderName || builderExercises.length === 0}>
              Save Routine
            </Button>
          </div>
        </div>
      </Modal>

      {/* Exercise Picker Modal for Builder */}
      <Modal
        isOpen={isExercisePickerOpen}
        onClose={() => setIsExercisePickerOpen(false)}
        title="Choose Exercise"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E95A5]" />
            <input
              type="text"
              value={searchExerciseQuery}
              onChange={e => setSearchExerciseQuery(e.target.value)}
              placeholder="Search exercise..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {availableExercises
              .filter(e => e.name.toLowerCase().includes(searchExerciseQuery.toLowerCase()))
              .map(ex => (
                <div
                  key={ex.id}
                  onClick={() => handleAddExerciseToBuilder(ex.id)}
                  className="p-2.5 rounded-lg bg-[#181C25] hover:bg-[#202532] border border-[#222733] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#F3F4F6]">{ex.name}</p>
                    <span className="text-[10px] text-[#8E95A5] capitalize">{ex.muscleGroup}</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              ))}
          </div>
        </div>
      </Modal>

      {/* Day Assignment Modal for Weekly Planner */}
      <Modal
        isOpen={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        title={`Assign ${editingDay?.dayName}`}
        subtitle="Choose a routine or set as rest day"
      >
        <div className="space-y-2 pt-1">
          <div
            onClick={() => editingDay && handleAssignDay(editingDay.dayIndex, null)}
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-amber-300">Rest Day (Recovery)</p>
              <p className="text-[11px] text-[#8E95A5]">Mobility, sleep, and adaptation</p>
            </div>
            {!editingDay?.templateId && <Check className="w-4 h-4 text-amber-400" />}
          </div>

          <div className="pt-2 text-[11px] uppercase font-semibold text-[#8E95A5]">
            Or choose a workout routine:
          </div>

          {templates.map(tpl => {
            const isAssigned = editingDay?.templateId === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => editingDay && handleAssignDay(editingDay.dayIndex, tpl.id)}
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                  isAssigned 
                    ? 'bg-emerald-950/25 border-emerald-500/40 text-[#F3F4F6]' 
                    : 'bg-[#181C25] border-[#222733] hover:bg-[#202532] text-[#D1D5DB]'
                }`}
              >
                <div>
                  <p className="text-xs font-bold">{tpl.name}</p>
                  <p className="text-[11px] text-[#8E95A5] capitalize">{tpl.category} · {tpl.exercises.length} exercises</p>
                </div>
                {isAssigned && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};
