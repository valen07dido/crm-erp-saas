// Shared between every place a product's expiration date gets entered
// (src/pages/dashboard/products.tsx's edit form, pos.tsx's quick-create
// form) and the server-side check in src/pages/api/products.ts. Keeping
// this in one place is the whole point — the quick-create form originally
// had its own untouched <input type="date">, which is exactly how the
// "typed '22' instead of '2022', got stored as year 0022" bug slipped back
// in through a second door after being fixed in the main form.
export const MIN_EXPIRATION_YEAR = 2000;
export const MAX_EXPIRATION_YEAR = new Date().getFullYear() + 50;

export function isValidExpirationDate(value: string): boolean {
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) && year >= MIN_EXPIRATION_YEAR && year <= MAX_EXPIRATION_YEAR;
}
