import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-foreground-secondary">{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none transition focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 ${
          error ? 'border-red' : 'border-border-default'
        } ${className ?? ''}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red">{error}</span>}
    </label>
  );
});
