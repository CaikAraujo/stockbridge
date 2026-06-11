import type * as React from 'react';

import { cn } from '@/lib/utils';

function Card({
  className,
  size = 'default',
  hover = false,
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  hover?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'card group/card flex flex-col gap-4 overflow-hidden py-5 text-[13.5px] text-[var(--ink)]',
        'has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0',
        'data-[size=sm]:gap-3 data-[size=sm]:py-3',
        hover && 'card-hover',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'card-head @container/card-header',
        'has-data-[slot=card-action]:grid has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('card-title group-data-[size=sm]/card:text-sm', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('card-sub', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-[var(--card-pad)] group-data-[size=sm]/card:px-3', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-[var(--r-lg)] border-t border-[var(--border-soft)]',
        'bg-[var(--surface-2)] p-[var(--card-pad)] group-data-[size=sm]/card:p-3',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
