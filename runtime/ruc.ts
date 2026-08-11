/**
 * RUC validation — SUNAT Módulo 11 (checksummed, zero-dependency).
 *
 * Ported from arkelythex/drenyra-app-web `packages/shared/src/validation/ruc.ts`.
 * A valid Peruvian RUC is exactly 11 digits whose check digit (11th) matches
 * the Módulo 11 calculation over the first 10 digits.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC digits and check digits are integers.
 */

/** Weights for the Módulo 11 algorithm (SUNAT standard). */
const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Expected check digit for the first 10 RUC digits (Módulo 11):
 * expected = 11 - (sum % 11); 10 → 0; 11 → 1; otherwise the result.
 */
function expectedCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number.parseInt(first10[i] ?? "0", 10) * RUC_WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = 11 - remainder;
  if (expected === 10) return 0;
  if (expected === 11) return 1;
  return expected;
}

/**
 * Validate a Peruvian RUC with the SUNAT Módulo 11 algorithm.
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }
  const actual = Number.parseInt(ruc[10] ?? "0", 10);
  return expectedCheckDigit(ruc.slice(0, 10)) === actual;
}
