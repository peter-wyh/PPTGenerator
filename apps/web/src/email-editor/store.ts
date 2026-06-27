import { create } from 'zustand'
import type { EmailData } from '@ppt-generator/shared'
import { defaultEmailData } from './defaultData'

type Path = (string | number)[]

function setAtPath(obj: unknown, path: Path, value: string): unknown {
  if (path.length === 0) return value
  const [head, ...rest] = path
  if (Array.isArray(obj)) {
    const next = obj.slice()
    next[head as number] = setAtPath(obj[head as number], rest, value)
    return next
  }
  return { ...(obj as object), [head]: setAtPath((obj as Record<string, unknown>)[head as string], rest, value) }
}

interface EmailEditorState {
  data: EmailData
  setField: (path: Path, value: string) => void
  reset: () => void
}

export const useEmailEditorStore = create<EmailEditorState>((set) => ({
  data: structuredClone(defaultEmailData),
  setField: (path, value) => set((s) => ({ data: setAtPath(s.data, path, value) as EmailData })),
  reset: () => set({ data: structuredClone(defaultEmailData) }),
}))
