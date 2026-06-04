import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import { inputVariants } from '../../lib/variants';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, state, 'aria-invalid': ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={ariaInvalid ?? error ?? state === 'error'}
      className={cn(inputVariants({ state: error ? 'error' : state, className }))}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input, inputVariants };
