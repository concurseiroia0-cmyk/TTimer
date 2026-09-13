// Shared app-level types. Session / DayState / settings live in the engine;
// here we add the persistence schema and activity templates.

import type { DayState, UserSettings } from '../engine/timebank'

export type {
  DayState,
  DeadTimeEntry,
  DeadTimeLabel,
  Session,
  SessionStatus,
  UserSettings,
  WeeklyGoal,
} from '../engine/timebank'

export interface ActivityTemplate {
  id: string
  emoji: string
  name: string
  defaultMinutes: number
  isCustom: boolean
}

export interface AppData {
  schemaVersion: 1
  settings: UserSettings | null
  onboarded: boolean
  days: Record<string, DayState>
  customTemplates: ActivityTemplate[]
  lifetimeInvestedSeconds: number
  completedSessions: number
  /** Set once the settings were migrated to midnight renewal (v1.1 behavior). */
  midnightMigrated?: boolean
}

export const DEFAULT_TEMPLATES: ActivityTemplate[] = [
  { id: 'read', emoji: '📖', name: 'Leitura', defaultMinutes: 30, isCustom: false },
  { id: 'exercise', emoji: '🏋️', name: 'Exercício', defaultMinutes: 45, isCustom: false },
  { id: 'study', emoji: '📚', name: 'Estudo / Curso', defaultMinutes: 60, isCustom: false },
  { id: 'meditate', emoji: '🧘', name: 'Meditação', defaultMinutes: 15, isCustom: false },
  { id: 'journal', emoji: '✍️', name: 'Escrita / Journaling', defaultMinutes: 15, isCustom: false },
  { id: 'project', emoji: '🎯', name: 'Projeto pessoal', defaultMinutes: 60, isCustom: false },
  { id: 'language', emoji: '🗣️', name: 'Idioma', defaultMinutes: 30, isCustom: false },
  { id: 'creative', emoji: '🎨', name: 'Habilidade criativa', defaultMinutes: 45, isCustom: false },
]
