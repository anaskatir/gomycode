/** 1 point pour chaque 10 dh d'achat. Les remboursements ne donnent pas de points. */
export function pointsForPurchase(amountTotal: number): number {
  if (!Number.isFinite(amountTotal) || amountTotal <= 0) return 0;
  return Math.floor(amountTotal / 10);
}
