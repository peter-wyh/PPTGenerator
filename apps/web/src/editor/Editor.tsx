import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { getProject } from '../api/projects'
import { Toolbar } from './Toolbar'
import { PageList } from './PageList'
import { Canvas } from './Canvas'
import { PropertyPanel } from './PropertyPanel'
import { useAutosave } from './useAutosave'

export default function Editor({ projectId }: { projectId: string }) {
  const [error, setError] = useState('')
  const load = useEditorStore((s) => s.load)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  useAutosave()

  useEffect(() => {
    getProject(projectId)
      .then((p) => load(p))
      .catch(() => setError('项目不存在或无权访问'))
  }, [projectId, load])

  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div
        className="flex flex-1 overflow-hidden"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(zoom + e.deltaY * -0.001)
          }
        }}
      >
        <PageList />
        <Canvas />
        <PropertyPanel />
      </div>
    </div>
  )
}
