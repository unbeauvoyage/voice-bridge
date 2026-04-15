import { create } from 'zustand';

interface GlobalsState {
  // Theme
  theme: 'dark' | 'light';

  // Notifications setting
  notificationsOn: boolean;

  // Actions
  setTheme: (theme: 'dark' | 'light') => void;
  setNotificationsOn: (on: boolean) => void;
}

export const useGlobalsStore = create<GlobalsState>((set) => ({
  // Initial state
  theme: 'dark',
  notificationsOn: false,

  // Action handlers
  setTheme: (theme) => set({ theme }),
  setNotificationsOn: (on) => set({ notificationsOn: on }),
}));
