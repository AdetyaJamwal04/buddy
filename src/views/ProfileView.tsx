import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  Smartphone, 
  Plus, 
  Search,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { db, exportAllData, importData, resetAllData } from '../db';
import { Exercise, MuscleGroup, Equipment } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { sound } from '../utils/audio';

export const ProfileView: React.FC = () => {
  const { settings, updateSettings, unit } = useSettings();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchExercise, setSearchExercise] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('chest');
  const [newExEquip, setNewExEquip] = useState<Equipment>('barbell');
  const [newExRest, setNewExRest] = useState<number>(90);

  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    const list: Exercise[] = await db.exercises.toArray();
    setExercises(list);
  }

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym-buddy-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('Backup exported successfully');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch {
      setBackupStatus('Export failed');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importData(text);
      sound.playPRAchieved();
      setBackupStatus('Data restored successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setBackupStatus('Invalid backup file. Could not restore.');
    }
  };

  const handleResetData = async () => {
    await resetAllData();
    setShowResetConfirm(false);
    window.location.reload();
  };

  const handleCreateExercise = async () => {
    if (!newExName.trim()) return;

    const newEx: Exercise = {
      id: `ex_custom_${Date.now()}`,
      name: newExName.trim(),
      muscleGroup: newExMuscle,
      equipment: newExEquip,
      defaultRestSeconds: newExRest,
      isCustom: true,
    };

    await db.exercises.put(newEx);
    setIsAddExerciseOpen(false);
    setNewExName('');
    await loadExercises();
  };

  const filteredExercises = exercises.filter((e: Exercise) => {
    const matchSearch = e.name.toLowerCase().includes(searchExercise.toLowerCase());
    const matchMuscle = selectedMuscle === 'all' || e.muscleGroup === selectedMuscle;
    return matchSearch && matchMuscle;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#F3F4F6]">Profile & Settings</h2>
        <p className="text-xs text-[#9CA3AF]">Preferences, exercise database, and data safety</p>
      </div>

      {/* TRAINING PREFERENCES */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
          TRAINING PREFERENCES
        </span>
        <Card className="p-4 bg-[#14171E] border-[#222733] divide-y divide-[#1D222E]">
          {/* Unit selection: kg vs lb */}
          <div className="pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[#F3F4F6]">Weight Unit</h4>
              <p className="text-xs text-[#9CA3AF]">Kilograms (kg) or Pounds (lb)</p>
            </div>
            <div className="flex bg-[#0F1217] p-1 rounded-xl border border-[#252A36]">
              <button
                onClick={() => updateSettings({ units: 'kg' })}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  unit === 'kg' ? 'bg-emerald-500 text-black' : 'text-[#8E95A5] hover:text-[#F3F4F6]'
                }`}
              >
                kg
              </button>
              <button
                onClick={() => updateSettings({ units: 'lb' })}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  unit === 'lb' ? 'bg-emerald-500 text-black' : 'text-[#8E95A5] hover:text-[#F3F4F6]'
                }`}
              >
                lb
              </button>
            </div>
          </div>

          {/* Default rest timer duration */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[#F3F4F6]">Default Rest Timer</h4>
              <p className="text-xs text-[#9CA3AF]">Auto-countdown between working sets</p>
            </div>
            <div className="flex gap-1">
              {[60, 90, 120, 180].map(sec => (
                <button
                  key={sec}
                  onClick={() => updateSettings({ defaultRestSeconds: sec })}
                  className={`px-2.5 py-1 text-xs font-numeric font-semibold rounded-lg border transition-colors ${
                    settings.defaultRestSeconds === sec
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#181C26] border-[#252B38] text-[#8E95A5] hover:text-[#F3F4F6]'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Audio Chimes */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[#F3F4F6]">Sound Feedback</h4>
              <p className="text-xs text-[#9CA3AF]">Rest timer alarm & PR chimes</p>
            </div>
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.soundEnabled ? 'bg-emerald-500' : 'bg-[#262C38]'
              }`}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Haptic Vibration */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[#F3F4F6]">Haptic Vibrations</h4>
              <p className="text-xs text-[#9CA3AF]">Tactile pulse on set completion</p>
            </div>
            <button
              onClick={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.hapticsEnabled ? 'bg-emerald-500' : 'bg-[#262C38]'
              }`}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>
      </div>

      {/* EXERCISE DATABASE BROWSER */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
            EXERCISE DATABASE ({exercises.length})
          </span>
          <Button onClick={() => setIsAddExerciseOpen(true)} size="sm" variant="ghost" className="text-xs text-emerald-400 gap-1 h-7">
            <Plus className="w-3.5 h-3.5" />
            Add Custom Exercise
          </Button>
        </div>

        <Card className="p-4 bg-[#14171E] border-[#222733] space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E95A5]" />
              <input
                type="text"
                value={searchExercise}
                onChange={e => setSearchExercise(e.target.value)}
                placeholder="Search movements..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none"
              />
            </div>
            <select
              value={selectedMuscle}
              onChange={e => setSelectedMuscle(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] focus:outline-none capitalize"
            >
              <option value="all">All Muscles</option>
              <option value="chest">Chest</option>
              <option value="back">Back</option>
              <option value="legs">Legs</option>
              <option value="shoulders">Shoulders</option>
              <option value="arms">Arms</option>
              <option value="core">Core</option>
            </select>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {filteredExercises.map(ex => (
              <div key={ex.id} className="p-2.5 rounded-lg bg-[#181C25] border border-[#222733] flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[#F3F4F6]">{ex.name}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#8E95A5]">
                    <span className="capitalize">{ex.muscleGroup}</span>
                    <span>·</span>
                    <span className="capitalize">{ex.equipment}</span>
                  </div>
                </div>
                {ex.isCustom && <Badge variant="outline">Custom</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* PWA & IPHONE INSTALL GUIDE */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
          PWA & OFFLINE INSTALL
        </span>
        <Card 
          onClick={() => setIsInstallGuideOpen(true)}
          className="p-4 bg-[#14171E] border-[#222733] hover:border-emerald-500/40 cursor-pointer transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#F3F4F6]">Install to iPhone Home Screen</h4>
              <p className="text-xs text-[#9CA3AF]">Run fullscreen with instant offline launch</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-[#8E95A5]" />
        </Card>
      </div>

      {/* DATA SAFETY & PORTABILITY */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8E95A5]">
          DATA SAFETY & PORTABILITY
        </span>
        <Card className="p-4 bg-[#14171E] border-[#222733] space-y-3">
          <p className="text-xs text-[#9CA3AF]">
            Gym Buddy stores 100% of your data privately on this device via IndexedDB. Export a JSON backup anytime or restore your history on any phone.
          </p>

          {backupStatus && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center">
              {backupStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button onClick={handleExport} variant="secondary" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Export Backup (JSON)
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Restore Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-2 border-t border-[#1F2532] flex justify-between items-center">
            <span className="text-xs text-[#8E95A5]">Factory reset application</span>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              Reset All Data
            </button>
          </div>
        </Card>
      </div>

      {/* About Footer */}
      <div className="text-center pt-4 pb-2 text-[11px] text-[#6B7280] space-y-1">
        <p>Gym Buddy · Offline-First Progressive Web App</p>
        <p>Local IndexedDB · Service Worker Active · v1.0.0</p>
      </div>

      {/* Add Custom Exercise Modal */}
      <Modal
        isOpen={isAddExerciseOpen}
        onClose={() => setIsAddExerciseOpen(false)}
        title="Add Custom Exercise"
        subtitle="Create a personalized movement"
      >
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
              Exercise Name
            </label>
            <input
              type="text"
              value={newExName}
              onChange={e => setNewExName(e.target.value)}
              placeholder="e.g. Bulgarian Split Squat"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
                Primary Muscle
              </label>
              <select
                value={newExMuscle}
                onChange={e => setNewExMuscle(e.target.value as MuscleGroup)}
                className="w-full px-3 py-2 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] focus:outline-none capitalize"
              >
                <option value="chest">Chest</option>
                <option value="back">Back</option>
                <option value="legs">Legs</option>
                <option value="shoulders">Shoulders</option>
                <option value="arms">Arms</option>
                <option value="core">Core</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
                Equipment
              </label>
              <select
                value={newExEquip}
                onChange={e => setNewExEquip(e.target.value as Equipment)}
                className="w-full px-3 py-2 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] focus:outline-none capitalize"
              >
                <option value="barbell">Barbell</option>
                <option value="dumbbell">Dumbbell</option>
                <option value="cable">Cable</option>
                <option value="machine">Machine</option>
                <option value="bodyweight">Bodyweight</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#202532]">
            <Button variant="outline" onClick={() => setIsAddExerciseOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateExercise} disabled={!newExName.trim()}>
              Save Exercise
            </Button>
          </div>
        </div>
      </Modal>

      {/* iPhone PWA Install Walkthrough Modal */}
      <Modal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
        title="Add Gym Buddy to iPhone"
        subtitle="3-step native standalone installation"
      >
        <div className="space-y-4 pt-2 text-xs leading-relaxed text-[#D1D5DB]">
          <div className="p-3.5 rounded-xl bg-[#0F1217] border border-[#252A36] space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <p>Open this page in <strong>Safari</strong> on your iPhone.</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <p>Tap the <strong>Share</strong> button (the square with an arrow pointing up at the bottom of Safari).</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <p>Scroll down and tap <strong>"Add to Home Screen"</strong>, then tap <strong>"Add"</strong> in the top-right corner.</p>
            </div>
          </div>

          <p className="text-[11px] text-[#9CA3AF] text-center">
            Gym Buddy will launch full-screen with no browser address bar and works 100% offline without cellular data!
          </p>

          <Button onClick={() => setIsInstallGuideOpen(false)} className="w-full">
            Got it
          </Button>
        </div>
      </Modal>

      {/* Reset Confirmation Dialog */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Data?"
        subtitle="Destructive action"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>This will delete all custom workouts, logs, PRs, and supplements, resetting to factory state.</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetData}>
              Yes, Reset Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
