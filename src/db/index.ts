import Dexie, { type Table } from 'dexie';
import { 
  Exercise, 
  WorkoutTemplate, 
  WeeklyScheduleEntry, 
  WorkoutSession, 
  SessionSet, 
  PersonalRecord, 
  Supplement, 
  SupplementLog, 
  BodyMeasurement, 
  UserSettings 
} from '../types';
import { 
  DEFAULT_EXERCISES, 
  DEFAULT_TEMPLATES, 
  DEFAULT_WEEKLY_SCHEDULE, 
  DEFAULT_SUPPLEMENTS 
} from './seed';

export class GymBuddyDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  weeklySchedule!: Table<WeeklyScheduleEntry, number>;
  workoutSessions!: Table<WorkoutSession, string>;
  sessionSets!: Table<SessionSet, string>;
  personalRecords!: Table<PersonalRecord, string>;
  supplements!: Table<Supplement, string>;
  supplementLogs!: Table<SupplementLog, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('GymBuddyDB');

    this.version(1).stores({
      exercises: 'id, name, muscleGroup, equipment, isCustom',
      workoutTemplates: 'id, name, category, createdAt',
      weeklySchedule: 'dayIndex, templateId',
      workoutSessions: 'id, templateId, status, startedAt, completedAt',
      sessionSets: 'id, sessionId, exerciseId, setIndex, isCompleted',
      personalRecords: 'id, exerciseId, type, achievedAt, sessionId',
      supplements: 'id, timing, isActive, createdAt',
      supplementLogs: 'id, dateStr, supplementId, [dateStr+supplementId]',
      bodyMeasurements: 'id, dateStr, recordedAt',
      settings: 'key',
    });
  }
}

export const db = new GymBuddyDatabase();

export const DEFAULT_SETTINGS: UserSettings = {
  units: 'kg',
  theme: 'dark',
  defaultRestSeconds: 90,
  soundEnabled: true,
  hapticsEnabled: true,
  autoStartTimer: true,
  activeSessionId: null,
  experienceLevel: 'intermediate',
  isOnboarded: true,
};

/**
 * Initializes database with starter seeds if not already populated
 */
export async function initDatabase(): Promise<void> {
  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    await db.transaction('rw', [
      db.exercises, 
      db.workoutTemplates, 
      db.weeklySchedule, 
      db.supplements, 
      db.settings
    ], async () => {
      await db.exercises.bulkPut(DEFAULT_EXERCISES);
      await db.workoutTemplates.bulkPut(DEFAULT_TEMPLATES);
      await db.weeklySchedule.bulkPut(DEFAULT_WEEKLY_SCHEDULE);
      await db.supplements.bulkPut(DEFAULT_SUPPLEMENTS);
      await db.settings.put({ key: 'user_settings', value: DEFAULT_SETTINGS });
    });
  }
}

export async function getUserSettings(): Promise<UserSettings> {
  const row = await db.settings.get('user_settings');
  if (row && row.value) {
    return { ...DEFAULT_SETTINGS, ...(row.value as UserSettings) };
  }
  return DEFAULT_SETTINGS;
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings();
  const updated: UserSettings = { ...current, ...settings };
  await db.settings.put({ key: 'user_settings', value: updated });
  return updated;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  workoutTemplates: WorkoutTemplate[];
  weeklySchedule: WeeklyScheduleEntry[];
  workoutSessions: WorkoutSession[];
  sessionSets: SessionSet[];
  personalRecords: PersonalRecord[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  bodyMeasurements: BodyMeasurement[];
  settings: UserSettings;
}

/**
 * Full JSON export of all user data
 */
export async function exportAllData(): Promise<string> {
  const [
    exercises,
    workoutTemplates,
    weeklySchedule,
    workoutSessions,
    sessionSets,
    personalRecords,
    supplements,
    supplementLogs,
    bodyMeasurements,
    settings,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.workoutTemplates.toArray(),
    db.weeklySchedule.toArray(),
    db.workoutSessions.toArray(),
    db.sessionSets.toArray(),
    db.personalRecords.toArray(),
    db.supplements.toArray(),
    db.supplementLogs.toArray(),
    db.bodyMeasurements.toArray(),
    getUserSettings(),
  ]);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    workoutTemplates,
    weeklySchedule,
    workoutSessions,
    sessionSets,
    personalRecords,
    supplements,
    supplementLogs,
    bodyMeasurements,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Safe restore of user data from JSON
 */
export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as Partial<BackupPayload>;

  await db.transaction('rw', [
    db.exercises,
    db.workoutTemplates,
    db.weeklySchedule,
    db.workoutSessions,
    db.sessionSets,
    db.personalRecords,
    db.supplements,
    db.supplementLogs,
    db.bodyMeasurements,
    db.settings,
  ], async () => {
    if (data.exercises && data.exercises.length) {
      await db.exercises.clear();
      await db.exercises.bulkAdd(data.exercises);
    }
    if (data.workoutTemplates && data.workoutTemplates.length) {
      await db.workoutTemplates.clear();
      await db.workoutTemplates.bulkAdd(data.workoutTemplates);
    }
    if (data.weeklySchedule && data.weeklySchedule.length) {
      await db.weeklySchedule.clear();
      await db.weeklySchedule.bulkAdd(data.weeklySchedule);
    }
    if (data.workoutSessions) {
      await db.workoutSessions.clear();
      if (data.workoutSessions.length) await db.workoutSessions.bulkAdd(data.workoutSessions);
    }
    if (data.sessionSets) {
      await db.sessionSets.clear();
      if (data.sessionSets.length) await db.sessionSets.bulkAdd(data.sessionSets);
    }
    if (data.personalRecords) {
      await db.personalRecords.clear();
      if (data.personalRecords.length) await db.personalRecords.bulkAdd(data.personalRecords);
    }
    if (data.supplements) {
      await db.supplements.clear();
      if (data.supplements.length) await db.supplements.bulkAdd(data.supplements);
    }
    if (data.supplementLogs) {
      await db.supplementLogs.clear();
      if (data.supplementLogs.length) await db.supplementLogs.bulkAdd(data.supplementLogs);
    }
    if (data.bodyMeasurements) {
      await db.bodyMeasurements.clear();
      if (data.bodyMeasurements.length) await db.bodyMeasurements.bulkAdd(data.bodyMeasurements);
    }
    if (data.settings) {
      await db.settings.put({ key: 'user_settings', value: data.settings });
    }
  });
}

/**
 * Resets database to fresh starter state
 */
export async function resetAllData(): Promise<void> {
  await db.transaction('rw', [
    db.exercises,
    db.workoutTemplates,
    db.weeklySchedule,
    db.workoutSessions,
    db.sessionSets,
    db.personalRecords,
    db.supplements,
    db.supplementLogs,
    db.bodyMeasurements,
    db.settings,
  ], async () => {
    await db.exercises.clear();
    await db.workoutTemplates.clear();
    await db.weeklySchedule.clear();
    await db.workoutSessions.clear();
    await db.sessionSets.clear();
    await db.personalRecords.clear();
    await db.supplements.clear();
    await db.supplementLogs.clear();
    await db.bodyMeasurements.clear();
    await db.settings.clear();

    await db.exercises.bulkPut(DEFAULT_EXERCISES);
    await db.workoutTemplates.bulkPut(DEFAULT_TEMPLATES);
    await db.weeklySchedule.bulkPut(DEFAULT_WEEKLY_SCHEDULE);
    await db.supplements.bulkPut(DEFAULT_SUPPLEMENTS);
    await db.settings.put({ key: 'user_settings', value: DEFAULT_SETTINGS });
  });
}
