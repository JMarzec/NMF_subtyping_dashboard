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

export const nmfSummary: NmfSummary = {
  dataset: "GSE62254",
  n_samples: 300,
  n_genes: 5000,
  n_subtypes: 4,
  subtype_counts: {
    "Subtype_1": 78,
    "Subtype_2": 65,
    "Subtype_3": 89,
    "Subtype_4": 68
  },
  cophenetic_correlation: 0.987,
  silhouette_mean: 0.72,
  optimal_rank: 4
};

// Default rank metrics
export const defaultRankMetrics: RankMetric[] = [
  { rank: 2, cophenetic: 0.912, silhouette: 0.58 },
  { rank: 3, cophenetic: 0.954, silhouette: 0.65 },
  { rank: 4, cophenetic: 0.987, silhouette: 0.72 },
  { rank: 5, cophenetic: 0.965, silhouette: 0.68 },
  { rank: 6, cophenetic: 0.923, silhouette: 0.61 },
];

// Default survival data
export const defaultSurvivalData: SurvivalDataPoint[] = [
  {
    subtype: "Subtype_1",
    timePoints: [
      { time: 0, survival: 1.0 },
      { time: 12, survival: 0.85 },
      { time: 24, survival: 0.72 },
      { time: 36, survival: 0.58 },
      { time: 48, survival: 0.45 },
      { time: 60, survival: 0.35 },
    ]
  },
  {
    subtype: "Subtype_2",
    timePoints: [
      { time: 0, survival: 1.0 },
      { time: 12, survival: 0.92 },
      { time: 24, survival: 0.84 },
      { time: 36, survival: 0.75 },
      { time: 48, survival: 0.68 },
      { time: 60, survival: 0.62 },
    ]
  },
  {
    subtype: "Subtype_3",
    timePoints: [
      { time: 0, survival: 1.0 },
      { time: 12, survival: 0.78 },
      { time: 24, survival: 0.55 },
      { time: 36, survival: 0.38 },
      { time: 48, survival: 0.25 },
      { time: 60, survival: 0.18 },
    ]
  },
  {
    subtype: "Subtype_4",
    timePoints: [
      { time: 0, survival: 1.0 },
      { time: 12, survival: 0.88 },
      { time: 24, survival: 0.76 },
      { time: 36, survival: 0.65 },
      { time: 48, survival: 0.55 },
      { time: 60, survival: 0.48 },
    ]
  },
];

// Generate realistic sample data
export const sampleResults: SampleResult[] = Array.from({ length: 300 }, (_, i) => {
  const subtype = Math.floor(Math.random() * 4) + 1;
  const scores = [0, 0, 0, 0].map((_, idx) => 
    idx + 1 === subtype 
      ? 0.6 + Math.random() * 0.35 
      : Math.random() * 0.3
  );
  
  return {
    sample_id: `GSM${1523700 + i}`,
    subtype: `Subtype_${subtype}`,
    score_subtype_1: scores[0],
    score_subtype_2: scores[1],
    score_subtype_3: scores[2],
    score_subtype_4: scores[3],
  };
});

// Marker genes per subtype
const subtypeGeneSignatures: Record<string, string[]> = {
  "Subtype_1": ["MYC", "CCND1", "CDK4", "E2F1", "AURKA", "PLK1", "CDC20", "BUB1", "TOP2A", "PCNA"],
  "Subtype_2": ["CDH1", "EPCAM", "KRT19", "CLDN4", "MUC1", "TJP1", "OCLN", "DSP", "PKP3", "JUP"],
  "Subtype_3": ["VIM", "SNAI1", "ZEB1", "TWIST1", "FN1", "CDH2", "MMP2", "MMP9", "SPARC", "COL1A1"],
  "Subtype_4": ["PTPRC", "CD3D", "CD8A", "GZMA", "PRF1", "IFNG", "CD4", "FOXP3", "IL2RA", "CTLA4"],
};

export const markerGenes: MarkerGene[] = Object.entries(subtypeGeneSignatures).flatMap(
  ([subtype, genes]) => genes.map((gene, idx) => ({
    gene,
    weight: 1 - idx * 0.08 + Math.random() * 0.05,
    subtype,
  }))
);

// Heatmap expression data (genes x samples) - uses ALL genes and ALL samples
export const generateHeatmapData = () => {
  const genes = Object.values(subtypeGeneSignatures).flat(); // All genes
  const samples = sampleResults; // All samples
  
  return {
    genes,
    samples: samples.map(s => s.sample_id),
    sampleSubtypes: samples.map(s => s.subtype),
    values: genes.map(gene => {
      const geneSubtype = Object.entries(subtypeGeneSignatures).find(
        ([_, genes]) => genes.includes(gene)
      )?.[0] || "Subtype_1";
      
      return samples.map(sample => {
        const isMatchingSubtype = sample.subtype === geneSubtype;
        const baseValue = isMatchingSubtype ? 2 + Math.random() : -1 + Math.random() * 1.5;
        return baseValue + (Math.random() - 0.5) * 0.5;
      });
    }),
  };
};

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
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return {
    min,
    max,
    colorScale,
    getColor: (value: number) => getContinuousColor(value, min, max, colorScale)
  };
};
