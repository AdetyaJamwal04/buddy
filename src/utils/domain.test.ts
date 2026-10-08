import { describe, it, expect } from 'vitest';
import { 
  calculateVolume, 
  evaluatePRs, 
  suggestProgression, 
  calculateEst1RM,
  kgToLb,
  lbToKg
} from './calculations';
import { SessionSet, PersonalRecord } from '../types';

describe('Domain Rules & Safety Tests', () => {
  it('Epley formula calculates 1RM with high precision', () => {
    // 140kg for 3 reps: 140 * (1 + 3/30) = 140 * 1.1 = 154kg
    expect(calculateEst1RM(140, 3)).toBe(154);

    // 80kg for 8 reps: 80 * (1 + 8/30) = 80 * 1.2666 = 101.3kg
    expect(calculateEst1RM(80, 8)).toBe(101.3);
  });

  it('Unit conversion is symmetric and accurate within 0.1 lb/kg', () => {
    const testWeights = [20, 60, 82.5, 100, 142.5, 220];
    testWeights.forEach(kg => {
      const lb = kgToLb(kg);
      const backToKg = lbToKg(lb);
      expect(Math.abs(backToKg - kg)).toBeLessThanOrEqual(0.1);
    });
  });

  it('Volume calculation accounts only for completed non-zero sets', () => {
    const sets: { weight: number; reps: number; isCompleted: boolean }[] = [
      { weight: 100, reps: 5, isCompleted: true },
      { weight: 100, reps: 5, isCompleted: true },
      { weight: 100, reps: 5, isCompleted: false }, // not completed
      { weight: 0, reps: 10, isCompleted: true },   // zero weight
    ];
    // 500 + 500 = 1000
    expect(calculateVolume(sets)).toBe(1000);
  });

  it('Personal record engine recognizes volume and rep records without false positives', () => {
    const existingPRs: PersonalRecord[] = [
      {
        id: '1',
        exerciseId: 'ex_squat',
        type: 'weight',
        value: 120,
        secondaryValue: 5,
        achievedAt: 100,
        sessionId: 's1',
      },
    ];

    // Lift lighter than PR weight (100kg < 120kg) -> no weight PR
    const setBelow: SessionSet = {
      id: 's_sub',
      sessionId: 's2',
      exerciseId: 'ex_squat',
      setIndex: 1,
      type: 'normal',
      weight: 100,
      reps: 5,
      isCompleted: true,
    };
    const resBelow = evaluatePRs(setBelow, 'Squat', existingPRs);
    expect(resBelow.types).not.toContain('weight');

    // Lift heavier than PR weight (125kg > 120kg) -> new Weight PR!
    const setAbove: SessionSet = {
      id: 's_super',
      sessionId: 's2',
      exerciseId: 'ex_squat',
      setIndex: 2,
      type: 'normal',
      weight: 125,
      reps: 5,
      isCompleted: true,
    };
    const resAbove = evaluatePRs(setAbove, 'Squat', existingPRs);
    expect(resAbove.isPR).toBe(true);
    expect(resAbove.types).toContain('weight');
  });

  it('Progressive overload recommendation suggests sensible next target', () => {
    // 4 sets of 8 reps when target was 6-8 -> user capped rep range -> recommend +2.5kg
    const completedSets: SessionSet[] = [
      { id: '1', sessionId: 's1', exerciseId: 'ex_ohp', setIndex: 1, type: 'normal', weight: 50, reps: 8, isCompleted: true },
      { id: '2', sessionId: 's1', exerciseId: 'ex_ohp', setIndex: 2, type: 'normal', weight: 50, reps: 8, isCompleted: true },
      { id: '3', sessionId: 's1', exerciseId: 'ex_ohp', setIndex: 3, type: 'normal', weight: 50, reps: 8, isCompleted: true },
    ];

    const recommendation = suggestProgression(completedSets, 6, 8, 2.5);
    expect(recommendation.targetWeight).toBe(52.5);
    expect(recommendation.reason).toContain('+2.5 kg');
  });
});
