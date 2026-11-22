import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const today = (): Date => new Date();

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Whole calendar days from `from` to `to` (to minus from). */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

export function addDaysISO(iso: string, n: number): string {
  return format(addDays(parseISO(iso), n), 'yyyy-MM-dd');
}
