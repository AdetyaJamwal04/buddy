import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Sun, 
  Moon, 
  Zap, 
  Utensils 
} from 'lucide-react';
import { db } from '../db';
import { Supplement, SupplementLog, SupplementTiming } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { sound } from '../utils/audio';

export const SupplementsView: React.FC = () => {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [todayLogs, setTodayLogs] = useState<SupplementLog[]>([]);
  const [weekAdherence, setWeekAdherence] = useState<{ totalTaken: number; totalPossible: number; pct: number }>({ totalTaken: 0, totalPossible: 0, pct: 0 });
  const [adherenceBySup, setAdherenceBySup] = useState<Record<string, { takenDays: number; totalDays: number }>>({});

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supDosage, setSupDosage] = useState('');
  const [supTiming, setSupTiming] = useState<SupplementTiming>('morning');
  const [supNotes, setSupNotes] = useState('');

  const todayDateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadSupplements();
  }, []);

  async function loadSupplements() {
    try {
      const all: Supplement[] = await db.supplements.toArray();
      setSupplements(all);

      const logs: SupplementLog[] = await db.supplementLogs.where('dateStr').equals(todayDateStr).toArray();
      setTodayLogs(logs);

      // Compute last 7 days adherence
      const now = new Date();
      const past7Dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        past7Dates.push(d.toISOString().split('T')[0]);
      }

      const past7Logs: SupplementLog[] = await db.supplementLogs.where('dateStr').anyOf(past7Dates).toArray();

      const activeList = all.filter((s: Supplement) => s.isActive);
      const totalPossible = activeList.length * 7;
      const totalTaken = past7Logs.length;
      const pct = totalPossible > 0 ? Math.round((totalTaken / totalPossible) * 100) : 0;
      setWeekAdherence({ totalTaken, totalPossible, pct });

      // Breakdown per supplement
      const supBreakdown: Record<string, { takenDays: number; totalDays: number }> = {};
      for (const s of activeList) {
        const takenCount = new Set(past7Logs.filter((l: SupplementLog) => l.supplementId === s.id).map((l: SupplementLog) => l.dateStr)).size;
        supBreakdown[s.id] = { takenDays: takenCount, totalDays: 7 };
      }
      setAdherenceBySup(supBreakdown);
    } catch (err) {
      console.error('Failed to load supplements', err);
    }
  }

  const toggleTake = async (supplementId: string) => {
    sound.triggerHaptic([15]);
    const existing = todayLogs.find(l => l.supplementId === supplementId);
    if (existing) {
      await db.supplementLogs.delete(existing.id);
      setTodayLogs(prev => prev.filter(l => l.id !== existing.id));
    } else {
      sound.playSetCompleted();
      const newLog: SupplementLog = {
        id: `suplog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        supplementId,
        dateStr: todayDateStr,
        takenAt: Date.now(),
      };
      await db.supplementLogs.add(newLog);
      setTodayLogs(prev => [...prev, newLog]);
    }
    loadSupplements();
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setSupName('');
    setSupDosage('');
    setSupTiming('morning');
    setSupNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplement) => {
    setEditingId(s.id);
    setSupName(s.name);
    setSupDosage(s.dosage);
    setSupTiming(s.timing);
    setSupNotes(s.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveSupplement = async () => {
    if (!supName.trim() || !supDosage.trim()) return;

    const id = editingId || `sup_${Date.now()}`;
    const item: Supplement = {
      id,
      name: supName.trim(),
      dosage: supDosage.trim(),
      timing: supTiming,
      notes: supNotes.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    };

    await db.supplements.put(item);
    setIsModalOpen(false);
    await loadSupplements();
  };

  const handleDeleteSupplement = async (id: string) => {
    await db.supplements.delete(id);
    await db.supplementLogs.where('supplementId').equals(id).delete();
    await loadSupplements();
  };

  const timingGroups: { key: SupplementTiming; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'morning', label: 'Morning', icon: Sun },
    { key: 'pre_workout', label: 'Pre-Workout', icon: Zap },
    { key: 'post_workout', label: 'Post-Workout', icon: Zap },
    { key: 'with_food', label: 'With Meals', icon: Utensils },
    { key: 'night', label: 'Night / Before Sleep', icon: Moon },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#F3F4F6]">Supplement Tracker</h2>
          <p className="text-xs text-[#9CA3AF]">Daily protocol schedule and adherence history</p>
        </div>
        <Button onClick={handleOpenAdd} size="sm" className="gap-1 text-xs">
          <Plus className="w-4 h-4" />
          Add Supplement
        </Button>
      </div>

      {/* 7-Day Adherence Metric Card */}
      <Card className="p-4 bg-[#14171E] border-[#222733] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8E95A5] block">
            THIS WEEK ADHERENCE
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-numeric font-bold text-2xl text-emerald-400">
              {weekAdherence.pct}%
            </span>
            <span className="text-xs text-[#9CA3AF]">
              ({weekAdherence.totalTaken} / {weekAdherence.totalPossible} doses completed)
            </span>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-full sm:w-48 bg-[#1B202A] h-2.5 rounded-full overflow-hidden border border-[#272F3E]">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${weekAdherence.pct}%` }}
          />
        </div>
      </Card>

      {/* Grouped Daily Schedule */}
      <div className="space-y-4">
        {timingGroups.map(grp => {
          const groupSups = supplements.filter(s => s.timing === grp.key && s.isActive);
          if (groupSups.length === 0) return null;

          const Icon = grp.icon;

          return (
            <div key={grp.key} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8E95A5] px-1">
                <Icon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{grp.label}</span>
              </div>

              <Card className="p-2.5 bg-[#14171E] border-[#222733] divide-y divide-[#1D222D]">
                {groupSups.map(sup => {
                  const isTaken = todayLogs.some(l => l.supplementId === sup.id);
                  const adherence = adherenceBySup[sup.id];

                  return (
                    <div
                      key={sup.id}
                      className="p-2.5 rounded-xl flex items-center justify-between gap-3 hover:bg-[#181C26] transition-colors"
                    >
                      {/* Left: Checkmark & Info */}
                      <div 
                        onClick={() => toggleTake(sup.id)}
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                      >
                        <button
                          type="button"
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                            isTaken 
                              ? 'bg-emerald-500 text-black font-bold' 
                              : 'border border-[#384152] text-transparent hover:border-emerald-400'
                          }`}
                        >
                          {isTaken && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div>
                          <h4 className={`text-xs font-bold ${isTaken ? 'line-through text-[#6B7280]' : 'text-[#F3F4F6]'}`}>
                            {sup.name}
                          </h4>
                          <p className="text-[11px] text-[#9CA3AF]">
                            {sup.dosage}
                            {sup.notes && <span className="ml-1 text-[#6B7280]">· {sup.notes}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Right: 7-day adherence stat & edit */}
                      <div className="flex items-center gap-3">
                        {adherence && (
                          <span className="text-[11px] font-numeric text-[#8E95A5] hidden sm:block">
                            {adherence.takenDays}/7 days
                          </span>
                        )}
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          className="p-1 rounded-md text-[#8E95A5] hover:text-[#F3F4F6] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Supplement Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Supplement' : 'Add Supplement'}
        subtitle="Manage daily timing and dose"
      >
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
              Supplement Name
            </label>
            <input
              type="text"
              value={supName}
              onChange={e => setSupName(e.target.value)}
              placeholder="e.g. Creatine Monohydrate"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
              Dosage & Unit
            </label>
            <input
              type="text"
              value={supDosage}
              onChange={e => setSupDosage(e.target.value)}
              placeholder="e.g. 5g or 2 capsules or 400mg"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
              Timing
            </label>
            <select
              value={supTiming}
              onChange={e => setSupTiming(e.target.value as SupplementTiming)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] focus:outline-none cursor-pointer"
            >
              <option value="morning">Morning (with meal)</option>
              <option value="pre_workout">Pre-Workout</option>
              <option value="post_workout">Post-Workout</option>
              <option value="with_food">With Meals</option>
              <option value="night">Night (Before Bed)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider block">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={supNotes}
              onChange={e => setSupNotes(e.target.value)}
              placeholder="e.g. Take with 500ml water"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1217] border border-[#252A36] text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="pt-3 border-t border-[#202532] flex items-center justify-between">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  handleDeleteSupplement(editingId);
                  setIsModalOpen(false);
                }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveSupplement} disabled={!supName || !supDosage}>
                Save Supplement
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
