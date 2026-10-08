import { PRType, SessionSet, PersonalRecord, WeightUnit } from '../types';

export const KG_TO_LB = 2.20462;

export function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / KG_TO_LB) * 10) / 10;
}

/**
 * Format weight based on user preference unit.
 * canonical weight is always stored in kg.
 */
export function formatWeight(weightKg: number, unit: WeightUnit = 'kg'): string {
  if (unit === 'lb') {
    const val = kgToLb(weightKg);
    return `${val} lb`;
  }
  // If whole number, format cleanly, else 1 decimal
  return `${Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)} kg`;
}

export function parseWeightInput(displayValue: number, unit: WeightUnit = 'kg'): number {
  if (unit === 'lb') {
    return lbToKg(displayValue);
  }
  return displayValue;
}

/**
 * Standard Epley formula for estimated 1-Rep Max.
 * 1RM = Weight * (1 + Reps / 30)
 * When reps === 1, 1RM is the lifted weight.
 */
export function calculateEst1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const oneRM = weightKg * (1 + reps / 30);
  return Math.round(oneRM * 10) / 10;
}

/**
 * Calculate total volume for sets
 */
export function calculateVolume(sets: { weight: number; reps: number; isCompleted: boolean }[]): number {
  return sets.reduce((acc, s) => {
    if (!s.isCompleted) return acc;
    return acc + (s.weight * s.reps);
  }, 0);
}

export interface PRCheckResult {
  isPR: boolean;
  types: PRType[];
  newRecords: Omit<PersonalRecord, 'id'>[];
}

/**
 * Evaluates whether a completed set constitutes a new Personal Record:
 * 1. Weight PR: Heaviest single weight lifted for this exercise.
 * 2. Rep PR: Most reps performed at this specific weight.
 * 3. 1RM PR: Highest estimated 1RM calculated for this exercise.
 */
export function evaluatePRs(
  set: SessionSet,
  exerciseName: string,
  existingPRs: PersonalRecord[]
): PRCheckResult {
  if (!set.isCompleted || set.type === 'warmup' || set.weight <= 0 || set.reps <= 0) {
    return { isPR: false, types: [], newRecords: [] };
  }

  const exercisePRs = existingPRs.filter(pr => pr.exerciseId === set.exerciseId);
  const detectedTypes: PRType[] = [];
  const newRecords: Omit<PersonalRecord, 'id'>[] = [];
  const now = Date.now();

  // 1. Check Weight PR
  const weightPR = exercisePRs.find(pr => pr.type === 'weight');
  if (!weightPR || set.weight > weightPR.value) {
    detectedTypes.push('weight');
    newRecords.push({
      exerciseId: set.exerciseId,
      exerciseName,
      type: 'weight',
      value: set.weight,
      secondaryValue: set.reps,
      achievedAt: now,
      sessionId: set.sessionId,
    });
  }

  // 2. Check Rep PR at this specific weight
  const repPR = exercisePRs.find(
    pr => pr.type === 'reps_at_weight' && Math.abs((pr.secondaryValue || 0) - set.weight) < 0.2
  );
  if (!repPR || set.reps > repPR.value) {
    // Only record if not redundant with weight PR
    if (!detectedTypes.includes('weight')) {
      detectedTypes.push('reps_at_weight');
      newRecords.push({
        exerciseId: set.exerciseId,
        exerciseName,
        type: 'reps_at_weight',
        value: set.reps,
        secondaryValue: set.weight,
        achievedAt: now,
        sessionId: set.sessionId,
      });
    }
  }

  // 3. Check Estimated 1RM PR
  const est1RM = calculateEst1RM(set.weight, set.reps);
  const oneRMPR = exercisePRs.find(pr => pr.type === 'est_1rm');
  if (!oneRMPR || est1RM > oneRMPR.value) {
    detectedTypes.push('est_1rm');
    newRecords.push({
      exerciseId: set.exerciseId,
      exerciseName,
      type: 'est_1rm',
      value: est1RM,
      secondaryValue: set.weight,
      achievedAt: now,
      sessionId: set.sessionId,
    });
  }

  return {
    isPR: detectedTypes.length > 0,
    types: detectedTypes,
    newRecords,
  };
}

export interface ProgressionSuggestion {
  targetWeight: number;
  targetRepsMin: number;
  targetRepsMax: number;
  reason: string;
  previousBestWeight?: number;
  previousBestReps?: number;
}

/**
 * Transparent progressive overload recommendation:
 * - If last session all working sets hit the top of the rep range -> suggest incrementing weight (+2.5 kg).
 * - If last session was near bottom of rep range -> suggest keeping weight and aiming for +1 rep.
 * - Always transparent and sensible.
 */
export function suggestProgression(
  previousSets: SessionSet[],
  targetRepsMin: number = 8,
  targetRepsMax: number = 10,
  weightStep: number = 2.5
): ProgressionSuggestion {
  const completedWorkingSets = previousSets.filter(s => s.isCompleted && s.type !== 'warmup');

  if (completedWorkingSets.length === 0) {
    return {
      targetWeight: 0,
      targetRepsMin,
      targetRepsMax,
      reason: 'First session. Select a comfortable starting weight to establish your baseline.',
    };
  }

  const lastSet = completedWorkingSets[completedWorkingSets.length - 1];
  const avgReps = completedWorkingSets.reduce((sum, s) => sum + s.reps, 0) / completedWorkingSets.length;
  const maxWeight = Math.max(...completedWorkingSets.map(s => s.weight));

  // If user completed sets at or above upper rep target
  if (avgReps >= targetRepsMax) {
    const nextWeight = maxWeight + weightStep;
    return {
      targetWeight: nextWeight,
      targetRepsMin,
      targetRepsMax,
      reason: `Hit target reps (${Math.round(avgReps)}) last session. Recommended increase: +${weightStep} kg.`,
      previousBestWeight: maxWeight,
      previousBestReps: Math.round(avgReps),
    };
  }

  // If user was within range, hold weight and build reps
  return {
    targetWeight: maxWeight,
    targetRepsMin,
    targetRepsMax,
    reason: `Target ${avgReps < targetRepsMin ? 'hitting' : 'repeating'} ${targetRepsMin}-${targetRepsMax} reps with ${maxWeight} kg before increasing weight.`,
    previousBestWeight: maxWeight,
    previousBestReps: lastSet.reps,
  };
}
