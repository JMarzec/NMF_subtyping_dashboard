// Mock NMF analysis results based on GSE62254 structure
export interface SampleResult {
  sample_id: string;
  subtype: string;
  [column: string]: string | number | boolean | null;
}

export interface MarkerGene {
  gene: string;
  weight: number;
  subtype: string;
}

export interface RankMetric {
  rank: number;
  cophenetic: number;
  silhouette: number;
}

export interface SurvivalDataPoint {
  subtype: string;
  timePoints: { time: number; survival: number }[];
}

export interface NmfSummary {
  dataset: string;
  n_samples: number;
  n_genes: number;
  n_subtypes: number;
  subtype_counts: Record<string, number>;
  cophenetic_correlation: number;
  silhouette_mean: number;
  optimal_rank?: number;
}

// Generate dynamic colors for subtypes
const PALETTE = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(24, 95%, 53%)",
  "hsl(349, 89%, 60%)",
  "hsl(47, 96%, 53%)",
  "hsl(186, 72%, 48%)",
  "hsl(316, 72%, 55%)",
];

export const generateSubtypeColors = (subtypes: string[]): Record<string, string> => {
  const colors: Record<string, string> = {};
  subtypes.forEach((subtype, idx) => {
    colors[subtype] = PALETTE[idx % PALETTE.length];
  });
  return colors;
};

// Check if a column contains continuous (numeric) values
export const isNumericColumn = (values: (string | number | undefined)[]): boolean => {
  if (values.length === 0) return false;
  
  const validValues = values.filter(v => v !== undefined && v !== null && v !== '');
  if (validValues.length === 0) return false;
  
  // Check if all non-empty values are numeric
  const numericCount = validValues.filter(v => {
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    return !isNaN(num) && isFinite(num);
  }).length;
  
  // Consider it numeric if > 80% of values are numbers and there are more than 5 unique values
  const uniqueValues = new Set(validValues.map(v => String(v)));
  return numericCount / validValues.length > 0.8 && uniqueValues.size > 5;
};

// Generate a continuous color scale for numeric values
export const getContinuousColor = (value: number, min: number, max: number, colorScale: 'viridis' | 'plasma' | 'bluered' = 'viridis'): string => {
  const normalized = max === min ? 0.5 : (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalized));
  
  switch (colorScale) {
    case 'viridis': {
      // Viridis-like color scale (purple -> blue -> green -> yellow)
      if (clamped < 0.25) {
        const t = clamped / 0.25;
        return `hsl(${270 - t * 30}, ${65 + t * 15}%, ${25 + t * 15}%)`;
      } else if (clamped < 0.5) {
        const t = (clamped - 0.25) / 0.25;
        return `hsl(${240 - t * 60}, ${80 - t * 10}%, ${40 + t * 10}%)`;
      } else if (clamped < 0.75) {
        const t = (clamped - 0.5) / 0.25;
        return `hsl(${180 - t * 60}, ${70 - t * 10}%, ${50 + t * 5}%)`;
      } else {
        const t = (clamped - 0.75) / 0.25;
        return `hsl(${120 - t * 60}, ${60 + t * 20}%, ${55 + t * 20}%)`;
      }
    }
    case 'plasma': {
      // Plasma-like (purple -> pink -> orange -> yellow)
      if (clamped < 0.33) {
        const t = clamped / 0.33;
        return `hsl(${280 - t * 30}, ${80 + t * 10}%, ${30 + t * 20}%)`;
      } else if (clamped < 0.66) {
        const t = (clamped - 0.33) / 0.33;
        return `hsl(${250 - t * 200}, ${90 - t * 10}%, ${50 + t * 10}%)`;
      } else {
        const t = (clamped - 0.66) / 0.34;
        return `hsl(${50 - t * 10}, ${80 + t * 15}%, ${60 + t * 25}%)`;
      }
    }
    case 'bluered': {
      // Blue -> White -> Red diverging scale
      if (clamped < 0.5) {
        const t = clamped / 0.5;
        return `hsl(220, ${80 - t * 30}%, ${40 + t * 55}%)`;
      } else {
        const t = (clamped - 0.5) / 0.5;
        return `hsl(0, ${50 + t * 30}%, ${95 - t * 45}%)`;
      }
    }
    default:
      return `hsl(220, 70%, ${90 - clamped * 50}%)`;
  }
};

// Generate a color legend for continuous values
export interface ContinuousColorLegend {
  min: number;
  max: number;
  colorScale: 'viridis' | 'plasma' | 'bluered';
  getColor: (value: number) => string;
}

export const createContinuousColorScale = (
  values: number[],
  colorScale: 'viridis' | 'plasma' | 'bluered' = 'viridis'
): ContinuousColorLegend => {
  let min=Infinity,max=-Infinity;for(const v of values){if(v<min)min=v;if(v>max)max=v;}
  if(!Number.isFinite(min)){min=0;max=1;}
  
  return {
    min,
    max,
    colorScale,
    getColor: (value: number) => getContinuousColor(value, min, max, colorScale)
  };
};
