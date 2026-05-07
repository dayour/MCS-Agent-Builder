export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function getLatestDate(values: Array<unknown>): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    const date = toDate(value);
    if (!date) return latest;
    if (!latest || date > latest) return date;
    return latest;
  }, null);
}