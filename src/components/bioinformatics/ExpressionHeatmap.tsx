import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AnnotationSelector } from "./AnnotationSelector";
import { generateSubtypeColors } from "@/data/mockNmfData";
import { Dendrogram, DendrogramNode } from "./Dendrogram";

import { AnnotationData } from "./AnnotationUploader";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

interface ExpressionHeatmapProps {
  data: HeatmapData;
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
}

type ClusteringMethod = "none" | "average" | "complete" | "single" | "ward";
type DistanceMetric = "euclidean" | "manhattan" | "correlation";

const CLUSTERING_METHODS: { value: ClusteringMethod; label: string }[] = [
  { value: "none", label: "None" },
  { value: "average", label: "Average" },
  { value: "complete", label: "Complete" },
  { value: "single", label: "Single" },
  { value: "ward", label: "Ward" },
];

const DISTANCE_METRICS: { value: DistanceMetric; label: string }[] = [
  { value: "euclidean", label: "Euclidean" },
  { value: "manhattan", label: "Manhattan" },
  { value: "correlation", label: "Correlation" },
];

const getHeatmapColor = (value: number, min: number, max: number) => {
  const normalized = (value - min) / (max - min);
  if (normalized < 0.5) {
    // Blue to white
    const intensity = normalized * 2;
    return `rgb(${Math.round(59 + intensity * 196)}, ${Math.round(130 + intensity * 125)}, ${Math.round(246 + intensity * 9)})`;
  } else {
    // White to red
    const intensity = (normalized - 0.5) * 2;
    return `rgb(255, ${Math.round(255 - intensity * 155)}, ${Math.round(255 - intensity * 155)})`;
  }
};

// Z-score normalize rows (genes)
const zScoreNormalize = (values: number[][]): number[][] => {
  return values.map(row => {
    const mean = row.reduce((sum, v) => sum + v, 0) / row.length;
    const std = Math.sqrt(row.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / row.length);
    return std === 0 ? row.map(() => 0) : row.map(v => (v - mean) / std);
  });
};

// Calculate distance between two vectors based on metric
const calculateDistance = (a: number[], b: number[], metric: DistanceMetric): number => {
  switch (metric) {
    case "euclidean": {
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
      }
      return Math.sqrt(sum);
    }
    case "manhattan": {
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += Math.abs(a[i] - b[i]);
      }
      return sum;
    }
    case "correlation": {
      const meanA = a.reduce((s, v) => s + v, 0) / a.length;
      const meanB = b.reduce((s, v) => s + v, 0) / b.length;
      let num = 0, denA = 0, denB = 0;
      for (let i = 0; i < a.length; i++) {
        const devA = a[i] - meanA;
        const devB = b[i] - meanB;
        num += devA * devB;
        denA += devA * devA;
        denB += devB * devB;
      }
      const corr = denA > 0 && denB > 0 ? num / Math.sqrt(denA * denB) : 0;
      return 1 - corr; // Convert correlation to distance
    }
    default:
      return 0;
  }
};

// Hierarchical clustering implementation
interface ClusterNode {
  indices: number[];
  left?: ClusterNode;
  right?: ClusterNode;
  distance: number;
}

const calculateDistanceMatrix = (data: number[][], metric: DistanceMetric): number[][] => {
  const n = data.length;
  const distMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = calculateDistance(data[i], data[j], metric);
      distMatrix[i][j] = dist;
      distMatrix[j][i] = dist;
    }
  }
  return distMatrix;
};

const clusterDistance = (
  cluster1: ClusterNode,
  cluster2: ClusterNode,
  distMatrix: number[][],
  method: ClusteringMethod
): number => {
  const distances: number[] = [];
  
  for (const i of cluster1.indices) {
    for (const j of cluster2.indices) {
      distances.push(distMatrix[i][j]);
    }
  }
  
  switch (method) {
    case "single":
      return Math.min(...distances);
    case "complete":
      return Math.max(...distances);
    case "average":
      return distances.reduce((a, b) => a + b, 0) / distances.length;
    case "ward": {
      // Simplified Ward's method - uses average distance weighted by cluster sizes
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      const n1 = cluster1.indices.length;
      const n2 = cluster2.indices.length;
      return avgDist * Math.sqrt((2 * n1 * n2) / (n1 + n2));
    }
    default:
      return distances.reduce((a, b) => a + b, 0) / distances.length;
  }
};

