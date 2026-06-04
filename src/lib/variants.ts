import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-muted active:scale-[0.98]',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted active:scale-[0.98]',
        ghost:
          'text-foreground hover:bg-muted active:scale-[0.98]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98]',
        success:
          'bg-success text-success-foreground shadow-sm hover:opacity-90 active:scale-[0.98]',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export const inputVariants = cva(
  'flex h-11 w-full rounded-xl border bg-background px-4 py-2 text-sm text-foreground shadow-xs transition-all duration-200 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      state: {
        default: 'border-border',
        error: 'border-destructive focus-visible:ring-destructive',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
);

export const cardVariants = cva(
  'rounded-2xl border border-border bg-card text-card-foreground shadow-card transition-all duration-200 ease-out',
  {
    variants: {
      hover: {
        true: 'hover:-translate-y-0.5 hover:shadow-elevated',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      hover: false,
      padding: 'none',
    },
  },
);

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export const dropdownItemVariants = cva(
  'relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-out data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
  {
    variants: {
      variant: {
        default:
          'text-popover-foreground focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
        destructive:
          'text-destructive focus:bg-[var(--danger-bg)] focus:text-destructive data-[highlighted]:bg-[var(--danger-bg)] data-[highlighted]:text-destructive',
        success:
          'text-success focus:bg-[var(--success-bg)] focus:text-success data-[highlighted]:bg-[var(--success-bg)] data-[highlighted]:text-success',
      },
      inset: {
        true: 'pl-8',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      inset: false,
    },
  },
);
