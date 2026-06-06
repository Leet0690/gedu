import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { cn } from '../../lib/cn';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type DateValue = string | Date | null | undefined;

export interface DatePickerProps {
  id?: string;
  label?: string;
  value?: DateValue;
  min?: DateValue;
  max?: DateValue;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: 'start' | 'center' | 'end';
  onChange?: (value: string, date: Date) => void;
}

const parseDateValue = (value: DateValue) => {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDisabledDays = (min?: Date, max?: Date) => {
  const matchers: Matcher[] = [];
  if (min) matchers.push({ before: min });
  if (max) matchers.push({ after: max });
  return matchers.length ? matchers : undefined;
};

const getBoundaryMonth = (date?: Date) => (date ? new Date(date.getFullYear(), date.getMonth(), 1) : undefined);

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      id,
      label,
      value,
      min,
      max,
      placeholder = 'Sélectionner une date',
      title,
      disabled,
      className,
      triggerClassName,
      align = 'start',
      onChange,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selectedDate = parseDateValue(value);
    const minDate = parseDateValue(min);
    const maxDate = parseDateValue(max);

    return (
      <div className={cn('shadcn-date-picker', className)}>
        {label && (
          <label className="shadcn-date-picker-label" htmlFor={id}>
            {label}
          </label>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              ref={ref}
              id={id}
              type="button"
              className={cn('shadcn-date-picker-trigger', !selectedDate && 'is-placeholder', triggerClassName)}
              data-tooltip={title}
              aria-label={title || label || placeholder}
              disabled={disabled}
            >
              <span>{selectedDate ? format(selectedDate, 'dd MMM yyyy', { locale: fr }) : placeholder}</span>
              <CalendarIcon size={15} className="shadcn-date-picker-icon" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align={align} className="shadcn-date-picker-popover">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate || maxDate || minDate || new Date()}
              startMonth={getBoundaryMonth(minDate)}
              endMonth={getBoundaryMonth(maxDate)}
              disabled={getDisabledDays(minDate, maxDate)}
              onSelect={(date) => {
                if (!date) return;
                onChange?.(formatDateValue(date), date);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';

export { DatePicker };
