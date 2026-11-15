import Decimal from 'decimal.js';

export { Decimal };

export function decToStr(value: Decimal | string | number): string {
  return new Decimal(value).toString();
}
