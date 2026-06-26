import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, className = '', ...rest }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-neutral-500">{label}</span>}
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm outline-none focus:border-primary ${className}`}
      />
    </label>
  )
})
