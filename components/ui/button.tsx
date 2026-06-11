import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-[var(--danger)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'btn-primary',
        outline:
          'btn-ghost',
        secondary:
          'btn-soft',
        ghost:
          'bg-transparent border-transparent text-ink-2 shadow-none hover:bg-surface-2 hover:text-ink',
        destructive:
          'btn-danger-ghost',
        link:
          'border-transparent bg-transparent text-primary underline-offset-4 hover:underline shadow-none p-0 h-auto',
      },
      size: {
        default:   '',
        xs:        'btn-sm !text-[12px] !px-2 !py-1',
        sm:        'btn-sm',
        lg:        '!py-[11px] !px-5 !text-sm',
        icon:      'btn-icon',
        'icon-xs': 'btn-icon !p-1',
        'icon-sm': 'btn-icon !p-1.5',
        'icon-lg': 'btn-icon !p-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
