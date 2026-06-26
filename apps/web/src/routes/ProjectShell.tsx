import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { ProjectDetail } from '@ppt-generator/shared'
import { getProject } from '../api/projects'
import { Button } from '../components/Button'

export default function ProjectShell() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getProject(id).then(setProject).catch(() => setError('项目不存在或无权访问'))
  }, [id])

  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!project) return <div className="p-6 text-neutral-500">加载中…</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/projects" className="text-sm text-primary hover:underline">← 返回项目列表</Link>
      <h1 className="mt-2 text-2xl font-bold">{project.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        画布 {project.canvasWidth}×{project.canvasHeight} · 共 {project.pages.length} 页
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-edge bg-surface p-10 text-center text-neutral-500">
        🎨 编辑器即将上线（下一期）
      </div>
      <div className="mt-4">
        <Button disabled>进入编辑器</Button>
      </div>
    </div>
  )
}
