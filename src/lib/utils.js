/**
 * Merge CSS class names cleanly, ignoring falsy values.
 *
 * @param {...(string | false | null | undefined)} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return inputs
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .join(' ');
}
