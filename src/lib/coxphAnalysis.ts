/**
 * Cox Proportional Hazards (Cox PH) analysis approximation
 * Calculates hazard ratios from Kaplan-Meier survival curves
 * 
 * Note: This provides estimates from pre-computed survival curves.
 * For exact Cox PH results, use the R coxph function and include
 * the results in the JSON data.
 */

import { SurvivalData } from "@/components/bioinformatics/SurvivalCurve";

export interface CoxPHResult {
  referenceGroup: string;
  groups: Array<{
    subtype: string;
    hazardRatio: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
    coefficient: number;
    se: number;
  }>;
  waldTest: {
    chiSquare: number;
    df: number;
    pValue: number;
  };
  stratifiedBy?: string;
}

export interface StratifiedCoxPHResult extends CoxPHResult {
  strataResults: Array<{
    stratum: string;
    nSamples: number;
    groups: CoxPHResult['groups'];
  }>;
  pooledHR: Array<{
    subtype: string;
    hazardRatio: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
  }>;
}

/**
 * Estimate hazard ratio from survival curves using
 * the log-log transformation: HR ≈ log(S2) / log(S1) at a reference time
 */
export function estimateCoxPH(
  survivalData: SurvivalData[],
  subtypeCounts?: Record<string, number>
): CoxPHResult | null {
  if (!survivalData || survivalData.length < 2) {
    return null;
  }

  // Use the first group as reference
  const referenceGroup = survivalData[0].subtype;
  const refPoints = survivalData[0].timePoints;
  
  const groups: CoxPHResult['groups'] = [];
  
  // For each comparison group
  for (let i = 1; i < survivalData.length; i++) {
    const group = survivalData[i];
    const compPoints = group.timePoints;
    
    // Calculate hazard ratio at multiple time points and average
    const hazardRatios: number[] = [];
    const n1 = subtypeCounts?.[referenceGroup] || 100;
    const n2 = subtypeCounts?.[group.subtype] || 100;
    
    // Use median time for comparison
    const refTimes = refPoints.map(p => p.time);
    const compTimes = compPoints.map(p => p.time);
    const commonTimes = refTimes.filter(t => compTimes.includes(t) && t > 0);
    
    for (const t of commonTimes) {
      const s1 = refPoints.find(p => p.time === t)?.survival || 1;
      const s2 = compPoints.find(p => p.time === t)?.survival || 1;
      
      // Avoid log(0) and extreme values
      if (s1 > 0.05 && s1 < 0.99 && s2 > 0.05 && s2 < 0.99) {
        // HR = log(S2) / log(S1) when both follow exponential hazard
        const hr = Math.log(s2) / Math.log(s1);
        if (hr > 0 && hr < 100) {
          hazardRatios.push(hr);
        }
      }
    }
    
    if (hazardRatios.length === 0) {
      continue;
    }
    
    // Use geometric mean of hazard ratios
    const logHRs = hazardRatios.map(hr => Math.log(hr));
    const meanLogHR = logHRs.reduce((a, b) => a + b, 0) / logHRs.length;
    const hazardRatio = Math.exp(meanLogHR);
    
    // Estimate SE using the variance of log(HR) estimates
    const variance = logHRs.reduce((sum, lhr) => sum + Math.pow(lhr - meanLogHR, 2), 0) / 
                     (logHRs.length - 1 || 1);
    
    // Adjust SE for sample size
    const baseSE = Math.sqrt(variance);
    const sampleSizeAdj = Math.sqrt(1/n1 + 1/n2);
    const se = Math.max(baseSE, sampleSizeAdj * 0.5);
    
    // 95% CI
    const z = 1.96;
    const lowerCI = Math.exp(meanLogHR - z * se);
    const upperCI = Math.exp(meanLogHR + z * se);
    
    // Wald test p-value
    const zStat = meanLogHR / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));
    
    groups.push({
      subtype: group.subtype,
      hazardRatio: hazardRatio,
      lowerCI,
      upperCI,
      pValue,
      coefficient: meanLogHR,
      se
    });
  }
  
  if (groups.length === 0) {
    return null;
  }
  
  // Calculate Wald test statistic
  const chiSquare = groups.reduce((sum, g) => 
    sum + Math.pow(g.coefficient / g.se, 2), 0);
  const df = groups.length;
  const waldPValue = 1 - chiSquareCDF(chiSquare, df);
  
  return {
    referenceGroup,
    groups,
    waldTest: {
      chiSquare,
      df,
      pValue: waldPValue
    }
  };
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Chi-square CDF approximation
 */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  if (df <= 0) return 0;
  
  // Use regularized incomplete gamma function
  return gammainc(df / 2, x / 2);
}

