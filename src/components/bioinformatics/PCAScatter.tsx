import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult, generateSubtypeColors } from "@/data/mockNmfData";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Download, RotateCcw } from "lucide-react";
import { AnnotationSelector } from "./AnnotationSelector";
import { AnnotationData } from "./AnnotationUploader";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

type PCADataSource = "expression" | "nmf";

interface PCAScatterProps {
  samples: SampleResult[];
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
  heatmapData: HeatmapData;
  filterResetKey?: number;
}

// PCA on NMF scores
const computePCAFromNMF = (samples: { scores: number[] }[]): { 
  pc1: number[]; pc2: number[]; variance1: number; variance2: number 
} => {
  if (samples.length === 0) return { pc1: [], pc2: [], variance1: 0, variance2: 0 };
  
  const numScores = samples[0].scores.length;
  const data = samples.map(s => s.scores);
  
  // Center the data
  const means = Array(numScores).fill(0);
  for (const row of data) {
    for (let j = 0; j < numScores; j++) {
      means[j] += row[j];
    }
  }
  for (let j = 0; j < numScores; j++) {
    means[j] /= data.length;
  }
  const centered = data.map(row => row.map((v, j) => v - means[j]));
  
  // Compute covariance
  const cov: number[][] = Array(numScores).fill(null).map(() => Array(numScores).fill(0));
  for (let i = 0; i < numScores; i++) {
    for (let j = i; j < numScores; j++) {
      let sum = 0;
      for (const row of centered) {
        sum += row[i] * row[j];
      }
      cov[i][j] = sum / (data.length - 1);
      cov[j][i] = cov[i][j];
    }
  }
  
  let totalVariance = 0;
  for (let i = 0; i < numScores; i++) totalVariance += cov[i][i];
  
  // Power iteration
  const powerIteration = (matrix: number[][]): { vector: number[]; eigenvalue: number } => {
    const size = matrix.length;
    let vector = Array(size).fill(0).map(() => Math.random());
    let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    vector = vector.map(v => v / norm);
    let ev = 0;
    for (let iter = 0; iter < 100; iter++) {
      const newVector = Array(size).fill(0);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          newVector[i] += matrix[i][j] * vector[j];
        }
      }
      ev = newVector.reduce((sum, v, i) => sum + v * vector[i], 0);
      norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      vector = newVector.map(v => v / norm);
    }
    return { vector, eigenvalue: ev };
  };
  
  const { vector: pc1Vec, eigenvalue: e1 } = powerIteration(cov);
  const pc1 = centered.map(row => row.reduce((sum, v, j) => sum + v * pc1Vec[j], 0));
  
  const deflated = cov.map((row, i) => row.map((v, j) => v - e1 * pc1Vec[i] * pc1Vec[j]));
  const { vector: pc2Vec, eigenvalue: e2 } = powerIteration(deflated);
  const pc2 = centered.map(row => row.reduce((sum, v, j) => sum + v * pc2Vec[j], 0));
  
  return {
    pc1,
    pc2,
    variance1: totalVariance > 0 ? (e1 / totalVariance) * 100 : 0,
    variance2: totalVariance > 0 ? (e2 / totalVariance) * 100 : 0,
  };
};