const hierarchicalCluster = (
  data: number[][],
  method: ClusteringMethod,
  metric: DistanceMetric
): { order: number[]; tree: DendrogramNode | null } => {
  if (method === "none" || data.length <= 1) {
    return { order: data.map((_, i) => i), tree: null };
  }
  
  const distMatrix = calculateDistanceMatrix(data, metric);
  
  // Initialize clusters - each item is its own cluster
  let clusters: ClusterNode[] = data.map((_, i) => ({
    indices: [i],
    distance: 0,
  }));
  
  // Agglomerative clustering
  while (clusters.length > 1) {
    let minDist = Infinity;
    let minI = 0;
    let minJ = 1;
    
    // Find closest pair of clusters
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDistance(clusters[i], clusters[j], distMatrix, method);
        if (dist < minDist) {
          minDist = dist;
          minI = i;
          minJ = j;
        }
      }
    }
    
    // Merge clusters
    const newCluster: ClusterNode = {
      indices: [...clusters[minI].indices, ...clusters[minJ].indices],
      left: clusters[minI],
      right: clusters[minJ],
      distance: minDist,
    };
    
    // Remove merged clusters and add new one
    clusters = clusters.filter((_, i) => i !== minI && i !== minJ);
    clusters.push(newCluster);
  }
  
  // Extract leaf order from dendrogram
  const extractOrder = (node: ClusterNode): number[] => {
    if (!node.left && !node.right) {
      return node.indices;
    }
    const leftOrder = node.left ? extractOrder(node.left) : [];
    const rightOrder = node.right ? extractOrder(node.right) : [];
    return [...leftOrder, ...rightOrder];
  };
  
  const tree = clusters[0] as DendrogramNode;
  return { order: extractOrder(tree), tree };
};

// Transpose matrix for column clustering
const transpose = (matrix: number[][]): number[][] => {
  if (matrix.length === 0) return [];
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
};

