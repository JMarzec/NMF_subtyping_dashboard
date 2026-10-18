export { logRankObserved as logRankTest } from "./survivalEngine";

/**
 * Format p-value for display
 */
export function formatPValue(pValue: number): string {
  if (pValue < 0.0001) {
    return `p < 0.0001`;
  } else if (pValue < 0.001) {
    return `p = ${pValue.toExponential(2)}`;
  } else if (pValue < 0.01) {
    return `p = ${pValue.toFixed(4)}`;
  } else {
    return `p = ${pValue.toFixed(3)}`;
  }
}

/**
 * Calculate Greenwood's variance for confidence intervals
 * V(S(t)) = S(t)^2 * Σ d_i / (n_i * (n_i - d_i))
 */
export function calculateGreenwoodVariance(
  survivalValue: number,
  cumulativeVarianceTerm: number
): number {
  return survivalValue * survivalValue * cumulativeVarianceTerm;
}