// PCA implementation using power iteration for top 2 components on gene expression data
// Takes gene expression matrix (genes x samples) and returns PC scores and variance explained
const computePCAFromExpression = (values: number[][], nGenes: number, nSamples: number): {
  pc1: number[]; 
  pc2: number[]; 
  variance1: number; 
  variance2: number 
} => {
  if (nSamples === 0 || nGenes === 0) return { pc1: [], pc2: [], variance1: 0, variance2: 0 };

  // Transpose to get samples as rows (samples x genes)
  const data: number[][] = [];
  for (let s = 0; s < nSamples; s++) {
    const row: number[] = [];
    for (let g = 0; g < nGenes; g++) {
      row.push(values[g][s]);
    }
    data.push(row);
  }

  const n = data.length; // samples
  const m = data[0].length; // genes

  // Center the data
  const means = Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      means[j] += data[i][j];
    }
  }
  for (let j = 0; j < m; j++) {
    means[j] /= n;
  }

  const centered = data.map(row => row.map((v, j) => v - means[j]));

  // Use Gram matrix (n x n) for efficiency when n < m
  const useGram = n < m;
  
  let totalVariance = 0;
  let eigenvalue1 = 0;
  let eigenvalue2 = 0;
  let pc1Scores: number[] = [];
  let pc2Scores: number[] = [];

  if (useGram) {
    // Compute Gram matrix (n x n): X X^T / (n-1)
    const gram: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
          sum += centered[i][k] * centered[j][k];
        }
        gram[i][j] = sum / (n - 1);
        gram[j][i] = gram[i][j];
      }
    }

    // Total variance from trace
    for (let i = 0; i < n; i++) {
      totalVariance += gram[i][i];
    }

    // Power iteration for first eigenvector
    const powerIteration = (matrix: number[][]): { vector: number[]; eigenvalue: number } => {
      const size = matrix.length;
      let vector = Array(size).fill(0).map(() => Math.random());
      let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      vector = vector.map(v => v / norm);

      let ev = 0;
      for (let iter = 0; iter < 100; iter++) {
        const newVector = Array(size).fill(0);
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            newVector[i] += matrix[i][j] * vector[j];
          }
        }
        ev = newVector.reduce((sum, v, i) => sum + v * vector[i], 0);
        norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
        if (norm < 1e-10) break;
        vector = newVector.map(v => v / norm);
      }
      return { vector, eigenvalue: ev };
    };

    // First PC
    const { vector: v1, eigenvalue: e1 } = powerIteration(gram);
    eigenvalue1 = e1;
    pc1Scores = v1.map(v => v * Math.sqrt(Math.abs(e1) * (n - 1)));

    // Deflate
    const deflated = gram.map((row, i) =>
      row.map((v, j) => v - e1 * v1[i] * v1[j])
    );

    // Second PC
    const { vector: v2, eigenvalue: e2 } = powerIteration(deflated);
    eigenvalue2 = e2;
    pc2Scores = v2.map(v => v * Math.sqrt(Math.abs(e2) * (n - 1)));
  } else {
    // Compute covariance matrix (m x m)
    const cov: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = i; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += centered[k][i] * centered[k][j];
        }
        cov[i][j] = sum / (n - 1);
        cov[j][i] = cov[i][j];
      }
    }

    // Total variance
    for (let i = 0; i < m; i++) {
      totalVariance += cov[i][i];
    }

    // Power iteration
    const powerIteration = (matrix: number[][]): { vector: number[]; eigenvalue: number } => {
      const size = matrix.length;
      let vector = Array(size).fill(0).map(() => Math.random());
      let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      vector = vector.map(v => v / norm);

      let ev = 0;
      for (let iter = 0; iter < 100; iter++) {
        const newVector = Array(size).fill(0);
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            newVector[i] += matrix[i][j] * vector[j];
          }
        }
        ev = newVector.reduce((sum, v, i) => sum + v * vector[i], 0);
        norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
        if (norm < 1e-10) break;
        vector = newVector.map(v => v / norm);
      }
      return { vector, eigenvalue: ev };
    };

    // First PC
    const { vector: pc1Vec, eigenvalue: e1 } = powerIteration(cov);
    eigenvalue1 = e1;
    pc1Scores = centered.map(row =>
      row.reduce((sum, v, j) => sum + v * pc1Vec[j], 0)
    );

    // Deflate
    const deflated = cov.map((row, i) =>
      row.map((v, j) => v - e1 * pc1Vec[i] * pc1Vec[j])
    );

    // Second PC
    const { vector: pc2Vec, eigenvalue: e2 } = powerIteration(deflated);
    eigenvalue2 = e2;
    pc2Scores = centered.map(row =>
      row.reduce((sum, v, j) => sum + v * pc2Vec[j], 0)
    );
  }

  const variance1 = totalVariance > 0 ? (eigenvalue1 / totalVariance) * 100 : 0;
  const variance2 = totalVariance > 0 ? (eigenvalue2 / totalVariance) * 100 : 0;

  return { pc1: pc1Scores, pc2: pc2Scores, variance1, variance2 };
};

