const cache = new Map<number, Set<string>>();

async function getHolidays(year: number): Promise<Set<string>> {
  if (cache.has(year)) return cache.get(year)!;
  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  if (!res.ok) {
    const empty = new Set<string>();
    cache.set(year, empty);
    return empty;
  }
  const data = (await res.json()) as { date: string }[];
  const dates = new Set(data.map((d) => d.date));
  cache.set(year, dates);
  return dates;
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export async function isBusinessDay(date: Date): Promise<boolean> {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const holidays = await getHolidays(date.getUTCFullYear());
  return !holidays.has(toISODate(date));
}

export async function addDays(
  startDate: Date,
  days: number,
  mode: "corridos" | "uteis",
): Promise<Date> {
  const result = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
  );
  if (mode === "corridos") {
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (await isBusinessDay(result)) {
      remaining -= 1;
    }
  }
  return result;
}
