const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

export function hasUnsafeChars(value: string): boolean {
  return UNSAFE_CHARS.test(value);
}

export const MAX_SNAPSHOT_BYTES = 64 * 1024;
export const MAX_ITEMS = 80;