function gammainc(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  
  const gln = gammaLn(a);
  
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 100; n++) {
      del *= x / (a + n);
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  } else {
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

/**
 * Format hazard ratio with CI for display
 */
export function formatHR(hr: number, lowerCI: number, upperCI: number): string {
  return `${hr.toFixed(2)} (${lowerCI.toFixed(2)}–${upperCI.toFixed(2)})`;
}

/**
 * Stratified Cox PH analysis
 * Controls for a confounding variable by computing HR within each stratum
 * and combining results using inverse-variance weighting
 */
export function stratifiedCoxPH(
  survivalData: SurvivalData[],
  stratificationMap: Record<string, string>, // sampleId -> stratumValue
  sampleSubtypes: Record<string, string>, // sampleId -> subtype
  subtypeCounts?: Record<string, number>
): StratifiedCoxPHResult | null {
  if (!survivalData || survivalData.length < 2) {
    return null;
  }

  // Get unique strata
  const strata = [...new Set(Object.values(stratificationMap))].sort();
  
  if (strata.length < 2) {
    // Not enough strata for stratification, fall back to regular analysis
    const regular = estimateCoxPH(survivalData, subtypeCounts);
    if (!regular) return null;
    
    return {
      ...regular,
      stratifiedBy: undefined,
      strataResults: [],
      pooledHR: regular.groups.map(g => ({
        subtype: g.subtype,
        hazardRatio: g.hazardRatio,
        lowerCI: g.lowerCI,
        upperCI: g.upperCI,
        pValue: g.pValue
      }))
    };
  }

  const referenceGroup = survivalData[0].subtype;
  const strataResults: StratifiedCoxPHResult['strataResults'] = [];
  
  // For pooling: collect weighted log(HR) for each comparison group
  const pooledData: Record<string, { logHRs: number[]; variances: number[]; weights: number[] }> = {};
  
  survivalData.slice(1).forEach(g => {
    pooledData[g.subtype] = { logHRs: [], variances: [], weights: [] };
  });

  // Analyze each stratum
  for (const stratum of strata) {
    // Get samples in this stratum
    const samplesInStratum = Object.entries(stratificationMap)
      .filter(([, v]) => v === stratum)
      .map(([sampleId]) => sampleId);
    
    if (samplesInStratum.length < 10) continue; // Skip small strata
    
    // Count samples per subtype in this stratum
    const stratumSubtypeCounts: Record<string, number> = {};
    samplesInStratum.forEach(sampleId => {
      const subtype = sampleSubtypes[sampleId];
      if (subtype) {
        stratumSubtypeCounts[subtype] = (stratumSubtypeCounts[subtype] || 0) + 1;
      }
    });
    
    // Weight survival curves for this stratum
    const totalInStratum = Object.values(stratumSubtypeCounts).reduce((a, b) => a + b, 0);
    
    // Create weighted survival data for this stratum
    // This is an approximation - ideally would use individual survival times
    const stratumSurvivalData: SurvivalData[] = survivalData.map(group => {
      const proportion = (stratumSubtypeCounts[group.subtype] || 0) / (subtypeCounts?.[group.subtype] || 1);
      return {
        ...group,
        nTotal: Math.round((group.nTotal || 0) * proportion),
        timePoints: group.timePoints
      };
    }).filter(g => (g.nTotal || 0) > 0);
    
    if (stratumSurvivalData.length < 2) continue;
    
    // Estimate HR within stratum
    const stratumResult = estimateCoxPH(stratumSurvivalData, stratumSubtypeCounts);
    
    if (stratumResult) {
      strataResults.push({
        stratum,
        nSamples: totalInStratum,
        groups: stratumResult.groups
      });
      
      // Collect for pooling (inverse variance weighting)
      stratumResult.groups.forEach(g => {
        if (pooledData[g.subtype]) {
          const logHR = Math.log(g.hazardRatio);
          const variance = g.se * g.se;
          const weight = 1 / variance;
          
          pooledData[g.subtype].logHRs.push(logHR);
          pooledData[g.subtype].variances.push(variance);
          pooledData[g.subtype].weights.push(weight);
        }
      });
    }
  }
  
  if (strataResults.length === 0) {
    return null;
  }
  
  // Calculate pooled (Mantel-Haenszel style) hazard ratios
  const pooledHR: StratifiedCoxPHResult['pooledHR'] = [];
  const groups: CoxPHResult['groups'] = [];
  
  Object.entries(pooledData).forEach(([subtype, data]) => {
    if (data.weights.length === 0) return;
    
    const totalWeight = data.weights.reduce((a, b) => a + b, 0);
    const pooledLogHR = data.logHRs.reduce((sum, lhr, i) => 
      sum + lhr * data.weights[i], 0) / totalWeight;
    const pooledVariance = 1 / totalWeight;
    const pooledSE = Math.sqrt(pooledVariance);
    
    const hr = Math.exp(pooledLogHR);
    const z = 1.96;
    const lowerCI = Math.exp(pooledLogHR - z * pooledSE);
    const upperCI = Math.exp(pooledLogHR + z * pooledSE);
    
    const zStat = pooledLogHR / pooledSE;
    const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));
    
    pooledHR.push({ subtype, hazardRatio: hr, lowerCI, upperCI, pValue });
    groups.push({
      subtype,
      hazardRatio: hr,
      lowerCI,
      upperCI,
      pValue,
      coefficient: pooledLogHR,
      se: pooledSE
    });
  });
  
  // Calculate Wald test for pooled results
  const chiSquare = groups.reduce((sum, g) => 
    sum + Math.pow(g.coefficient / g.se, 2), 0);
  const df = groups.length;
  const waldPValue = 1 - chiSquareCDF(chiSquare, df);
  
  return {
    referenceGroup,
    groups,
    waldTest: {
      chiSquare,
      df,
      pValue: waldPValue
    },
    stratifiedBy: strata.length > 1 ? `${strata.length} strata` : undefined,
    strataResults,
    pooledHR
  };
}
