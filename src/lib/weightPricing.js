// Weight-based delivery pricing and COD fee helpers.
//
// Delivery is charged from the delivery zone:
//   - `charge` is the base fee that covers `base_weight_kg` kilograms.
//   - `extra_kg_charge` is the add-on for every extra (started) kilogram.
//
// Example: charge = 60, base_weight_kg = 1, extra_kg_charge = 20
//   1.0 kg -> 60
//   1.5 kg -> 60 + 20 = 80
//   3.0 kg -> 60 + (2 x 20) = 100

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function roundWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000) / 1000;
}

export function computeWeightPricing({
  weightKg,
  baseCharge,
  baseWeightKg = 1,
  extraKgCharge = 0,
} = {}) {
  const weight = roundWeight(weightKg);
  const base = Math.max(0, roundMoney(baseCharge));
  const included = Math.max(0, roundWeight(baseWeightKg));
  const perKg = Math.max(0, roundMoney(extraKgCharge));

  const overage = Math.max(0, roundWeight(weight - included));
  // Charge for every extra kilogram that has been started.
  const extraKg = overage > 0 ? Math.ceil(overage - 1e-9) : 0;
  const extraCharge = roundMoney(extraKg * perKg);
  const weightCharge = roundMoney(base + extraCharge);

  return {
    weightKg: weight,
    includedKg: included,
    extraKg,
    baseCharge: base,
    extraKgCharge: perKg,
    extraCharge,
    weightCharge,
  };
}

// COD fee is a cost borne by the admin side (not added to the customer
// total). Returns the amount deducted from the merchant payout.
export function computeCodCharge(codAmount, codPercent) {
  const amount = Math.max(0, toNumber(codAmount));
  const percent = Math.max(0, toNumber(codPercent));
  return roundMoney((amount * percent) / 100);
}

export function formatWeight(kg) {
  const value = roundWeight(kg);
  if (!value) return "0 kg";
  return `${value} kg`;
}
