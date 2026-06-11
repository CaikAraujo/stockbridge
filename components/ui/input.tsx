import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 flex-1',
        'rounded-[10px] border border-[var(--border)] bg-[var(--surface)]',
        'px-3 text-[13.5px] text-[var(--ink)]',
        'transition-colors duration-150 outline-none',
        'focus-visible:border-[var(--primary)] focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)]',
        'placeholder:text-[var(--faint)]',
        'file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--ink)]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[var(--danger)] aria-invalid:ring-3 aria-invalid:ring-[var(--danger-bg)]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
