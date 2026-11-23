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
  return Math.round(displayValue * 10) / 10;
}

/**
 * Converts stored canonical weight (kg) to display value in user's unit
 */
export function displayWeight(weightKg: number, unit: WeightUnit = 'kg'): number {
  if (unit === 'lb') {
    return kgToLb(weightKg);
  }
  return Math.round(weightKg * 10) / 10;
}

/**
 * Converts user display input to canonical stored weight in kg
 */
export function storeWeight(displayVal: number, unit: WeightUnit = 'kg'): number {
  return parseWeightInput(displayVal, unit);
}

/**
 * Format personal record value respecting user unit preference
 */
export function formatPRValue(
  pr: { type: PRType; value: number; secondaryValue?: number },
  unit: WeightUnit = 'kg'
): string {
  if (pr.type === 'reps_at_weight') {
    return `${pr.value} reps`;
  }
  return formatWeight(pr.value, unit);
}

/**
 * Format volume respecting user unit preference
 */
export function formatVolume(volumeKg: number, unit: WeightUnit = 'kg'): string {
  if (unit === 'lb') {
    const totalLb = Math.round(kgToLb(volumeKg));
    return `${totalLb.toLocaleString()} lb`;
  }
  if (volumeKg >= 1000) {
    return `${(volumeKg / 1000).toFixed(2)} tonnes`;
  }
  return `${Math.round(volumeKg * 10) / 10} kg`;
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

  // 1. Check Weight PR: compare against highest all-time recorded weight
  const weightPRs = exercisePRs.filter(pr => pr.type === 'weight');
  const maxWeightPR = weightPRs.length > 0 ? Math.max(...weightPRs.map(pr => pr.value)) : null;
  if (maxWeightPR === null || set.weight > maxWeightPR) {
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
  // A set is only a rep PR if the user has NOT previously performed >= reps at >= weight.
  const hasSuperiorOrEqualPerformance = exercisePRs.some(pr => {
    let prWeight = 0;
    let prReps = 0;
    if (pr.type === 'weight') {
      prWeight = pr.value;
      prReps = pr.secondaryValue || 1;
    } else if (pr.type === 'reps_at_weight') {
      prReps = pr.value;
      prWeight = pr.secondaryValue || 0;
    }
    return prWeight >= set.weight - 0.2 && prReps >= set.reps;
  });

  const matchingRepPRs = exercisePRs.filter(
    pr => pr.type === 'reps_at_weight' && Math.abs((pr.secondaryValue || 0) - set.weight) < 0.2
  );
  const maxRepPRAtWeight = matchingRepPRs.length > 0 ? Math.max(...matchingRepPRs.map(pr => pr.value)) : 0;

  if (!hasSuperiorOrEqualPerformance && set.reps > maxRepPRAtWeight) {
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
  const oneRMPRs = exercisePRs.filter(pr => pr.type === 'est_1rm');
  const maxOneRMPR = oneRMPRs.length > 0 ? Math.max(...oneRMPRs.map(pr => pr.value)) : null;
  if (maxOneRMPR === null || est1RM > maxOneRMPR) {
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
