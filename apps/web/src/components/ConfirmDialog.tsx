interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmText = '确认', onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-80 rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-base font-bold">{title}</h3>
        <p className="mb-4 text-sm text-neutral-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100" onClick={onCancel}>取消</button>
          <button className="rounded bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-primary-hover" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
