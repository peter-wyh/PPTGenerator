import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectSummary } from '@ppt-generator/shared'
import { listProjects, createProject, updateProject, deleteProject } from '../api/projects'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { ConfirmDialog } from '../components/ConfirmDialog'

export default function Projects() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await listProjects())
    } catch {
      setError('加载项目失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    const name = newName.trim()
    if (!name) return
    const p = await createProject(name)
    setNewName('')
    setCreating(false)
    setItems((prev) => [p, ...prev.filter((x) => x.id !== p.id)])
  }

  async function onRename() {
    if (!renameId) return
    const name = renameVal.trim()
    if (!name) return
    await updateProject(renameId, { name })
    setItems((prev) => prev.map((x) => (x.id === renameId ? { ...x, name } : x)))
    setRenameId(null)
  }

  async function onDelete() {
    if (!deleteId) return
    await deleteProject(deleteId)
    setItems((prev) => prev.filter((x) => x.id !== deleteId))
    setDeleteId(null)
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">我的项目</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/email-editor')}>邮件编辑器</Button>
          <Button onClick={() => setCreating(true)}>+ 新建项目</Button>
        </div>
      </div>

      {creating && (
        <div className="mb-4 flex gap-2 rounded-lg border border-edge bg-surface p-3">
          <Input className="flex-1" placeholder="项目名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={onCreate} disabled={!newName.trim()}>创建</Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>取消</Button>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">加载中…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-neutral-500">还没有项目，点「新建项目」创建第一个。</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-edge bg-surface p-4 shadow-sm">
            {renameId === p.id ? (
              <div className="flex gap-2">
                <Input className="flex-1" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
                <Button onClick={onRename} disabled={!renameVal.trim()}>保存</Button>
                <Button variant="ghost" onClick={() => setRenameId(null)}>取消</Button>
              </div>
            ) : (
              <>
                <button className="block w-full text-left" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="truncate font-bold text-neutral-800">{p.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.canvasWidth}×{p.canvasHeight} · 更新 {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </button>
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" onClick={() => { setRenameId(p.id); setRenameVal(p.name) }}>重命名</Button>
                  <Button variant="danger" onClick={() => setDeleteId(p.id)}>删除</Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除项目"
        message="确认删除该项目？此操作不可撤销。"
        confirmText="删除"
        onConfirm={onDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
