import type { PropertyField } from './blocks/types'
import { useEditorStore } from './store'
import { Input } from '../components/Input'
import { REGISTRY, fallbackBlock } from './blocks'

export function PropertyPanel() {
  const page = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId))
  const selectedId = useEditorStore((s) => s.selectedIds[0])
  const comp = page?.components.find((c) => c.id === selectedId)
  const update = useEditorStore((s) => s.updateComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  if (!comp) return <div className="w-64 border-l border-edge bg-surface p-4 text-sm text-neutral-400">未选中组件</div>

  const def = REGISTRY[comp.type] ?? fallbackBlock
  const setData = (key: string, value: unknown) => update(comp.id, { data: { [key]: value } as never })

  return (
    <div className="w-64 shrink-0 space-y-3 border-l border-edge bg-surface p-4">
      <div className="text-xs font-bold text-primary">属性</div>
      {def.propertySchema.map((field) => (
        <FieldEditor key={field.key} field={field} data={comp.data} onChange={setData} />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Input label="X" type="number" value={comp.x} onChange={(e) => update(comp.id, { x: Number(e.target.value) })} />
        <Input label="Y" type="number" value={comp.y} onChange={(e) => update(comp.id, { y: Number(e.target.value) })} />
        <Input label="宽" type="number" value={comp.w} onChange={(e) => update(comp.id, { w: Number(e.target.value) })} />
        <Input label="高" type="number" value={comp.h} onChange={(e) => update(comp.id, { h: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700" onClick={() => remove(comp.id)}>删除组件</button>
    </div>
  )
}

type DataMap = Record<string, unknown>

function FieldEditor({
  field,
  data,
  onChange,
}: {
  field: PropertyField
  data: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const d = (data as DataMap) ?? {}
  switch (field.kind) {
    case 'textarea':
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">{field.label}</span>
          <textarea
            className="w-full rounded border border-neutral-300 p-2 text-sm"
            rows={3}
            value={(d[field.key] as string) ?? ''}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </label>
      )
    case 'number':
      return (
        <Input
          label={field.label}
          type="number"
          value={(d[field.key] as number) ?? 0}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
        />
      )
    case 'color':
      return (
        <Input
          label={field.label}
          type="color"
          value={(d[field.key] as string) ?? '#000000'}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )
    case 'select': {
      const options = field.options ?? []
      const val = d[field.key]
      const isBool = typeof val === 'boolean'
      const current = isBool ? (val ? options[0] : options[1]) : String(val ?? '')
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">{field.label}</span>
          <select
            className="w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
            value={current}
            onChange={(e) => onChange(field.key, isBool ? e.target.value === options[0] : e.target.value)}
          >
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      )
    }
    case 'list':
      return <ListEditor field={field} data={d} onChange={onChange} />
    case 'table':
      return <TableEditor data={d} onChange={onChange} />
    case 'text':
    default:
      return (
        <Input
          label={field.label}
          value={(d[field.key] as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )
  }
}

function ListEditor({
  field,
  data,
  onChange,
}: {
  field: PropertyField
  data: DataMap
  onChange: (key: string, value: unknown) => void
}) {
  const items = (Array.isArray(data[field.key]) ? data[field.key] : []) as DataMap[]
  const itemFields = field.itemFields ?? []
  const setItem = (i: number, key: string, value: unknown) =>
    onChange(field.key, items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)))
  const addItem = () => {
    const blank: DataMap = {}
    itemFields.forEach((f) => {
      blank[f.key] = f.kind === 'number' ? 0 : f.kind === 'color' ? '#FF5C00' : ''
    })
    onChange(field.key, [...items, blank])
  }
  const removeItem = (i: number) => onChange(field.key, items.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500">{field.label}</div>
      {items.map((it, i) => (
        <div key={i} className="space-y-1 rounded border border-neutral-200 p-2">
          {itemFields.map((f) => (
            <FieldEditor key={f.key} field={f as PropertyField} data={it} onChange={(k, v) => setItem(i, k, v)} />
          ))}
          <button className="text-xs text-red-600" onClick={() => removeItem(i)}>删除</button>
        </div>
      ))}
      <button className="text-xs font-bold text-primary" onClick={addItem}>+ 添加</button>
    </div>
  )
}

function TableEditor({ data, onChange }: { data: DataMap; onChange: (key: string, value: unknown) => void }) {
  const headers = (Array.isArray(data.headers) ? data.headers : []) as string[]
  const rows = (Array.isArray(data.rows) ? data.rows : []) as string[][]
  const setHeader = (i: number, v: string) => onChange('headers', headers.map((h, idx) => (idx === i ? v : h)))
  const addColumn = () => {
    onChange('headers', [...headers, '新列'])
    onChange('rows', rows.map((r) => [...r, '']))
  }
  const removeColumn = (i: number) => {
    onChange('headers', headers.filter((_, idx) => idx !== i))
    onChange('rows', rows.map((r) => r.filter((_, idx) => idx !== i)))
  }
  const setCell = (ri: number, ci: number, v: string) =>
    onChange('rows', rows.map((r, idx) => (idx === ri ? r.map((c, j) => (j === ci ? v : c)) : r)))
  const addRow = () => onChange('rows', [...rows, headers.map(() => '')])
  const removeRow = (ri: number) => onChange('rows', rows.filter((_, idx) => idx !== ri))
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500">表格</div>
      <div className="flex flex-wrap items-center gap-1">
        {headers.map((h, i) => (
          <input key={i} className="w-16 rounded border border-neutral-300 px-1 py-1 text-xs" value={h} onChange={(e) => setHeader(i, e.target.value)} />
        ))}
        <button className="text-xs text-primary" onClick={addColumn}>+ 列</button>
        {headers.length > 0 && <button className="text-xs text-red-600" onClick={() => removeColumn(headers.length - 1)}>删列</button>}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap items-center gap-1">
          {row.map((cell, ci) => (
            <input key={ci} className="w-16 rounded border border-neutral-300 px-1 py-1 text-xs" value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
          ))}
          <button className="text-xs text-red-600" onClick={() => removeRow(ri)}>删除行</button>
        </div>
      ))}
      <button className="text-xs font-bold text-primary" onClick={addRow}>+ 行</button>
    </div>
  )
}
