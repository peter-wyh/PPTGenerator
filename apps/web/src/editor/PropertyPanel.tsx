import { useEditorStore } from './store'
import { Input } from '../components/Input'
import type { TextData, ImageData } from '@ppt-generator/shared'

export function PropertyPanel() {
  const page = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId))
  const selectedId = useEditorStore((s) => s.selectedIds[0])
  const comp = page?.components.find((c) => c.id === selectedId)
  const update = useEditorStore((s) => s.updateComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  if (!comp) return <div className="w-64 border-l border-edge bg-surface p-4 text-sm text-neutral-400">未选中组件</div>

  const data = comp.data as TextData & ImageData
  return (
    <div className="w-64 shrink-0 space-y-3 border-l border-edge bg-surface p-4">
      <div className="text-xs font-bold text-primary">属性</div>
      {comp.type === 'text' && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">文本</span>
            <textarea className="w-full rounded border border-neutral-300 p-2 text-sm" rows={3}
              value={data.content ?? ''} onChange={(e) => update(comp.id, { data: { content: e.target.value } as never })} />
          </label>
          <Input label="字号" type="number" value={data.fontSize ?? 18}
            onChange={(e) => update(comp.id, { data: { fontSize: Number(e.target.value) } as never })} />
          <Input label="颜色" value={data.color ?? '#222'}
            onChange={(e) => update(comp.id, { data: { color: e.target.value } as never })} />
        </>
      )}
      {comp.type === 'image' && (
        <Input label="图片 URL" value={data.src ?? ''}
          onChange={(e) => update(comp.id, { data: { src: e.target.value } as never })} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input label="X" type="number" value={comp.x} onChange={(e) => update(comp.id, { x: Number(e.target.value) })} />
        <Input label="Y" type="number" value={comp.y} onChange={(e) => update(comp.id, { y: Number(e.target.value) })} />
        <Input label="宽" type="number" value={comp.w} onChange={(e) => update(comp.id, { w: Number(e.target.value) })} />
        <Input label="高" type="number" value={comp.h} onChange={(e) => update(comp.id, { h: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
        onClick={() => remove(comp.id)}>删除组件</button>
    </div>
  )
}
