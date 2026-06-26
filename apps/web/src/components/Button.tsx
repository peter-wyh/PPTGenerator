import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
}

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`rounded px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}
