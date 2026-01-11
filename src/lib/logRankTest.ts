/**
 * Log-rank test implementation for Kaplan-Meier survival analysis
 * Returns p-value for comparing survival curves between groups
 * 
 * Note: This implementation works with pre-computed Kaplan-Meier curves
 * where we only have (time, survival) points. It estimates the number
 * of events and at-risk subjects from the survival probabilities.
 */

import { SurvivalData } from "@/components/bioinformatics/SurvivalCurve";

/**
 * Calculate chi-square p-value using Wilson-Hilferty approximation
 */
function chiSquarePValue(chiSquare: number, df: number): number {
  if (df <= 0 || chiSquare < 0) return 1;
  if (chiSquare === 0) return 1;
  
  // For very large chi-square values
  if (chiSquare > 100) {
    return 1e-20;
  }

  // Gamma function approximation using Stirling's formula for large values
  function gammaLn(x: number): number {
    const c = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
      ser += c[j] / ++y;
    }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  // Regularized incomplete gamma function (lower)
  function gammainc(a: number, x: number): number {
    if (x < 0 || a <= 0) return 0;
    if (x === 0) return 0;
    
    const gln = gammaLn(a);
    
    if (x < a + 1) {
      // Use series representation
      let sum = 1 / a;
      let del = sum;
      for (let n = 1; n <= 100; n++) {
        del *= x / (a + n);
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-10) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - gln);
    } else {
      // Use continued fraction representation
      let b = x + 1 - a;
      let c = 1e30;
      let d = 1 / b;
      let h = d;
      for (let i = 1; i <= 100; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-10) break;
      }
      return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
    }
  }

  // P-value = 1 - CDF of chi-square = 1 - gammainc(df/2, x/2)
  const pValue = 1 - gammainc(df / 2, chiSquare / 2);
  return Math.max(0, Math.min(1, pValue));
}

/**
 * Reconstruct event data from survival curve
 * Uses the relationship: S(t) = S(t-1) * (1 - d/n)
 * where d = events at time t, n = at-risk at time t
 */
function reconstructEventData(
  data: SurvivalData[],
  subtypeCounts: Record<string, number>
): Array<{
  time: number;
  groups: Array<{
    subtype: string;
    atRisk: number;
    events: number;
  }>;
}> {
  // Get all unique times across all groups
  const allTimes = new Set<number>();
  data.forEach(group => {
    group.timePoints.forEach(tp => allTimes.add(tp.time));
  });
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  
  const eventData: Array<{
    time: number;
    groups: Array<{ subtype: string; atRisk: number; events: number }>;
  }> = [];

  // Track state for each group
  const groupState = new Map<string, { 
    atRisk: number; 
    prevSurvival: number;
    timePointMap: Map<number, number>;
  }>();

  data.forEach(group => {
    const initialN = subtypeCounts[group.subtype] || 100;
    const tpMap = new Map<number, number>();
    group.timePoints.forEach(tp => {
      tpMap.set(tp.time, tp.survival);
    });
    groupState.set(group.subtype, {
      atRisk: initialN,
      prevSurvival: 1.0,
      timePointMap: tpMap
    });
  });

  for (const time of sortedTimes) {
    if (time === 0) continue; // Skip time 0
    
    const groups: Array<{ subtype: string; atRisk: number; events: number }> = [];
    
    data.forEach(group => {
      const state = groupState.get(group.subtype)!;
      const currentSurvival = state.timePointMap.get(time);
      
      let events = 0;
      if (currentSurvival !== undefined && currentSurvival < state.prevSurvival) {
        // S(t) = S(t-1) * (1 - d/n)
        // d = n * (1 - S(t)/S(t-1))
        const survivalRatio = currentSurvival / state.prevSurvival;
        events = Math.round(state.atRisk * (1 - survivalRatio));
        events = Math.max(0, events);
        
        state.prevSurvival = currentSurvival;
        state.atRisk = Math.max(0, state.atRisk - events);
      }
      
      groups.push({
        subtype: group.subtype,
        atRisk: state.atRisk + events, // At risk just before event
        events
      });
    });
    
    // Only include time points with events
    if (groups.some(g => g.events > 0)) {
      eventData.push({ time, groups });
    }
  }
  
  return eventData;
}

export interface LogRankResult {
  pValue: number;
  chiSquare: number;
  degreesOfFreedom: number;
}

/**
 * Perform log-rank test on survival data
 * Uses the Mantel-Haenszel log-rank test statistic
 */
export function logRankTest(
  survivalData: SurvivalData[],
  subtypeCounts?: Record<string, number>
): LogRankResult | null {
  if (!survivalData || survivalData.length < 2) {
    return null;
  }

  // Use provided counts or estimate from typical study sizes
  const counts = subtypeCounts || {};
  survivalData.forEach(group => {
    if (!counts[group.subtype]) {
      // Estimate based on common study proportions
      counts[group.subtype] = 100;
    }
  });

  // Reconstruct event data from survival curves
  const eventData = reconstructEventData(survivalData, counts);
  
  if (eventData.length === 0) {
    return null;
  }

  const numGroups = survivalData.length;
  
  // Calculate O-E and variance for each group (except last)
  const observedMinusExpected = new Array(numGroups - 1).fill(0);
  const variances = new Array(numGroups - 1).fill(0);
  
  for (const { groups } of eventData) {
    const totalEvents = groups.reduce((sum, g) => sum + g.events, 0);
    const totalAtRisk = groups.reduce((sum, g) => sum + g.atRisk, 0);
    
    if (totalAtRisk === 0 || totalEvents === 0) continue;
    
    for (let i = 0; i < numGroups - 1; i++) {
      const observed = groups[i].events;
      const expected = (groups[i].atRisk / totalAtRisk) * totalEvents;
      
      observedMinusExpected[i] += observed - expected;
      
      // Variance = n_i * n_j * d * (N - d) / (N^2 * (N - 1))
      // Simplified for 2 groups
      if (totalAtRisk > 1) {
        const n_i = groups[i].atRisk;
        const n_other = totalAtRisk - n_i;
        const v = (n_i * n_other * totalEvents * (totalAtRisk - totalEvents)) / 
                  (totalAtRisk * totalAtRisk * (totalAtRisk - 1));
        variances[i] += v;
      }
    }
  }
  
  // Calculate chi-square statistic
  // For 2 groups: chi^2 = (O - E)^2 / V
  let chiSquare = 0;
  for (let i = 0; i < numGroups - 1; i++) {
    if (variances[i] > 0) {
      chiSquare += (observedMinusExpected[i] * observedMinusExpected[i]) / variances[i];
    }
  }
  
  const df = numGroups - 1;
  const pValue = chiSquarePValue(chiSquare, df);
  
  return {
    pValue,
    chiSquare,
    degreesOfFreedom: df
  };
}

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
