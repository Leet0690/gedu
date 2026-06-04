import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import { cn } from '../../lib/cn';
import 'react-day-picker/style.css';

export type CalendarProps = DayPickerProps;

const Calendar = ({ className, locale = fr, showOutsideDays = true, ...props }: CalendarProps) => (
  <DayPicker
    locale={locale}
    showOutsideDays={showOutsideDays}
    className={cn('shadcn-calendar', className)}
    {...props}
  />
);
Calendar.displayName = 'Calendar';

export { Calendar };
