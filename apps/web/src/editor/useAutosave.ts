import { useEffect, useRef } from 'react'
import { useEditorStore } from './store'
import { api } from '../api/client'

export function useAutosave() {
  const pages = useEditorStore((s) => s.pages)
  const projectId = useEditorStore((s) => s.projectId)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaveStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await api.patch(`/projects/${projectId}`, { pages })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pages, projectId, setSaveStatus])
}
