import { useState, type ReactNode } from 'react'

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3 overflow-hidden rounded border border-edge bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-neutral-50 px-4 py-3 text-left text-sm font-bold text-neutral-700 hover:bg-neutral-100"
      >
        <span>{title}</span>
        <span className="text-neutral-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}
