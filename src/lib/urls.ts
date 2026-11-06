const MAX_URL_LENGTH = 500;

export function parseAllowlist(value: string | undefined): string[] | null {
  if (!value || !value.trim()) return null;
  const hosts = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  return hosts.length > 0 ? hosts : null;
}

function isBlockedHost(host: string): boolean {
  if (!host) return true;
  const normalized = host.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  if (normalized === "metadata.google.internal" || normalized === "metadata.google.com") {
    return true;
  }
  if (normalized.includes(":") || normalized.includes("%")) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) return true;
  if (!normalized.includes(".")) return true;
  return false;
}

export function isSafeEvidenceUrl(value: string, allowlist: string[] | null): boolean {
  if (value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isBlockedHost(bare)) return false;
  if (allowlist && !allowlist.includes(bare)) return false;
  return true;
}
