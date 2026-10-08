import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Plus, 
  Scale, 
  ChevronDown
} from 'lucide-react';
import { db } from '../db';
import { 
  PersonalRecord, 
  WorkoutSession, 
  SessionSet, 
  Exercise, 
  BodyMeasurement 
} from '../types';
import { useSettings } from '../context/SettingsContext';
import { calculateEst1RM } from '../utils/calculations';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumericStepper } from '../components/ui/NumericStepper';

export const ProgressView: React.FC = () => {
  const { formatWeightValue, unit } = useSettings();

  const [activeTab, setActiveTab] = useState<'strength' | 'prs' | 'volume' | 'body'>('strength');

  // Strength chart state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('ex_bench_press');
  const [exerciseHistoryPoints, setExerciseHistoryPoints] = useState<{ date: string; maxWeight: number; est1RM: number }[]>([]);
  const [timeRange, setTimeRange] = useState<'30D' | '3M' | '1Y' | 'ALL'>('3M');

  // PRs state
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  // Volume & Consistency state
  const [pastSessions, setPastSessions] = useState<WorkoutSession[]>([]);

  // Body Measurements state
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);
  const [isLogBodyModalOpen, setIsLogBodyModalOpen] = useState(false);
  const [inputWeight, setInputWeight] = useState<number>(75);
  const [inputWaist, setInputWaist] = useState<number>(82);
  const [inputChest, setInputChest] = useState<number>(100);
  const [inputArms, setInputArms] = useState<number>(38);
  const [inputBodyFat, setInputBodyFat] = useState<number>(15);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedExerciseId) {
      loadExerciseHistory(selectedExerciseId);
    }
  }, [selectedExerciseId, timeRange]);

  async function loadData() {
    try {
      const allEx = await db.exercises.toArray();
      setExercises(allEx);

      const allPRs = await db.personalRecords.reverse().sortBy('achievedAt');
      setRecords(allPRs);

      const sessions = await db.workoutSessions
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('completedAt');
      setPastSessions(sessions);

      const measurements = await db.bodyMeasurements.orderBy('dateStr').toArray();
      setBodyMeasurements(measurements);
      if (measurements.length > 0) {
        const last = measurements[measurements.length - 1];
        if (last.weightKg) setInputWeight(last.weightKg);
        if (last.waistCm) setInputWaist(last.waistCm);
        if (last.chestCm) setInputChest(last.chestCm);
        if (last.armsCm) setInputArms(last.armsCm);
        if (last.bodyFatPct) setInputBodyFat(last.bodyFatPct);
      }
    } catch (err) {
      console.error('Failed to load progress data', err);
    }
  }

  async function loadExerciseHistory(exerciseId: string) {
    try {
      const sets: SessionSet[] = await db.sessionSets
        .where('exerciseId')
        .equals(exerciseId)
        .and((s: SessionSet) => s.isCompleted && s.type !== 'warmup' && s.weight > 0)
        .toArray();

      if (sets.length === 0) {
        setExerciseHistoryPoints([]);
        return;
      }

      const sessionIds = Array.from(new Set(sets.map((s: SessionSet) => s.sessionId)));
      const sessions = await db.workoutSessions.where('id').anyOf(sessionIds).toArray();
      const sessionMap = new Map<string, WorkoutSession>(sessions.map((s: WorkoutSession) => [s.id, s]));

      const pointsMap = new Map<string, { maxWeight: number; est1RM: number; timestamp: number }>();

      for (const set of sets) {
        const sess = sessionMap.get(set.sessionId);
        if (!sess || !sess.completedAt) continue;

        const dateKey = new Date(sess.completedAt).toISOString().split('T')[0];
        const oneRM = calculateEst1RM(set.weight, set.reps);
        const current = pointsMap.get(dateKey) || { maxWeight: 0, est1RM: 0, timestamp: sess.completedAt };

        if (set.weight > current.maxWeight) current.maxWeight = set.weight;
        if (oneRM > current.est1RM) current.est1RM = oneRM;
        pointsMap.set(dateKey, current);
      }

      let points = Array.from(pointsMap.entries()).map(([date, val]) => ({
        date,
        maxWeight: val.maxWeight,
        est1RM: val.est1RM,
        timestamp: val.timestamp,
      }));

      points.sort((a, b) => a.timestamp - b.timestamp);

      const now = Date.now();
      if (timeRange === '30D') {
        const cutoff = now - 30 * 24 * 3600 * 1000;
        points = points.filter(p => p.timestamp >= cutoff);
      } else if (timeRange === '3M') {
        const cutoff = now - 90 * 24 * 3600 * 1000;
        points = points.filter(p => p.timestamp >= cutoff);
      } else if (timeRange === '1Y') {
        const cutoff = now - 365 * 24 * 3600 * 1000;
        points = points.filter(p => p.timestamp >= cutoff);
      }

      setExerciseHistoryPoints(points);
    } catch (err) {
      console.error('Error loading exercise progression', err);
    }
  }

  const handleSaveBodyMeasurement = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newRecord: BodyMeasurement = {
      id: `meas_${Date.now()}`,
      dateStr: todayStr,
      recordedAt: Date.now(),
      weightKg: inputWeight,
      waistCm: inputWaist,
      chestCm: inputChest,
      armsCm: inputArms,
      bodyFatPct: inputBodyFat,
    };

    await db.bodyMeasurements.put(newRecord);
    setIsLogBodyModalOpen(false);
    await loadData();
  };

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

  const renderStrengthChart = () => {
    if (exerciseHistoryPoints.length < 2) {
      return (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#10131A] rounded-xl border border-[#202532] text-xs text-[#8E95A5]">
          <TrendingUp className="w-8 h-8 text-[#4B5563] mb-2" />
          <p className="font-semibold text-[#D1D5DB]">Need at least 2 logged sessions</p>
          <p className="text-[11px] mt-0.5">Log this exercise across sessions to visualize 1RM and weight trend.</p>
        </div>
      );
    }

    const padding = 24;
    const width = 360;
    const height = 160;

    const values = exerciseHistoryPoints.map(p => p.maxWeight);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.05;
    const range = maxVal - minVal || 1;

    const coords = exerciseHistoryPoints.map((p, idx) => {
      const x = padding + (idx / (exerciseHistoryPoints.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p.maxWeight - minVal) / range) * (height - padding * 2);
      return { x, y, ...p };
    });

    const pathData = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

    return (
      <div className="bg-[#10131A] border border-[#202532] rounded-xl p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#222836" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#222836" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#222836" />

          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <path
            d={`${pathData} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`}
            fill="url(#chartGrad)"
          />

          <path
            d={pathData}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="#10B981" stroke="#0D0E11" strokeWidth="2" />
            </g>
          ))}
        </svg>

        <div className="flex justify-between items-center text-[10px] text-[#8E95A5] pt-2 px-1 font-numeric">
          <span>{exerciseHistoryPoints[0].date}</span>
          <span>{exerciseHistoryPoints[exerciseHistoryPoints.length - 1].date}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#F3F4F6]">Progress & Metrics</h2>
        <p className="text-xs text-[#9CA3AF]">Strength adaptation, personal records, and volume</p>
      </div>

      <div className="flex p-1 bg-[#13161E] border border-[#232936] rounded-xl">
        <button
          onClick={() => setActiveTab('strength')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'strength'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344]'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Strength
        </button>
        <button
          onClick={() => setActiveTab('prs')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'prs'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344]'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          PRs ({records.length})
        </button>
        <button
          onClick={() => setActiveTab('volume')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'volume'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344]'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Volume
        </button>
        <button
          onClick={() => setActiveTab('body')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'body'
              ? 'bg-[#1F2430] text-emerald-400 border border-[#2B3344]'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
          }`}
        >
          Body
        </button>
      </div>

      {activeTab === 'strength' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <select
                value={selectedExerciseId}
                onChange={e => setSelectedExerciseId(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-[#14171E] border border-[#252A36] text-xs font-semibold text-[#F3F4F6] focus:outline-none pr-9 cursor-pointer"
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A5] pointer-events-none" />
            </div>

            <div className="flex gap-1 bg-[#10131A] p-0.5 rounded-lg border border-[#212634]">
              {(['30D', '3M', '1Y', 'ALL'] as const).map(tr => (
                <button
                  key={tr}
                  onClick={() => setTimeRange(tr)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    timeRange === tr 
                      ? 'bg-[#1C212B] text-emerald-400' 
                      : 'text-[#8E95A5] hover:text-[#D1D5DB]'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>

          <Card className="p-4 sm:p-5 bg-[#14171E] border-[#222733] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8E95A5] uppercase tracking-wider font-semibold">
                  HEAVIEST WORKING WEIGHT
                </span>
                <h4 className="text-base font-bold text-[#F3F4F6]">
                  {selectedExercise?.name}
                </h4>
              </div>

              {exerciseHistoryPoints.length > 0 && (
                <div className="text-right">
                  <span className="text-[10px] text-[#8E95A5] uppercase tracking-wider font-semibold">
                    Current Best
                  </span>
                  <p className="font-numeric font-bold text-lg text-emerald-400">
                    {formatWeightValue(exerciseHistoryPoints[exerciseHistoryPoints.length - 1].maxWeight)}
                  </p>
                </div>
              )}
            </div>

            {renderStrengthChart()}

            {exerciseHistoryPoints.length > 0 && (
              <div className="p-3 rounded-xl bg-[#0F1217] border border-[#202532] flex items-center justify-between text-xs">
                <span className="text-[#9CA3AF]">
                  Latest Estimated 1RM (Epley formula):
                </span>
                <span className="font-numeric font-bold text-emerald-300">
                  {formatWeightValue(exerciseHistoryPoints[exerciseHistoryPoints.length - 1].est1RM)}
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'prs' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#F3F4F6]">Personal Records Directory</h3>
            <p className="text-xs text-[#9CA3AF]">All-time heaviest lifts and repetition benchmarks</p>
          </div>

          {records.length === 0 ? (
            <Card className="p-8 text-center bg-[#13161E] border-[#202530] space-y-2">
              <Trophy className="w-10 h-10 text-[#4B5563] mx-auto" />
              <h4 className="text-sm font-bold text-[#F3F4F6]">No records logged yet</h4>
              <p className="text-xs text-[#8E95A5]">
                Complete sets in your workouts to automatically earn Weight and 1RM records.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {records.map(pr => {
                const dateStr = new Date(pr.achievedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                const badgeMap: Record<string, string> = {
                  weight: 'Heaviest Weight',
                  reps_at_weight: 'Rep Record',
                  est_1rm: 'Estimated 1RM',
                  volume: 'Volume Record',
                };

                return (
                  <Card key={pr.id} className="p-3.5 bg-[#14171E] border-[#222733] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                        {badgeMap[pr.type] || 'Record'}
                      </span>
                      <span className="text-[10px] text-[#8E95A5] font-numeric">{dateStr}</span>
                    </div>

                    <h4 className="text-sm font-bold text-[#F3F4F6] truncate">
                      {pr.exerciseName || 'Exercise'}
                    </h4>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-numeric font-bold text-base text-amber-300">
                        {pr.value} {pr.type === 'reps_at_weight' ? 'reps' : 'kg'}
                        {pr.secondaryValue && pr.type === 'weight' && (
                          <span className="text-xs text-[#9CA3AF] font-normal"> × {pr.secondaryValue} reps</span>
                        )}
                      </span>
                      <Trophy className="w-4 h-4 text-amber-400/60" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'volume' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#F3F4F6]">Volume & Consistency</h3>
            <p className="text-xs text-[#9CA3AF]">Cumulative tonnage and training density</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-[#14171E] border-[#222733] text-center space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8E95A5] font-semibold">
                Completed Workouts
              </span>
              <p className="font-numeric font-bold text-2xl text-emerald-400">
                {pastSessions.length}
              </p>
            </Card>

            <Card className="p-4 bg-[#14171E] border-[#222733] text-center space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8E95A5] font-semibold">
                Total Volume Lifted
              </span>
              <p className="font-numeric font-bold text-xl text-[#F3F4F6]">
                {pastSessions.reduce((sum, s) => sum + s.totalVolumeKg, 0) >= 1000
                  ? `${(pastSessions.reduce((sum, s) => sum + s.totalVolumeKg, 0) / 1000).toFixed(1)} tonnes`
                  : `${pastSessions.reduce((sum, s) => sum + s.totalVolumeKg, 0)} kg`}
              </p>
            </Card>
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase font-semibold text-[#8E95A5] tracking-wider">
              Recent Session Volumes
            </span>
            <div className="space-y-2">
              {pastSessions.slice(0, 10).map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-[#14171E] border border-[#222733] flex items-center justify-between text-xs">
                  <div>
                    <h5 className="font-bold text-[#F3F4F6]">{s.name}</h5>
                    <span className="text-[10px] text-[#8E95A5] font-numeric">
                      {new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {s.totalSets} sets
                    </span>
                  </div>
                  <span className="font-numeric font-bold text-emerald-400">
                    {s.totalVolumeKg >= 1000 ? `${(s.totalVolumeKg / 1000).toFixed(2)} t` : `${s.totalVolumeKg} kg`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'body' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#F3F4F6]">Body & Weight Log</h3>
              <p className="text-xs text-[#9CA3AF]">Private local biometric tracking</p>
            </div>
            <Button onClick={() => setIsLogBodyModalOpen(true)} size="sm" className="gap-1 text-xs">
              <Plus className="w-4 h-4" />
              Log Measurement
            </Button>
          </div>

          {bodyMeasurements.length === 0 ? (
            <Card className="p-8 text-center bg-[#13161E] border-[#202530] space-y-2">
              <Scale className="w-10 h-10 text-[#4B5563] mx-auto" />
              <h4 className="text-sm font-bold text-[#F3F4F6]">No body measurements yet</h4>
              <p className="text-xs text-[#8E95A5]">
                Track bodyweight, waist, and arms over time to monitor physique composition.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {bodyMeasurements.slice().reverse().map(m => (
                <Card key={m.id} className="p-3.5 bg-[#14171E] border-[#222733] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-numeric font-semibold text-[#8E95A5]">{m.dateStr}</span>
                    {m.weightKg && (
                      <span className="font-numeric font-bold text-emerald-400 text-sm">
                        {formatWeightValue(m.weightKg)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-[11px] text-[#9CA3AF] font-numeric border-t border-[#1F2532]">
                    {m.waistCm && <div>Waist: <span className="text-[#F3F4F6] font-semibold">{m.waistCm} cm</span></div>}
                    {m.chestCm && <div>Chest: <span className="text-[#F3F4F6] font-semibold">{m.chestCm} cm</span></div>}
                    {m.armsCm && <div>Arms: <span className="text-[#F3F4F6] font-semibold">{m.armsCm} cm</span></div>}
                    {m.bodyFatPct && <div>BF: <span className="text-[#F3F4F6] font-semibold">{m.bodyFatPct}%</span></div>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Measurement Modal */}
      <Modal
        isOpen={isLogBodyModalOpen}
        onClose={() => setIsLogBodyModalOpen(false)}
        title="Log Body Metrics"
        subtitle="Saved locally on your device"
      >
        <div className="space-y-3 pt-1">
          <div>
            <span className="text-xs font-semibold text-[#8E95A5] block">Body Weight ({unit})</span>
            <NumericStepper
              value={inputWeight}
              onChange={setInputWeight}
              step={0.5}
              min={30}
              max={300}
              className="w-full mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-semibold text-[#8E95A5] block">Waist (cm)</span>
              <NumericStepper
                value={inputWaist}
                onChange={setInputWaist}
                step={0.5}
                min={40}
                max={200}
                className="w-full mt-1"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#8E95A5] block">Chest (cm)</span>
              <NumericStepper
                value={inputChest}
                onChange={setInputChest}
                step={0.5}
                min={40}
                max={200}
                className="w-full mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-semibold text-[#8E95A5] block">Arms (cm)</span>
              <NumericStepper
                value={inputArms}
                onChange={setInputArms}
                step={0.5}
                min={20}
                max={80}
                className="w-full mt-1"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#8E95A5] block">Body Fat (%)</span>
              <NumericStepper
                value={inputBodyFat}
                onChange={setInputBodyFat}
                step={0.5}
                min={3}
                max={60}
                className="w-full mt-1"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#202532] flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsLogBodyModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBodyMeasurement}>
              Save Measurement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
