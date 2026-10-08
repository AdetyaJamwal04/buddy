import React, { useState, useEffect } from 'react';
import { initDatabase } from './db';
import { SettingsProvider } from './context/SettingsContext';
import { WorkoutProvider, useWorkout } from './context/WorkoutContext';
import { AppLayout, TabType } from './components/layout/AppLayout';
import { TodayView } from './views/TodayView';
import { WorkoutsView } from './views/WorkoutsView';
import { ProgressView } from './views/ProgressView';
import { SupplementsView } from './views/SupplementsView';
import { ProfileView } from './views/ProfileView';
import { LiveWorkoutView } from './views/LiveWorkoutView';

const MainApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('today');
  const [isLiveWorkoutOpen, setIsLiveWorkoutOpen] = useState(false);
  const { activeSession } = useWorkout();

  // If there is an active session and user hasn't explicitly navigated away,
  // allow quick one-tap toggle between live workout and background app
  const handleOpenLive = () => {
    setIsLiveWorkoutOpen(true);
  };

  const handleBackToApp = () => {
    setIsLiveWorkoutOpen(false);
  };

  if (isLiveWorkoutOpen) {
    return (
      <div className="min-h-dvh bg-[#0D0E11] text-[#F3F4F6] max-w-4xl mx-auto px-4 pt-safe pb-safe">
        <LiveWorkoutView onBackToApp={handleBackToApp} />
      </div>
    );
  }

  return (
    <AppLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      onOpenLiveWorkout={handleOpenLive}
    >
      {currentTab === 'today' && (
        <TodayView
          onStartLiveWorkout={handleOpenLive}
          onNavigateToWorkouts={() => setCurrentTab('workouts')}
          onNavigateToProgress={() => setCurrentTab('progress')}
        />
      )}
      {currentTab === 'workouts' && (
        <WorkoutsView onStartLiveWorkout={handleOpenLive} />
      )}
      {currentTab === 'progress' && <ProgressView />}
      {currentTab === 'supplements' && <SupplementsView />}
      {currentTab === 'profile' && <ProfileView />}
    </AppLayout>
  );
};

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
      } catch (err) {
        console.error('Failed to initialize database', err);
      } finally {
        setDbReady(true);
      }
    }
    init();
  }, []);

  if (!dbReady) {
    return (
      <div className="min-h-dvh bg-[#0D0E11] flex items-center justify-center text-center p-4">
        <div className="space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider">
            Loading Gym Buddy...
          </p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <WorkoutProvider>
        <MainApp />
      </WorkoutProvider>
    </SettingsProvider>
  );
}
