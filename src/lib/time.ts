const FALLBACK_ZONE = "America/New_York";

export function isIanaTimeZone(value: string): boolean {
  if (value !== "UTC" && !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(value: string | undefined): { timeZone: string; note: string | null } {
  if (!value || value.trim() === "") {
    return { timeZone: FALLBACK_ZONE, note: null };
  }
  const trimmed = value.trim();
  if (isIanaTimeZone(trimmed)) {
    return { timeZone: trimmed, note: null };
  }
  return {
    timeZone: FALLBACK_ZONE,
    note: "DISPLAY_TIMEZONE is not a valid IANA zone. Times use America/New_York.",
  };
}

export function formatTimestamp(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (!isIanaTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(date);
  const text = parts
    .map((part) => part.value)
    .join("")
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

export function isIsoWithZone(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
