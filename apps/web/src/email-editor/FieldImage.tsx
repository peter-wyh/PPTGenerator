import { Input } from '../components/Input'

export function FieldImage({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <div className="mt-1 rounded bg-neutral-100 p-1 text-center">
          <img src={value} alt="" className="mx-auto max-h-20 max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
