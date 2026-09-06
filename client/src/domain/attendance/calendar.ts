const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

export function isIsoMonth(value: string): boolean {
  return ISO_MONTH.test(value);
}

export function todayIso(now = new Date()): string {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mo] = month.split("-").map(Number);
  const date = new Date(year, (mo || 1) - 1 + delta, 1, 12);
  return monthValue(date);
}

export function monthDayCount(month: string): number {
  const [year, mo] = month.split("-").map(Number);
  return new Date(year, mo, 0).getDate();
}

/** Calendar days in `YYYY-MM`, inclusive. */
export function monthDates(month: string): string[] {
  const [year, mo] = month.split("-").map(Number);
  const count = monthDayCount(month);
  return Array.from({ length: count }, (_, i) => isoDate(year, mo, i + 1));
}

export function formatMonthLabel(month: string): string {
  return parseIsoDate(`${month}-01`).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

export function weekdayLetter(date: string): string {
  return parseIsoDate(date).toLocaleDateString("en-US", { weekday: "narrow" });
}

export function weekdayShort(date: string): string {
  return parseIsoDate(date).toLocaleDateString("en-US", { weekday: "short" });
}

export function isWeekend(date: string): boolean {
  const day = parseIsoDate(date).getDay();
  return day === 0 || day === 6;
}

export function dateInRange(
  date: string,
  range?: { start?: string; end?: string; month?: string },
): boolean {
  if (!range) return true;
  if (range.month && !date.startsWith(range.month)) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

export function shiftIsoDate(date: string, days: number): string {
  const next = parseIsoDate(date);
  next.setDate(next.getDate() + days);
  return todayIso(next);
}
