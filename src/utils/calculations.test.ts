import { describe, it, expect } from 'vitest';
import { 
  calculateEst1RM, 
  calculateVolume, 
  kgToLb, 
  lbToKg, 
  formatWeight, 
  evaluatePRs, 
  suggestProgression 
} from './calculations';
import { SessionSet, PersonalRecord } from '../types';

describe('Calculations Utility', () => {
  it('calculates estimated 1RM using Epley formula correctly', () => {
    // 100kg for 1 rep should be 100kg
    expect(calculateEst1RM(100, 1)).toBe(100);

    // 100kg for 10 reps: 100 * (1 + 10/30) = 133.3 kg
    expect(calculateEst1RM(100, 10)).toBe(133.3);

    // 60kg for 5 reps: 60 * (1 + 5/30) = 70.0 kg
    expect(calculateEst1RM(60, 5)).toBe(70);

    // edge cases
    expect(calculateEst1RM(0, 10)).toBe(0);
    expect(calculateEst1RM(100, 0)).toBe(0);
  });

  it('converts between kg and lb accurately', () => {
    expect(kgToLb(100)).toBe(220.5);
    expect(lbToKg(220.5)).toBe(100);

    expect(formatWeight(82.5, 'kg')).toBe('82.5 kg');
    expect(formatWeight(80, 'kg')).toBe('80 kg');
    expect(formatWeight(100, 'lb')).toBe('220.5 lb');
  });

  it('calculates total completed volume', () => {
    const sets = [
      { weight: 100, reps: 8, isCompleted: true },
      { weight: 100, reps: 8, isCompleted: true },
      { weight: 100, reps: 6, isCompleted: false }, // skipped set
    ];
    // (100 * 8) + (100 * 8) = 1600 kg
    expect(calculateVolume(sets)).toBe(1600);
  });

  it('detects new personal records correctly', () => {
    const existingPRs: PersonalRecord[] = [
      {
        id: 'pr_1',
        exerciseId: 'ex_bench',
        type: 'weight',
        value: 80,
        secondaryValue: 8,
        achievedAt: 1000,
        sessionId: 's1',
      },
      {
        id: 'pr_2',
        exerciseId: 'ex_bench',
        type: 'est_1rm',
        value: 101.3,
        achievedAt: 1000,
        sessionId: 's1',
      },
    ];

    const newSet: SessionSet = {
      id: 'set_1',
      sessionId: 's2',
      exerciseId: 'ex_bench',
      setIndex: 1,
      type: 'normal',
      weight: 85,
      reps: 8,
      isCompleted: true,
    };

    const result = evaluatePRs(newSet, 'Barbell Bench Press', existingPRs);
    expect(result.isPR).toBe(true);
    expect(result.types).toContain('weight');
    expect(result.types).toContain('est_1rm');
    expect(result.newRecords.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores warmup sets and uncompleted sets for PR detection', () => {
    const existingPRs: PersonalRecord[] = [];
    const warmupSet: SessionSet = {
      id: 'set_w',
      sessionId: 's1',
      exerciseId: 'ex_bench',
      setIndex: 1,
      type: 'warmup',
      weight: 120,
      reps: 10,
      isCompleted: true,
    };

    const res1 = evaluatePRs(warmupSet, 'Bench Press', existingPRs);
    expect(res1.isPR).toBe(false);

    const uncompletedSet: SessionSet = {
      ...warmupSet,
      type: 'normal',
      isCompleted: false,
    };
    const res2 = evaluatePRs(uncompletedSet, 'Bench Press', existingPRs);
    expect(res2.isPR).toBe(false);
  });

  it('suggests progressive overload transparently based on previous performance', () => {
    // Case 1: user hit max target reps on all sets -> suggest +2.5 kg
    const successfulSets: SessionSet[] = [
      { id: '1', sessionId: 's1', exerciseId: 'ex_1', setIndex: 1, type: 'normal', weight: 80, reps: 10, isCompleted: true },
      { id: '2', sessionId: 's1', exerciseId: 'ex_1', setIndex: 2, type: 'normal', weight: 80, reps: 10, isCompleted: true },
    ];
    const suggestion1 = suggestProgression(successfulSets, 8, 10, 2.5);
    expect(suggestion1.targetWeight).toBe(82.5);
    expect(suggestion1.reason).toContain('+2.5 kg');

    // Case 2: user was at bottom of rep range -> suggest staying at current weight
    const developingSets: SessionSet[] = [
      { id: '3', sessionId: 's1', exerciseId: 'ex_1', setIndex: 1, type: 'normal', weight: 80, reps: 8, isCompleted: true },
      { id: '4', sessionId: 's1', exerciseId: 'ex_1', setIndex: 2, type: 'normal', weight: 80, reps: 7, isCompleted: true },
    ];
    const suggestion2 = suggestProgression(developingSets, 8, 10, 2.5);
    expect(suggestion2.targetWeight).toBe(80);
    expect(suggestion2.reason).toContain('80 kg before increasing weight');
  });
});