export const PCAScatter = ({ samples, subtypeColors, userAnnotations, heatmapData, filterResetKey }: PCAScatterProps) => {
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [excludedSubtypes, setExcludedSubtypes] = useState<Set<string>>(new Set());
  const [excludedAnnotationValues, setExcludedAnnotationValues] = useState<Set<string>>(new Set());
  const [dataSource, setDataSource] = useState<PCADataSource>("expression");
  const chartRef = useRef<HTMLDivElement>(null);

  // Reset filters when global reset key changes
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setExcludedSubtypes(new Set());
      setExcludedAnnotationValues(new Set());
    }
  }, [filterResetKey]);

  // Generate colors for user annotation values
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations]);

  // Build sample index map for heatmap data
  const sampleIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    heatmapData.samples.forEach((sampleId, idx) => {
      map.set(sampleId, idx);
    });
    return map;
  }, [heatmapData.samples]);

  // Filter samples based on excluded subtypes or annotation values
  const filteredSamples = useMemo(() => {
    return samples.filter(s => {
      // Ensure sample exists in heatmap data
      if (!sampleIndexMap.has(s.sample_id)) return false;
      
      // If coloring by annotation, filter by annotation values
      if (selectedAnnotation && userAnnotations) {
        const annotValue = userAnnotations.annotations[s.sample_id]?.[selectedAnnotation];
        if (annotValue && excludedAnnotationValues.has(annotValue)) {
          return false;
        }
      }
      // Also filter by subtypes if not using annotation coloring
      if (!selectedAnnotation && excludedSubtypes.has(s.subtype)) {
        return false;
      }
      return true;
    });
  }, [samples, excludedSubtypes, excludedAnnotationValues, selectedAnnotation, userAnnotations, sampleIndexMap]);

  // Compute PCA from selected data source
  const { scatterData, uniqueSubtypes, uniqueAnnotationValues, variancePC1, variancePC2 } = useMemo(() => {
    const subtypes = [...new Set(samples.map(s => s.subtype))].sort();

    let pc1: number[];
    let pc2: number[];
    let variance1: number;
    let variance2: number;

    if (dataSource === "expression") {
      // Get filtered sample indices
      const filteredIndices = filteredSamples.map(s => sampleIndexMap.get(s.sample_id)!);
      
      // Extract expression data for filtered samples only
      const nGenes = heatmapData.genes.length;
      const nFilteredSamples = filteredIndices.length;
      
      // Create filtered expression matrix
      const filteredValues: number[][] = heatmapData.values.map(geneRow => 
        filteredIndices.map(idx => geneRow[idx])
      );

      // Compute PCA on gene expression data
      const result = computePCAFromExpression(filteredValues, nGenes, nFilteredSamples);
      pc1 = result.pc1;
      pc2 = result.pc2;
      variance1 = result.variance1;
      variance2 = result.variance2;
    } else {
      // Compute PCA on NMF scores
      const nmfData = filteredSamples.map(s => ({
        scores: Object.keys(s)
          .filter(k => k.startsWith("score_"))
          .sort()
          .map(k => (s as any)[k] as number)
      }));
      const result = computePCAFromNMF(nmfData);
      pc1 = result.pc1;
      pc2 = result.pc2;
      variance1 = result.variance1;
      variance2 = result.variance2;
    }

    const data = filteredSamples.map((sample, idx) => {
      const userAnnotValue = selectedAnnotation && userAnnotations?.annotations[sample.sample_id]
        ? userAnnotations.annotations[sample.sample_id][selectedAnnotation]
        : undefined;

      return {
        x: pc1[idx] || 0,
        y: pc2[idx] || 0,
        z: 50,
        subtype: sample.subtype,
        sample_id: sample.sample_id,
        userAnnotation: userAnnotValue,
      };
    });

    const annotValues = selectedAnnotation
      ? [...new Set(samples.map(s => userAnnotations?.annotations[s.sample_id]?.[selectedAnnotation]).filter(Boolean))].sort()
      : [];
    return { 
      scatterData: data, 
      uniqueSubtypes: subtypes, 
      uniqueAnnotationValues: annotValues,
      variancePC1: variance1,
      variancePC2: variance2
    };
  }, [filteredSamples, selectedAnnotation, userAnnotations, samples, heatmapData, sampleIndexMap, dataSource]);

  const toggleSubtype = (subtype: string) => {
    setExcludedSubtypes(prev => {
      const next = new Set(prev);
      if (next.has(subtype)) {
        next.delete(subtype);
      } else {
        next.add(subtype);
      }
      return next;
    });
  };

  const toggleAnnotationValue = (value: string) => {
    setExcludedAnnotationValues(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const getPointColor = (entry: typeof scatterData[0]) => {
    if (selectedAnnotation && entry.userAnnotation) {
      return userAnnotationColors[entry.userAnnotation] || "hsl(var(--muted))";
    }
    return subtypeColors[entry.subtype] || "hsl(var(--primary))";
  };

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "pca-plot");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "pca-plot");
  };

  const handleResetFilters = () => {
    setExcludedSubtypes(new Set());
    setExcludedAnnotationValues(new Set());
  };

  // Reset excluded values when changing annotation
  const handleAnnotationChange = (value: string | null) => {
    setSelectedAnnotation(value);
    setExcludedAnnotationValues(new Set());
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium">{data.sample_id}</p>
          <p className="text-xs text-muted-foreground">Subtype: {data.subtype}</p>
          {data.userAnnotation && selectedAnnotation && (
            <p className="text-xs text-muted-foreground">{selectedAnnotation}: {data.userAnnotation}</p>
          )}
          <p className="text-xs text-muted-foreground">
            PC1: {data.x.toFixed(2)}, PC2: {data.y.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  const isFiltered = selectedAnnotation ? excludedAnnotationValues.size > 0 : excludedSubtypes.size > 0;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-lg">Sample Clustering (PCA)</CardTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">NMF Scores</Label>
            <Switch
              checked={dataSource === "expression"}
              onCheckedChange={(checked) => setDataSource(checked ? "expression" : "nmf")}
              className="scale-75"
            />
            <Label className="text-xs text-muted-foreground">Expression</Label>
          </div>
          {userAnnotations && userAnnotations.columns.length > 0 && (
            <AnnotationSelector
              columns={userAnnotations.columns}
              selectedColumn={selectedAnnotation}
              onColumnChange={handleAnnotationChange}
              label="Color by"
            />
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadSVG}>
            <Download className="h-4 w-4 mr-1" />
            SVG
          </Button>
          {isFiltered && (
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[280px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="PC1"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ 
                  value: `PC1 (${variancePC1.toFixed(1)}%)`, 
                  position: "bottom", 
                  offset: 10, 
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="PC2"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ 
                  value: `PC2 (${variancePC2.toFixed(1)}%)`, 
                  angle: -90, 
                  position: "insideLeft", 
                  offset: 0, 
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }}
              />
              <ZAxis type="number" dataKey="z" range={[30, 60]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={scatterData}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getPointColor(entry)}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with clickable items */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {selectedAnnotation && uniqueAnnotationValues.length > 0 ? (
            <>
              <span className="text-xs text-muted-foreground font-medium">{selectedAnnotation} (click to exclude):</span>
              {uniqueAnnotationValues.map((value) => (
                <button
                  key={value}
                  className={`flex items-center gap-2 px-2 py-0.5 rounded transition-all ${
                    excludedAnnotationValues.has(value as string) ? "opacity-40 line-through" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleAnnotationValue(value as string)}
                  title={excludedAnnotationValues.has(value as string) ? `Click to include ${value}` : `Click to exclude ${value}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: userAnnotationColors[value as string] || "hsl(var(--primary))" }}
                  />
                  <span className="text-xs text-muted-foreground">{value}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground font-medium">NMF Subtypes (click to exclude):</span>
              {uniqueSubtypes.map((subtype) => (
                <button
                  key={subtype}
                  className={`flex items-center gap-2 px-2 py-0.5 rounded transition-all ${
                    excludedSubtypes.has(subtype) ? "opacity-40 line-through" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleSubtype(subtype)}
                  title={excludedSubtypes.has(subtype) ? `Click to include ${subtype}` : `Click to exclude ${subtype}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: subtypeColors[subtype] || "hsl(var(--primary))" }}
                  />
                  <span className="text-xs text-muted-foreground">{subtype}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {isFiltered && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Showing {filteredSamples.length} of {samples.length} samples
          </p>
        )}
      </CardContent>
    </Card>
  );
};
