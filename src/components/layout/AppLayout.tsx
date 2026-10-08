import React from 'react';
import { 
  Calendar, 
  Dumbbell, 
  TrendingUp, 
  Pill, 
  User, 
  WifiOff, 
  Play,
  Timer
} from 'lucide-react';
import { useWorkout } from '../../context/WorkoutContext';
import { useSettings } from '../../context/SettingsContext';
import { RestTimerHUD } from '../ui/RestTimerHUD';
import { PRNotification } from '../ui/PRBadge';
import { WorkoutSummaryModal } from '../ui/WorkoutSummaryModal';

export type TabType = 'today' | 'workouts' | 'progress' | 'supplements' | 'profile';

interface AppLayoutProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenLiveWorkout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  onOpenLiveWorkout,
  children,
}) => {
  const { activeSession, elapsedSeconds, sessionPRs, summaryData, closeSummary } = useWorkout();
  const { isOnline } = useSettings();

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'supplements', label: 'Supplements', icon: Pill },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[#0D0E11] text-[#F3F4F6]">
      {/* Desktop Navigation Sidebar (md+) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#12151B] border-r border-[#222733] shrink-0 p-5 select-none">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#F3F4F6]">GYM BUDDY</h1>
            <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider block">Offline-First</span>
          </div>
        </div>

        {/* Active Workout Banner in Desktop Sidebar */}
        {activeSession && (
          <div 
            onClick={onOpenLiveWorkout}
            className="mb-6 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 cursor-pointer hover:bg-emerald-950/60 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                TRAINING NOW
              </span>
              <span className="font-numeric">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <p className="text-sm font-bold text-[#F3F4F6] truncate">{activeSession.name}</p>
          </div>
        )}

        <nav className="space-y-1.5 flex-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#1C212B] text-emerald-400 font-semibold border border-[#2B3342]'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#181B22]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-[#9CA3AF]'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {!isOnline && (
          <div className="mt-auto pt-4 border-t border-[#222733] flex items-center gap-2 text-xs text-amber-400">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline — Saving to device</span>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        {/* Top Header Mobile & Status Bar */}
        <header className="sticky top-0 z-30 bg-[#0D0E11]/90 backdrop-blur-md border-b border-[#1E232E] pt-safe px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="md:hidden w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#F3F4F6]">GYM BUDDY</span>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}

            {/* In-Progress Pill on Mobile Header */}
            {activeSession && (
              <button
                onClick={onOpenLiveWorkout}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-transform"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-numeric">{formatElapsed(elapsedSeconds)}</span>
                <span className="text-[11px] font-normal text-emerald-300">Resume</span>
              </button>
            )}
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (iPhone Safari Safe Area) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#12151B]/95 backdrop-blur-lg border-t border-[#222733] pb-safe">
          <div className="grid grid-cols-5 h-16 items-center px-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex flex-col items-center justify-center h-full gap-1 transition-colors select-none ${
                    isActive ? 'text-emerald-400 font-semibold' : 'text-[#8E95A5] hover:text-[#D1D5DB]'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-[#8E95A5]'}`} />
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Floating Rest Timer HUD */}
      <RestTimerHUD />

      {/* PR Celebration Banner */}
      <PRNotification prs={sessionPRs} onDismiss={() => {}} />

      {/* Workout Completion Summary Modal */}
      {summaryData && (
        <WorkoutSummaryModal data={summaryData} onClose={closeSummary} />
      )}
    </div>
  );
};
