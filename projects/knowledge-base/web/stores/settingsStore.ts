import { create } from 'zustand';
import type { PromptVersion } from '../api.ts';

export interface SystemStatus {
  ollama: boolean;
  ytdlp: boolean;
  whisper: boolean;
  pdftotext: boolean;
}

interface SettingsState {
  // User preferences
  lang: string;
  keepTerms: boolean;
  notificationsEnabled: boolean;
  dailyGoal: number;
  weeklyGoal: number;

  // UI state
  saved: boolean;
  loading: boolean;
  devOpen: boolean;
  promptsOpen: boolean;
  summaryPromptsOpen: boolean;
  chatPromptsOpen: boolean;

  // Async status
  clearStatus: string | null;
  rebuildStatus: string | null;
  summaryPromptSaveStatus: string | null;
  chatPromptSaveStatus: string | null;

  // Loaded data
  sysStatus: SystemStatus | null;
  testDataCount: number;
  summaryPrompts: PromptVersion[];
  chatPrompts: PromptVersion[];

  // Draft inputs
  summaryPromptDraft: string;
  chatPromptDraft: string;

  // Actions
  setLang: (lang: string) => void;
  setKeepTerms: (keepTerms: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDailyGoal: (goal: number) => void;
  setWeeklyGoal: (goal: number) => void;
  setSaved: (saved: boolean) => void;
  setLoading: (loading: boolean) => void;
  setDevOpen: (open: boolean) => void;
  setPromptsOpen: (open: boolean) => void;
  setSummaryPromptsOpen: (open: boolean) => void;
  setChatPromptsOpen: (open: boolean) => void;
  setClearStatus: (status: string | null) => void;
  setRebuildStatus: (status: string | null) => void;
  setSummaryPromptSaveStatus: (status: string | null) => void;
  setChatPromptSaveStatus: (status: string | null) => void;
  setSysStatus: (status: SystemStatus | null) => void;
  setTestDataCount: (count: number) => void;
  setSummaryPrompts: (prompts: PromptVersion[]) => void;
  setChatPrompts: (prompts: PromptVersion[]) => void;
  setSummaryPromptDraft: (draft: string) => void;
  setChatPromptDraft: (draft: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Initial state
  lang: 'english',
  keepTerms: true,
  notificationsEnabled: false,
  dailyGoal: 3,
  weeklyGoal: 15,
  saved: false,
  loading: true,
  devOpen: false,
  promptsOpen: false,
  summaryPromptsOpen: false,
  chatPromptsOpen: false,
  clearStatus: null,
  rebuildStatus: null,
  summaryPromptSaveStatus: null,
  chatPromptSaveStatus: null,
  sysStatus: null,
  testDataCount: 0,
  summaryPrompts: [],
  chatPrompts: [],
  summaryPromptDraft: '',
  chatPromptDraft: '',

  // Action handlers
  setLang: (lang) => set({ lang }),
  setKeepTerms: (keepTerms) => set({ keepTerms }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setDailyGoal: (goal) => set({ dailyGoal: goal }),
  setWeeklyGoal: (goal) => set({ weeklyGoal: goal }),
  setSaved: (saved) => set({ saved }),
  setLoading: (loading) => set({ loading }),
  setDevOpen: (open) => set({ devOpen: open }),
  setPromptsOpen: (open) => set({ promptsOpen: open }),
  setSummaryPromptsOpen: (open) => set({ summaryPromptsOpen: open }),
  setChatPromptsOpen: (open) => set({ chatPromptsOpen: open }),
  setClearStatus: (status) => set({ clearStatus: status }),
  setRebuildStatus: (status) => set({ rebuildStatus: status }),
  setSummaryPromptSaveStatus: (status) => set({ summaryPromptSaveStatus: status }),
  setChatPromptSaveStatus: (status) => set({ chatPromptSaveStatus: status }),
  setSysStatus: (status) => set({ sysStatus: status }),
  setTestDataCount: (count) => set({ testDataCount: count }),
  setSummaryPrompts: (prompts) => set({ summaryPrompts: prompts }),
  setChatPrompts: (prompts) => set({ chatPrompts: prompts }),
  setSummaryPromptDraft: (draft) => set({ summaryPromptDraft: draft }),
  setChatPromptDraft: (draft) => set({ chatPromptDraft: draft }),
}));
