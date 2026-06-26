import { useEditorStore } from './store'

export function PageList() {
  const pages = useEditorStore((s) => s.pages)
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage)
  return (
    <div className="w-44 shrink-0 space-y-2 border-r border-edge bg-surface p-3">
      <div className="text-xs font-bold text-neutral-500">页面</div>
      {pages.map((p, i) => (
        <button key={p.id} onClick={() => setCurrentPage(p.id)}
          className={`block w-full rounded border px-2 py-3 text-left text-xs ${
            p.id === currentPageId ? 'border-primary bg-primary/5 text-primary' : 'border-neutral-200 hover:bg-neutral-50'
          }`}>
          <div className="font-bold">{i + 1}. {p.name}</div>
          <div className="text-neutral-400">{p.components.length} 个组件</div>
        </button>
      ))}
    </div>
  )
}
