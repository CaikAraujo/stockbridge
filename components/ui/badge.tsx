import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'badge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        /* Design tokens semânticos */
        success:   'badge-success',
        warn:      'badge-warn',
        danger:    'badge-danger',
        info:      'badge-info',
        violet:    'badge-violet',
        cyan:      'badge-cyan',
        neutral:   'badge-neutral',
        /* Mapeamento legado shadcn → design */
        default:     'badge-neutral',
        secondary:   'badge-neutral',
        destructive: 'badge-danger',
        outline:     'badge-neutral',
        ghost:       'badge-neutral',
        link:        'border-transparent bg-transparent text-[var(--primary)] underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    variant?: BadgeVariant;
  }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeVariant };
