import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { 
  db, 
  initDatabase, 
  getUserSettings, 
  saveUserSettings, 
  exportAllData, 
  importData, 
  resetAllData 
} from './index';

describe('Local Database & Offline Persistence Tests', () => {
  beforeEach(async () => {
    await resetAllData();
  });

  it('initializes and seeds default exercises, templates, schedule, and supplements', async () => {
    await initDatabase();

    const exerciseCount = await db.exercises.count();
    expect(exerciseCount).toBeGreaterThanOrEqual(25);

    const templateCount = await db.workoutTemplates.count();
    expect(templateCount).toBeGreaterThanOrEqual(4);

    const scheduleCount = await db.weeklySchedule.count();
    expect(scheduleCount).toBe(7);

    const supplementCount = await db.supplements.count();
    expect(supplementCount).toBeGreaterThanOrEqual(5);

    const settings = await getUserSettings();
    expect(settings.units).toBe('kg');
    expect(settings.defaultRestSeconds).toBe(90);
  });

  it('updates and persists user settings cleanly', async () => {
    await initDatabase();

    await saveUserSettings({ units: 'lb', defaultRestSeconds: 120 });
    const updated = await getUserSettings();
    expect(updated.units).toBe('lb');
    expect(updated.defaultRestSeconds).toBe(120);
  });

  it('exports and restores full user database via JSON format', async () => {
    await initDatabase();

    // Add a custom exercise
    await db.exercises.add({
      id: 'ex_test_custom',
      name: 'Test Landmine Press',
      muscleGroup: 'shoulders',
      equipment: 'barbell',
      defaultRestSeconds: 90,
      isCustom: true,
    });

    const exportedJson = await exportAllData();
    expect(exportedJson).toContain('Test Landmine Press');

    const parsed = JSON.parse(exportedJson);
    expect(parsed.version).toBe(1);
    expect(parsed.exercises.length).toBeGreaterThan(20);

    // Reset database to wipe custom exercise
    await resetAllData();
    const exAfterReset = await db.exercises.get('ex_test_custom');
    expect(exAfterReset).toBeUndefined();

    // Restore from exported JSON
    await importData(exportedJson);
    const restored = await db.exercises.get('ex_test_custom');
    expect(restored).toBeDefined();
    expect(restored?.name).toBe('Test Landmine Press');
  });

  it('rejects invalid or corrupted backup payloads gracefully', async () => {
    // Malformed JSON
    await expect(importData('not json')).rejects.toThrow('Invalid JSON');

    // Missing version or recognizable tables
    await expect(importData(JSON.stringify({ hello: 'world' }))).rejects.toThrow('Invalid backup file');
    await expect(importData(JSON.stringify({ version: 1 }))).rejects.toThrow('No recognizable Gym Buddy data detected');
  });
});
