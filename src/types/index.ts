export type MuscleGroup = 
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio';

export type Equipment = 
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'smith_machine'
  | 'kettlebell'
  | 'bands'
  | 'other';

export type MovementPattern = 
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'isolation'
  | 'carry';

export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: string[];
  equipment: Equipment;
  movementPattern?: MovementPattern;
  instructions?: string;
  defaultRestSeconds: number;
  isCustom?: boolean;
  notes?: string;
}

export interface TemplateExercise {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe?: number;
  restSeconds: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  category: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom';
  description?: string;
  exercises: TemplateExercise[];
  estimatedMinutes?: number;
  createdAt: number;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Mon, 6=Sun

export interface WeeklyScheduleEntry {
  dayIndex: DayOfWeek;
  dayName: string; // 'Monday', etc.
  templateId: string | null; // null represents Rest Day
  customLabel?: string;
}

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';

export interface SessionSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number; // 1-indexed
  type: SetType;
  weight: number; // Stored in kg canonically
  reps: number;
  rpe?: number;
  isCompleted: boolean;
  completedAt?: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  startedAt: number;
  completedAt?: number;
  durationSeconds: number;
  status: 'in_progress' | 'completed' | 'discarded';
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  prCount: number;
  notes?: string;
  rating?: number; // 1 to 5
}

export type PRType = 'weight' | 'reps_at_weight' | 'est_1rm' | 'volume';

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  type: PRType;
  value: number; // e.g. 100 kg or 12 reps or 120 kg 1RM
  secondaryValue?: number; // e.g. reps if weight PR, weight if rep PR
  achievedAt: number;
  sessionId: string;
  exerciseName?: string;
}

export type SupplementTiming = 'morning' | 'pre_workout' | 'post_workout' | 'night' | 'with_food';

export interface Supplement {
  id: string;
  name: string;
  dosage: string; // e.g. '5g' or '2 capsules'
  timing: SupplementTiming;
  daysOfWeek?: number[]; // [0,1,2,3,4,5,6]
  notes?: string;
  isActive: boolean;
  createdAt: number;
}

export interface SupplementLog {
  id: string;
  supplementId: string;
  dateStr: string; // YYYY-MM-DD
  takenAt: number;
}

export interface BodyMeasurement {
  id: string;
  dateStr: string; // YYYY-MM-DD
  recordedAt: number;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  thighsCm?: number;
  bodyFatPct?: number;
  notes?: string;
}

export interface UserSettings {
  units: WeightUnit;
  theme: ThemeMode;
  defaultRestSeconds: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  autoStartTimer: boolean;
  activeSessionId?: string | null;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  isOnboarded: boolean;
}
