// frontend/src/hooks/useLearnStore.ts
// Zustand global state for DeutschA1 platform

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProgress {
  lessonId: number;
  completed: boolean;
  score: number;
  wordsKnown: number[];
}

interface LearnState {
  // Auth
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;

  // Progress (local fallback)
  progress: Record<number, UserProgress>;
  markLessonDone: (lessonId: number, score: number) => void;
  markWordKnown: (lessonId: number, wordId: number) => void;

  // UI state
  currentLesson: number | null;
  setCurrentLesson: (id: number | null) => void;
  quizMode: 'multiple_choice' | 'typing' | 'listening';
  setQuizMode: (mode: 'multiple_choice' | 'typing' | 'listening') => void;
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),

      progress: {},
      markLessonDone: (lessonId, score) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [lessonId]: {
              ...(s.progress[lessonId] || { wordsKnown: [] }),
              lessonId,
              completed: score >= 70,
              score,
            },
          },
        })),
      markWordKnown: (lessonId, wordId) =>
        set((s) => {
          const prev = s.progress[lessonId] || { lessonId, completed: false, score: 0, wordsKnown: [] };
          const already = prev.wordsKnown.includes(wordId);
          return {
            progress: {
              ...s.progress,
              [lessonId]: {
                ...prev,
                wordsKnown: already ? prev.wordsKnown : [...prev.wordsKnown, wordId],
              },
            },
          };
        }),

      currentLesson: null,
      setCurrentLesson: (id) => set({ currentLesson: id }),
      quizMode: 'multiple_choice',
      setQuizMode: (mode) => set({ quizMode: mode }),
    }),
    { name: 'deutsch-a1-store' }
  )
);

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiGet(path: string, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path: string, body: any, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
