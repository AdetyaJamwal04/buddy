import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  WorkoutSession, 
  SessionSet, 
  Exercise, 
  PersonalRecord, 
  WorkoutTemplate,
  SetType,
  WeightUnit
} from '../types';
import { db, getUserSettings, saveUserSettings } from '../db';
import { calculateVolume, evaluatePRs, formatWeight } from '../utils/calculations';
import { sound } from '../utils/audio';

export interface RestTimerState {
  active: boolean;
  totalDuration: number;
  remaining: number;
  exerciseName?: string;
  setIndex?: number;
}

export interface WorkoutSummaryData {
  session: WorkoutSession;
  sets: SessionSet[];
  exercises: Exercise[];
  prs: PersonalRecord[];
  volumeByExercise: { exerciseName: string; volume: number; sets: number }[];
}

interface WorkoutContextType {
  activeSession: WorkoutSession | null;
  sessionSets: SessionSet[];
  activeExercises: Exercise[];
  elapsedSeconds: number;
  restTimer: RestTimerState;
  sessionPRs: PersonalRecord[];
  summaryData: WorkoutSummaryData | null;
  startWorkout: (templateId?: string, customName?: string) => Promise<void>;
  completeSet: (setId: string) => Promise<void>;
  updateSet: (setId: string, updates: Partial<SessionSet>) => Promise<void>;
  addSet: (exerciseId: string) => Promise<void>;
  removeSet: (setId: string) => Promise<void>;
  addExerciseToSession: (exerciseId: string) => Promise<void>;
  removeExerciseFromSession: (exerciseId: string) => Promise<void>;
  adjustRestTimer: (seconds: number) => void;
  skipRestTimer: () => void;
  finishWorkout: (notes?: string, rating?: number) => Promise<void>;
  discardWorkout: () => Promise<void>;
  closeSummary: () => void;
  getLastPerformanceForExercise: (exerciseId: string) => Promise<SessionSet[]>;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionSets, setSessionSets] = useState<SessionSet[]>([]);
  const [activeExercises, setActiveExercises] = useState<Exercise[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionPRs, setSessionPRs] = useState<PersonalRecord[]>([]);
  const [summaryData, setSummaryData] = useState<WorkoutSummaryData | null>(null);

  const [restTimer, setRestTimer] = useState<RestTimerState>({
    active: false,
    totalDuration: 90,
    remaining: 0,
  });

  const timerIntervalRef = useRef<number | null>(null);
  const restTimerIntervalRef = useRef<number | null>(null);

  // Resume or restore existing in-progress workout on mount
  useEffect(() => {
    async function restoreActiveWorkout() {
      try {
        const settings = await getUserSettings();
        sound.setEnabled(settings.soundEnabled, settings.hapticsEnabled);

        const inProgress = await db.workoutSessions
          .where('status')
          .equals('in_progress')
          .first();

        if (inProgress) {
          setActiveSession(inProgress);
          const sets = await db.sessionSets.where('sessionId').equals(inProgress.id).toArray();
          sets.sort((a, b) => a.setIndex - b.setIndex);
          setSessionSets(sets);

          // Fetch unique exercises
          const exerciseIds = Array.from(new Set(sets.map(s => s.exerciseId)));
          const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray();
          setActiveExercises(exercises);

          // Calculate initial elapsed time
          const elapsed = Math.floor((Date.now() - inProgress.startedAt) / 1000);
          setElapsedSeconds(elapsed > 0 ? elapsed : 0);

          // Load PRs achieved in this session
          const prs = await db.personalRecords.where('sessionId').equals(inProgress.id).toArray();
          setSessionPRs(prs);
        }
      } catch (err) {
        console.error('Failed to restore active workout', err);
      }
    }
    restoreActiveWorkout();
  }, []);

  // Main workout timer ticker
  useEffect(() => {
    if (activeSession) {
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setElapsedSeconds(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeSession]);

  // Rest timer ticker
  useEffect(() => {
    if (restTimer.active && restTimer.remaining > 0) {
      restTimerIntervalRef.current = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev.remaining <= 1) {
            sound.playTimerFinished();
            return { ...prev, active: false, remaining: 0 };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    } else {
      if (restTimerIntervalRef.current) clearInterval(restTimerIntervalRef.current);
    }
    return () => {
      if (restTimerIntervalRef.current) clearInterval(restTimerIntervalRef.current);
    };
  }, [restTimer.active, restTimer.remaining]);

  // Query last completed performance for an exercise
  const getLastPerformanceForExercise = useCallback(async (exerciseId: string): Promise<SessionSet[]> => {
    try {
      const pastSessions = await db.workoutSessions
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('completedAt');

      for (const sess of pastSessions) {
        const pastSets = await db.sessionSets
          .where('sessionId')
          .equals(sess.id)
          .and(s => s.exerciseId === exerciseId && s.isCompleted)
          .toArray();

        if (pastSets.length > 0) {
          pastSets.sort((a, b) => a.setIndex - b.setIndex);
          return pastSets;
        }
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // Start workout from a template or blank
  const startWorkout = useCallback(async (templateId?: string, customName?: string) => {
    const sessionId = 'sess_' + Date.now();
    const now = Date.now();

    let sessionName = customName || 'Quick Workout';
    const initialSets: SessionSet[] = [];
    const exerciseList: Exercise[] = [];

    if (templateId) {
      const template = await db.workoutTemplates.get(templateId);
      if (template) {
        sessionName = template.name;
        for (const item of template.exercises) {
          const ex = await db.exercises.get(item.exerciseId);
          if (ex) {
            if (!exerciseList.some(e => e.id === ex.id)) {
              exerciseList.push(ex);
            }
            // Check previous session values to auto-populate smart defaults!
            const previousSets = await getLastPerformanceForExercise(ex.id);
            for (let i = 1; i <= item.targetSets; i++) {
              const prevMatch = previousSets[i - 1] || previousSets[previousSets.length - 1];
              initialSets.push({
                id: `set_${sessionId}_${ex.id}_${i}`,
                sessionId,
                exerciseId: ex.id,
                setIndex: i,
                type: 'normal',
                weight: prevMatch ? prevMatch.weight : 20,
                reps: prevMatch ? prevMatch.reps : item.targetRepsMin || 8,
                rpe: item.targetRpe || 8,
                isCompleted: false,
              });
            }
          }
        }
      }
    } else {
      // Blank workout: add default bench press
      const defaultEx = await db.exercises.get('ex_bench_press');
      if (defaultEx) {
        exerciseList.push(defaultEx);
        const previousSets = await getLastPerformanceForExercise(defaultEx.id);
        const prevMatch = previousSets[0];
        initialSets.push({
          id: `set_${sessionId}_${defaultEx.id}_1`,
          sessionId,
          exerciseId: defaultEx.id,
          setIndex: 1,
          type: 'normal',
          weight: prevMatch ? prevMatch.weight : 40,
          reps: prevMatch ? prevMatch.reps : 8,
          rpe: 8,
          isCompleted: false,
        });
      }
    }

    const newSession: WorkoutSession = {
      id: sessionId,
      templateId,
      name: sessionName,
      startedAt: now,
      status: 'in_progress',
      durationSeconds: 0,
      totalVolumeKg: 0,
      totalSets: 0,
      totalReps: 0,
      prCount: 0,
    };

    await db.transaction('rw', [db.workoutSessions, db.sessionSets, db.settings], async () => {
      await db.workoutSessions.add(newSession);
      if (initialSets.length > 0) {
        await db.sessionSets.bulkAdd(initialSets);
      }
      await saveUserSettings({ activeSessionId: sessionId });
    });

    setActiveSession(newSession);
    setSessionSets(initialSets);
    setActiveExercises(exerciseList);
    setElapsedSeconds(0);
    setSessionPRs([]);
  }, [getLastPerformanceForExercise]);

  // Complete a set, trigger PR check, sound/haptic, and rest timer
  const completeSet = useCallback(async (setId: string) => {
    const targetSet = sessionSets.find(s => s.id === setId);
    if (!targetSet) return;

    const willBeCompleted = !targetSet.isCompleted;
    const updatedSet: SessionSet = {
      ...targetSet,
      isCompleted: willBeCompleted,
      completedAt: willBeCompleted ? Date.now() : undefined,
    };

    const ex = activeExercises.find(e => e.id === updatedSet.exerciseId);
    const exerciseName = ex ? ex.name : 'Exercise';

    // Optimistic state update
    const updatedSets = sessionSets.map(s => s.id === setId ? updatedSet : s);
    setSessionSets(updatedSets);

    await db.sessionSets.put(updatedSet);

    if (willBeCompleted) {
      // Evaluate PRs
      const existingPRs = await db.personalRecords.toArray();
      const prResult = evaluatePRs(updatedSet, exerciseName, existingPRs);

      if (prResult.isPR && prResult.newRecords.length > 0) {
        sound.playPRAchieved();
        const recordsToAdd: PersonalRecord[] = prResult.newRecords.map(r => ({
          ...r,
          id: `pr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }));
        await db.personalRecords.bulkAdd(recordsToAdd);
        setSessionPRs(prev => [...prev, ...recordsToAdd]);
      } else {
        sound.playSetCompleted();
      }

      // Trigger Rest Timer
      const settings = await getUserSettings();
      if (settings.autoStartTimer) {
        const restDuration = ex ? ex.defaultRestSeconds : settings.defaultRestSeconds;
        setRestTimer({
          active: true,
          totalDuration: restDuration,
          remaining: restDuration,
          exerciseName,
          setIndex: updatedSet.setIndex,
        });
      }
    }
  }, [sessionSets, activeExercises]);

  // Update set weight, reps, rpe, or type
  const updateSet = useCallback(async (setId: string, updates: Partial<SessionSet>) => {
    const target = sessionSets.find(s => s.id === setId);
    if (!target) return;

    const modified = { ...target, ...updates };
    setSessionSets(prev => prev.map(s => s.id === setId ? modified : s));
    await db.sessionSets.put(modified);
  }, [sessionSets]);

  // Add next set to an exercise
  const addSet = useCallback(async (exerciseId: string) => {
    if (!activeSession) return;
    const existing = sessionSets.filter(s => s.exerciseId === exerciseId);
    const nextIndex = existing.length + 1;
    const lastSet = existing[existing.length - 1];

    const newSet: SessionSet = {
      id: `set_${activeSession.id}_${exerciseId}_${nextIndex}_${Date.now()}`,
      sessionId: activeSession.id,
      exerciseId,
      setIndex: nextIndex,
      type: 'normal',
      weight: lastSet ? lastSet.weight : 20,
      reps: lastSet ? lastSet.reps : 8,
      rpe: lastSet ? lastSet.rpe : 8,
      isCompleted: false,
    };

    setSessionSets(prev => [...prev, newSet]);
    await db.sessionSets.add(newSet);
  }, [activeSession, sessionSets]);

  // Remove set from an exercise
  const removeSet = useCallback(async (setId: string) => {
    setSessionSets(prev => prev.filter(s => s.id !== setId));
    await db.sessionSets.delete(setId);
  }, []);

  // Add a new exercise to live session
  const addExerciseToSession = useCallback(async (exerciseId: string) => {
    if (!activeSession) return;
    const ex = await db.exercises.get(exerciseId);
    if (!ex) return;

    if (!activeExercises.some(e => e.id === ex.id)) {
      setActiveExercises(prev => [...prev, ex]);
    }

    const previousSets = await getLastPerformanceForExercise(exerciseId);
    const prevMatch = previousSets[0];

    const initialSet: SessionSet = {
      id: `set_${activeSession.id}_${exerciseId}_1_${Date.now()}`,
      sessionId: activeSession.id,
      exerciseId,
      setIndex: 1,
      type: 'normal',
      weight: prevMatch ? prevMatch.weight : 20,
      reps: prevMatch ? prevMatch.reps : 8,
      rpe: 8,
      isCompleted: false,
    };

    setSessionSets(prev => [...prev, initialSet]);
    await db.sessionSets.add(initialSet);
  }, [activeSession, activeExercises, getLastPerformanceForExercise]);

  // Remove an exercise from the current workout session
  const removeExerciseFromSession = useCallback(async (exerciseId: string) => {
    setActiveExercises(prev => prev.filter(e => e.id !== exerciseId));
    const setsToDelete = sessionSets.filter(s => s.exerciseId === exerciseId);
    setSessionSets(prev => prev.filter(s => s.exerciseId !== exerciseId));
    for (const s of setsToDelete) {
      await db.sessionSets.delete(s.id);
    }
  }, [sessionSets]);

  // Rest timer adjustments
  const adjustRestTimer = useCallback((seconds: number) => {
    setRestTimer(prev => {
      const nextRemaining = Math.max(0, prev.remaining + seconds);
      return {
        ...prev,
        remaining: nextRemaining,
        totalDuration: Math.max(prev.totalDuration, nextRemaining),
        active: nextRemaining > 0,
      };
    });
  }, []);

  const skipRestTimer = useCallback(() => {
    setRestTimer(prev => ({ ...prev, active: false, remaining: 0 }));
  }, []);

  // Finish Workout
  const finishWorkout = useCallback(async (notes?: string, rating?: number) => {
    if (!activeSession) return;

    const completedSets = sessionSets.filter(s => s.isCompleted);
    const totalVolume = calculateVolume(completedSets);
    const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0);

    const completedSession: WorkoutSession = {
      ...activeSession,
      status: 'completed',
      completedAt: Date.now(),
      durationSeconds: elapsedSeconds,
      totalVolumeKg: totalVolume,
      totalSets: completedSets.length,
      totalReps,
      prCount: sessionPRs.length,
      notes,
      rating,
    };

    await db.transaction('rw', [db.workoutSessions, db.settings], async () => {
      await db.workoutSessions.put(completedSession);
      await saveUserSettings({ activeSessionId: null });
    });

    // Compute volume breakdown by exercise
    const volumeByExercise = activeExercises.map(ex => {
      const exSets = completedSets.filter(s => s.exerciseId === ex.id);
      return {
        exerciseName: ex.name,
        volume: calculateVolume(exSets),
        sets: exSets.length,
      };
    }).filter(v => v.sets > 0);

    setSummaryData({
      session: completedSession,
      sets: sessionSets,
      exercises: activeExercises,
      prs: sessionPRs,
      volumeByExercise,
    });

    sound.playPRAchieved();

    setActiveSession(null);
    setSessionSets([]);
    setActiveExercises([]);
    setElapsedSeconds(0);
    setRestTimer({ active: false, totalDuration: 0, remaining: 0 });
  }, [activeSession, sessionSets, elapsedSeconds, sessionPRs, activeExercises]);

  // Discard workout
  const discardWorkout = useCallback(async () => {
    if (!activeSession) return;
    const sessId = activeSession.id;

    await db.transaction('rw', [db.workoutSessions, db.sessionSets, db.personalRecords, db.settings], async () => {
      await db.workoutSessions.delete(sessId);
      await db.sessionSets.where('sessionId').equals(sessId).delete();
      await db.personalRecords.where('sessionId').equals(sessId).delete();
      await saveUserSettings({ activeSessionId: null });
    });

    setActiveSession(null);
    setSessionSets([]);
    setActiveExercises([]);
    setElapsedSeconds(0);
    setRestTimer({ active: false, totalDuration: 0, remaining: 0 });
    setSessionPRs([]);
  }, [activeSession]);

  const closeSummary = useCallback(() => {
    setSummaryData(null);
  }, []);

  return (
    <WorkoutContext.Provider
      value={{
        activeSession,
        sessionSets,
        activeExercises,
        elapsedSeconds,
        restTimer,
        sessionPRs,
        summaryData,
        startWorkout,
        completeSet,
        updateSet,
        addSet,
        removeSet,
        addExerciseToSession,
        removeExerciseFromSession,
        adjustRestTimer,
        skipRestTimer,
        finishWorkout,
        discardWorkout,
        closeSummary,
        getLastPerformanceForExercise,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
};
