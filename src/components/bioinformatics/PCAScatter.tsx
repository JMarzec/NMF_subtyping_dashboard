import { computePCA, nmfVectors } from "@/lib/dimensionality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult, generateSubtypeColors, isNumericColumn, getContinuousColor, createContinuousColorScale } from "@/data/mockNmfData";
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

const computePCAFromNMF = (samples: { scores: number[] }[]) => {
  const r=computePCA(samples.map(s=>s.scores));
  return {pc1:r.scores.map(v=>v[0]),pc2:r.scores.map(v=>v[1]??0),variance1:r.variance[0]??0,variance2:r.variance[1]??0};
};
const computePCAFromExpression = (values:number[][],_nGenes:number,nSamples:number) => computePCAFromNMF(Array.from({length:nSamples},(_,i)=>({scores:values.map(r=>r[i])})));

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

  // Check if selected annotation is numeric
  const isNumericAnnotation = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return false;
    const values = Object.values(userAnnotations.annotations)
      .map(annot => annot[selectedAnnotation])
      .filter(v => v !== undefined);
    return isNumericColumn(values);
  }, [selectedAnnotation, userAnnotations]);

  // Generate colors for user annotation values (categorical)
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations || isNumericAnnotation) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations, isNumericAnnotation]);

  // Create continuous color scale for numeric annotations
  const continuousColorScale = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations || !isNumericAnnotation) return null;
    const values = Object.values(userAnnotations.annotations)
      .map(annot => parseFloat(annot[selectedAnnotation]))
      .filter(v => !isNaN(v) && isFinite(v));
    if (values.length === 0) return null;
    return createContinuousColorScale(values, 'viridis');
  }, [selectedAnnotation, userAnnotations, isNumericAnnotation]);

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
      if (dataSource === "expression" && !sampleIndexMap.has(s.sample_id)) return false;
      
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
  }, [samples, excludedSubtypes, excludedAnnotationValues, selectedAnnotation, userAnnotations, sampleIndexMap, dataSource]);

  // Compute PCA from selected data source
  const { scatterData, uniqueSubtypes, uniqueAnnotationValues, variancePC1, variancePC2 } = useMemo(() => {
    const subtypes = [...new Set(samples.map(s => s.subtype))].sort();

    let pc1: number[];
    let pc2: number[];
    let variance1: number;
    let variance2: number;

    if (dataSource === "expression") {
      // Get filtered sample indices
      const filteredIndices = filteredSamples.map(s => sampleIndexMap.get(s.sample_id) ?? -1);
      
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
      const nmfData = nmfVectors(filteredSamples).map(scores=>({scores}));
      const result = computePCAFromNMF(nmfData);
      pc1 = result.pc1;
      pc2 = result.pc2;
      variance1 = result.variance1;
      variance2 = result.variance2;
    }

    const data = filteredSamples.filter((_,i)=>pc1[i] !== undefined).map((sample, idx) => {
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
    if (selectedAnnotation && entry.userAnnotation !== undefined) {
      if (isNumericAnnotation && continuousColorScale) {
        const numValue = parseFloat(String(entry.userAnnotation));
        if (!isNaN(numValue)) {
          return continuousColorScale.getColor(numValue);
        }
      }
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

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{payload:typeof scatterData[number]}> }) => {
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

        {/* Legend with clickable items or continuous color bar */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {selectedAnnotation && isNumericAnnotation && continuousColorScale ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{selectedAnnotation}:</span>
              <span className="text-xs text-muted-foreground">{continuousColorScale.min.toFixed(1)}</span>
              <div 
                className="w-32 h-4 rounded"
                style={{
                  background: `linear-gradient(to right, ${
                    [0, 0.25, 0.5, 0.75, 1].map(t => 
                      getContinuousColor(continuousColorScale.min + t * (continuousColorScale.max - continuousColorScale.min), 
                        continuousColorScale.min, continuousColorScale.max, 'viridis')
                    ).join(', ')
                  })`
                }}
              />
              <span className="text-xs text-muted-foreground">{continuousColorScale.max.toFixed(1)}</span>
            </div>
          ) : selectedAnnotation && uniqueAnnotationValues.length > 0 ? (
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