export const ExpressionHeatmap = ({ data, subtypeColors, userAnnotations }: ExpressionHeatmapProps) => {
  const [hoveredCell, setHoveredCell] = useState<{ gene: string; sample: string; value: number; subtype: string; userAnnotation?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [useZScore, setUseZScore] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [sampleClusterMethod, setSampleClusterMethod] = useState<ClusteringMethod>("none");
  const [geneClusterMethod, setGeneClusterMethod] = useState<ClusteringMethod>("none");
  const [distanceMetric, setDistanceMetric] = useState<DistanceMetric>("euclidean");
  const [showDendrograms, setShowDendrograms] = useState(true);

  // Generate colors for user annotation values
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations]);

  const { displayValues, minVal, maxVal, sortedSampleIndices, sortedGeneIndices, uniqueSubtypes, sampleDendrogram, geneDendrogram } = useMemo(() => {
    const normalizedValues = useZScore ? zScoreNormalize(data.values) : data.values;
    const allValues = normalizedValues.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Cluster or sort samples
    let sampleIndices: number[];
    let sampleTree: DendrogramNode | null = null;
    if (sampleClusterMethod !== "none" && data.samples.length > 1) {
      const transposedData = transpose(normalizedValues);
      const result = hierarchicalCluster(transposedData, sampleClusterMethod, distanceMetric);
      sampleIndices = result.order;
      sampleTree = result.tree;
    } else {
      // Sort by subtype when not clustering
      sampleIndices = data.sampleSubtypes
        .map((subtype, idx) => ({ subtype, idx }))
        .sort((a, b) => a.subtype.localeCompare(b.subtype))
        .map(item => item.idx);
    }
    
    // Cluster or keep original gene order
    let geneIndices: number[];
    let geneTree: DendrogramNode | null = null;
    if (geneClusterMethod !== "none" && data.genes.length > 1) {
      const result = hierarchicalCluster(normalizedValues, geneClusterMethod, distanceMetric);
      geneIndices = result.order;
      geneTree = result.tree;
    } else {
      geneIndices = data.genes.map((_, i) => i);
    }
    
    const subtypes = [...new Set(data.sampleSubtypes)].sort();
    
    return { 
      displayValues: normalizedValues, 
      minVal: min, 
      maxVal: max, 
      sortedSampleIndices: sampleIndices, 
      sortedGeneIndices: geneIndices,
      uniqueSubtypes: subtypes,
      sampleDendrogram: sampleTree,
      geneDendrogram: geneTree
    };
  }, [data, useZScore, sampleClusterMethod, geneClusterMethod, distanceMetric]);

  const cellWidth = Math.max(4, Math.min(10, 600 / data.samples.length));
  const cellHeight = 12;

  const handleCellHover = (
    e: React.MouseEvent,
    geneIdx: number,
    sampleIdx: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    const sampleId = data.samples[sampleIdx];
    const userAnnotValue = selectedAnnotation && userAnnotations?.annotations[sampleId]
      ? userAnnotations.annotations[sampleId][selectedAnnotation]
      : undefined;
    setHoveredCell({
      gene: data.genes[geneIdx],
      sample: sampleId,
      value: displayValues[geneIdx][sampleIdx],
      subtype: data.sampleSubtypes[sampleIdx],
      userAnnotation: userAnnotValue,
    });
  };

  const exportToCSV = () => {
    const header = ["Gene", ...sortedSampleIndices.map(idx => data.samples[idx])];
    const subtypeRow = ["Subtype", ...sortedSampleIndices.map(idx => data.sampleSubtypes[idx])];
    const dataRows = sortedGeneIndices.map((geneIdx) => [
      data.genes[geneIdx],
      ...sortedSampleIndices.map(sampleIdx => displayValues[geneIdx][sampleIdx].toFixed(4))
    ]);
    
    const csvContent = [header, subtypeRow, ...dataRows]
      .map(row => row.join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heatmap_${useZScore ? "zscore" : "raw"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm relative">
      <CardHeader className="flex flex-col space-y-2 pb-2">
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Expression Heatmap ({data.genes.length} genes × {data.samples.length} samples)</CardTitle>
          <div className="flex items-center gap-4 flex-wrap">
            {userAnnotations && userAnnotations.columns.length > 0 && (
              <AnnotationSelector
                columns={userAnnotations.columns}
                selectedColumn={selectedAnnotation}
                onColumnChange={setSelectedAnnotation}
              />
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="zscore-toggle"
                checked={useZScore}
                onCheckedChange={setUseZScore}
              />
              <Label htmlFor="zscore-toggle" className="text-xs text-muted-foreground">
                Z-score
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
        
        {/* Clustering options */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Sample clustering:</Label>
            <Select value={sampleClusterMethod} onValueChange={(v) => setSampleClusterMethod(v as ClusteringMethod)}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                {CLUSTERING_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Gene clustering:</Label>
            <Select value={geneClusterMethod} onValueChange={(v) => setGeneClusterMethod(v as ClusteringMethod)}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                {CLUSTERING_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Distance:</Label>
            <Select value={distanceMetric} onValueChange={(v) => setDistanceMetric(v as DistanceMetric)}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                {DISTANCE_METRICS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dendrogram-toggle"
              checked={showDendrograms}
              onCheckedChange={setShowDendrograms}
              className="scale-75"
            />
            <Label htmlFor="dendrogram-toggle" className="text-xs text-muted-foreground">
              Dendrograms
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Sample dendrogram (horizontal, above heatmap) */}
          {showDendrograms && sampleDendrogram && sampleClusterMethod !== "none" && (
            <div className="flex mb-1">
              <div style={{ width: 72 + 8 }} /> {/* Spacer for gene labels */}
              {geneDendrogram && geneClusterMethod !== "none" && <div style={{ width: 40 }} />} {/* Spacer for gene dendrogram */}
              <Dendrogram
                root={sampleDendrogram}
                width={cellWidth * data.samples.length}
                height={40}
                orientation="horizontal"
                itemSize={cellWidth}
              />
            </div>
          )}

          {/* User annotation bar (if selected) */}
          {selectedAnnotation && userAnnotations && (
            <div className="flex mb-0.5">
              <div className="mr-2 text-[8px] text-muted-foreground text-right truncate pr-1" style={{ width: 72 }}>
                {selectedAnnotation}
              </div>
              {showDendrograms && geneDendrogram && geneClusterMethod !== "none" && <div style={{ width: 40 }} />}
              <div className="flex">
                {sortedSampleIndices.map((idx, i) => {
                  const sampleId = data.samples[idx];
                  const value = userAnnotations.annotations[sampleId]?.[selectedAnnotation] || "";
                  return (
                    <div
                      key={`annot-${i}`}
                      style={{
                        width: cellWidth,
                        height: 8,
                        backgroundColor: userAnnotationColors[value] || "hsl(var(--muted))",
                      }}
                      title={`${selectedAnnotation}: ${value}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Subtype annotation bar */}
          <div className="flex mb-1">
            <div className="mr-2 text-[8px] text-muted-foreground text-right truncate pr-1" style={{ width: 72 }}>
              NMF Subtype
            </div>
            {showDendrograms && geneDendrogram && geneClusterMethod !== "none" && <div style={{ width: 40 }} />}
            <div className="flex">
              {sortedSampleIndices.map((idx, i) => (
                <div
                  key={i}
                  style={{
                    width: cellWidth,
                    height: 8,
                    backgroundColor: subtypeColors[data.sampleSubtypes[idx]] || "hsl(var(--primary))",
                  }}
                  title={`${data.samples[idx]} - ${data.sampleSubtypes[idx]}`}
                />
              ))}
            </div>
          </div>
          
          {/* Heatmap grid with gene dendrogram */}
          <div className="flex">
            {/* Gene labels */}
            <div className="flex flex-col mr-2" style={{ width: 72 }}>
              {sortedGeneIndices.map((geneIdx) => (
                <div
                  key={geneIdx}
                  className="text-xs text-right pr-1 truncate text-muted-foreground"
                  style={{ height: cellHeight, lineHeight: `${cellHeight}px` }}
                >
                  {data.genes[geneIdx]}
                </div>
              ))}
            </div>

            {/* Gene dendrogram (vertical, left of heatmap) */}
            {showDendrograms && geneDendrogram && geneClusterMethod !== "none" && (
              <div className="mr-1">
                <Dendrogram
                  root={geneDendrogram}
                  width={40}
                  height={cellHeight * data.genes.length}
                  orientation="vertical"
                  itemSize={cellHeight}
                />
              </div>
            )}
            
            {/* Heatmap cells */}
            <div>
              {sortedGeneIndices.map((geneIdx) => (
                <div key={geneIdx} className="flex">
                  {sortedSampleIndices.map((sampleIdx, i) => (
                    <div
                      key={i}
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: getHeatmapColor(displayValues[geneIdx][sampleIdx], minVal, maxVal),
                      }}
                      className="cursor-pointer hover:ring-1 hover:ring-white hover:z-10"
                      onMouseEnter={(e) => handleCellHover(e, geneIdx, sampleIdx)}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Color scale legend */}
          <div className="flex items-center justify-center mt-4 gap-2">
            <span className="text-xs text-muted-foreground">{useZScore ? "Low (Z)" : "Low"}</span>
            <div className="flex h-3">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    backgroundColor: getHeatmapColor(i / 49, 0, 1),
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{useZScore ? "High (Z)" : "High"}</span>
          </div>
          
          {/* Subtype legend */}
          <div className="flex flex-wrap gap-4 mt-3 justify-center">
            <span className="text-xs text-muted-foreground font-medium">NMF Subtypes:</span>
            {uniqueSubtypes.map((subtype) => (
              <div key={subtype} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: subtypeColors[subtype] || "hsl(var(--primary))" }} 
                />
                <span className="text-xs text-muted-foreground">{subtype}</span>
              </div>
            ))}
          </div>

          {/* User annotation legend */}
          {selectedAnnotation && Object.keys(userAnnotationColors).length > 0 && (
            <div className="flex flex-wrap gap-4 mt-2 justify-center border-t border-border/50 pt-2">
              <span className="text-xs text-muted-foreground font-medium">{selectedAnnotation}:</span>
              {Object.entries(userAnnotationColors).map(([value, color]) => (
                <div key={value} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: color }} 
                  />
                  <span className="text-xs text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tooltip */}
        {hoveredCell && (
          <div
            className="fixed z-50 bg-card border border-border rounded-lg p-2 shadow-lg pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm font-medium">{hoveredCell.sample}</p>
            <p className="text-xs text-muted-foreground">Gene: {hoveredCell.gene}</p>
            <p className="text-xs text-muted-foreground">Subtype: {hoveredCell.subtype}</p>
            {hoveredCell.userAnnotation && selectedAnnotation && (
              <p className="text-xs text-muted-foreground">{selectedAnnotation}: {hoveredCell.userAnnotation}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {useZScore ? "Z-score" : "Expression"}: {hoveredCell.value.toFixed(2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};