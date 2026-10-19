/** Digits only; an 11-digit number starting with the US country code drops the leading 1. */
export function normalizeUSDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/**
 * Progressive "(586) 555-0123" formatting for an input's onChange. More than ten digits are
 * returned unformatted so validation can reject them instead of a wrong number being submitted.
 */
export function formatUSPhone(input: string): string {
  const digits = normalizeUSDigits(input);
  if (digits.length === 0) return "";
  if (digits.length > 10) return digits;
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  if (digits.length <= 3) return `(${area}`;
  if (digits.length <= 6) return `(${area}) ${prefix}`;
  return `(${area}) ${prefix}-${line}`;
}

/** Exactly ten digits (after an optional leading 1) with an area code that starts 2–9. */
export function isValidUSPhone(input: string): boolean {
  const digits = normalizeUSDigits(input);
  return digits.length === 10 && /^[2-9]/.test(digits);
}
