import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState, useRef, useCallback } from "react";
import { Download, RotateCcw } from "lucide-react";
import { AnnotationSelector } from "./AnnotationSelector";
import { generateSubtypeColors } from "@/data/mockNmfData";
import { Dendrogram, DendrogramNode } from "./Dendrogram";
import html2canvas from "html2canvas";

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
  const [useZScore, setUseZScore] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [sampleClusterMethod, setSampleClusterMethod] = useState<ClusteringMethod>("ward");
  const [geneClusterMethod, setGeneClusterMethod] = useState<ClusteringMethod>("ward");
  const [distanceMetric, setDistanceMetric] = useState<DistanceMetric>("euclidean");
  const [showDendrograms, setShowDendrograms] = useState(true);
  const [excludedSubtypes, setExcludedSubtypes] = useState<Set<string>>(new Set());
  const [excludedAnnotationValues, setExcludedAnnotationValues] = useState<Set<string>>(new Set());
  const heatmapRef = useRef<HTMLDivElement>(null);

  // Generate colors for user annotation values
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations]);

  // Toggle subtype exclusion
  const toggleSubtypeExclusion = useCallback((subtype: string) => {
    setExcludedSubtypes(prev => {
      const next = new Set(prev);
      if (next.has(subtype)) {
        next.delete(subtype);
      } else {
        next.add(subtype);
      }
      return next;
    });
  }, []);

  // Toggle annotation value exclusion
  const toggleAnnotationExclusion = useCallback((value: string) => {
    setExcludedAnnotationValues(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  // Filter samples based on exclusions
  const filteredData = useMemo(() => {
    let includedIndices = data.samples.map((_, i) => i);
    
    // Filter by subtype exclusions
    if (excludedSubtypes.size > 0) {
      includedIndices = includedIndices.filter(i => !excludedSubtypes.has(data.sampleSubtypes[i]));
    }
    
    // Filter by annotation exclusions
    if (selectedAnnotation && userAnnotations && excludedAnnotationValues.size > 0) {
      includedIndices = includedIndices.filter(i => {
        const sampleId = data.samples[i];
        const annotValue = userAnnotations.annotations[sampleId]?.[selectedAnnotation];
        return !annotValue || !excludedAnnotationValues.has(annotValue);
      });
    }
    
    return {
      samples: includedIndices.map(i => data.samples[i]),
      sampleSubtypes: includedIndices.map(i => data.sampleSubtypes[i]),
      values: data.values.map(row => includedIndices.map(i => row[i])),
      genes: data.genes,
      originalIndices: includedIndices,
    };
  }, [data, excludedSubtypes, excludedAnnotationValues, selectedAnnotation, userAnnotations]);

  const { displayValues, minVal, maxVal, sortedSampleIndices, sortedGeneIndices, uniqueSubtypes, sampleDendrogram, geneDendrogram } = useMemo(() => {
    const normalizedValues = useZScore ? zScoreNormalize(filteredData.values) : filteredData.values;
    const allValues = normalizedValues.flat();
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 1;
    
    // Cluster or sort samples
    let sampleIndices: number[];
    let sampleTree: DendrogramNode | null = null;
    if (sampleClusterMethod !== "none" && filteredData.samples.length > 1) {
      const transposedData = transpose(normalizedValues);
      const result = hierarchicalCluster(transposedData, sampleClusterMethod, distanceMetric);
      sampleIndices = result.order;
      sampleTree = result.tree;
    } else {
      // Sort by subtype when not clustering
      sampleIndices = filteredData.sampleSubtypes
        .map((subtype, idx) => ({ subtype, idx }))
        .sort((a, b) => a.subtype.localeCompare(b.subtype))
        .map(item => item.idx);
    }
    
    // Cluster or keep original gene order
    let geneIndices: number[];
    let geneTree: DendrogramNode | null = null;
    if (geneClusterMethod !== "none" && filteredData.genes.length > 1) {
      const result = hierarchicalCluster(normalizedValues, geneClusterMethod, distanceMetric);
      geneIndices = result.order;
      geneTree = result.tree;
    } else {
      geneIndices = filteredData.genes.map((_, i) => i);
    }
    
    const subtypes = [...new Set(data.sampleSubtypes)].sort(); // Use original data for all subtypes
    
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
  }, [filteredData, data.sampleSubtypes, useZScore, sampleClusterMethod, geneClusterMethod, distanceMetric]);

  const cellWidth = Math.max(4, Math.min(10, 600 / filteredData.samples.length));
  const cellHeight = 12;

  const handleCellHover = (
    e: React.MouseEvent,
    geneIdx: number,
    sampleIdx: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    const sampleId = filteredData.samples[sampleIdx];
    const userAnnotValue = selectedAnnotation && userAnnotations?.annotations[sampleId]
      ? userAnnotations.annotations[sampleId][selectedAnnotation]
      : undefined;
    setHoveredCell({
      gene: filteredData.genes[geneIdx],
      sample: sampleId,
      value: displayValues[geneIdx][sampleIdx],
      subtype: filteredData.sampleSubtypes[sampleIdx],
      userAnnotation: userAnnotValue,
    });
  };

  const exportToCSV = () => {
    const header = ["Gene", ...sortedSampleIndices.map(idx => filteredData.samples[idx])];
    const subtypeRow = ["Subtype", ...sortedSampleIndices.map(idx => filteredData.sampleSubtypes[idx])];
    const dataRows = sortedGeneIndices.map((geneIdx) => [
      filteredData.genes[geneIdx],
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

  const handleDownloadPNG = async () => {
    if (!heatmapRef.current) return;
    try {
      const element = heatmapRef.current;
      
      // Calculate required dimensions including all content
      const scrollWidth = element.scrollWidth;
      const scrollHeight = element.scrollHeight;
      
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 4,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: scrollWidth + 200,
        height: scrollHeight + 150,
        windowWidth: scrollWidth + 200,
        windowHeight: scrollHeight + 150,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedElement) => {
          // Force all text to use web-safe fonts
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el) => {
            if (el instanceof HTMLElement) {
              // Use system fonts that render reliably
              el.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
              
              // Fix vertical text rendering
              if (el.style.writingMode === 'vertical-rl' || getComputedStyle(el).writingMode === 'vertical-rl') {
                el.style.fontFamily = 'Arial, sans-serif';
                el.style.letterSpacing = '0px';
                el.style.fontSize = '8px';
              }
            }
          });
          
          // Add padding to the container
          clonedElement.style.padding = '20px';
          clonedElement.style.paddingRight = '180px';
          clonedElement.style.paddingBottom = '120px';
        }
      });
      
      const link = document.createElement("a");
      link.download = "expression-heatmap.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export heatmap:", error);
    }
  };

  const handleDownloadSVG = () => {
    if (!heatmapRef.current) return;
    
    // Create SVG from the heatmap content
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    
    const padding = { top: 80, right: 120, bottom: 100, left: 20 };
    const heatmapWidthPx = cellWidth * filteredData.samples.length;
    const heatmapHeightPx = cellHeight * filteredData.genes.length;
    const dendrogramWidth = showDendrograms && geneDendrogram ? 50 : 0;
    const geneLabelWidth = 100;
    
    const totalWidth = padding.left + heatmapWidthPx + dendrogramWidth + geneLabelWidth + padding.right;
    const totalHeight = padding.top + heatmapHeightPx + padding.bottom;
    
    svg.setAttribute("width", String(totalWidth));
    svg.setAttribute("height", String(totalHeight));
    svg.setAttribute("xmlns", svgNS);
    
    // White background
    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "white");
    svg.appendChild(bg);
    
    // Sample names (vertical)
    sortedSampleIndices.forEach((idx, i) => {
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(padding.left + i * cellWidth + cellWidth / 2));
      text.setAttribute("y", String(padding.top - 5));
      text.setAttribute("font-size", "6");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#666");
      text.setAttribute("text-anchor", "start");
      text.setAttribute("transform", `rotate(-90, ${padding.left + i * cellWidth + cellWidth / 2}, ${padding.top - 5})`);
      text.textContent = filteredData.samples[idx];
      svg.appendChild(text);
    });
    
    // Subtype annotation bar
    sortedSampleIndices.forEach((idx, i) => {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(padding.left + i * cellWidth));
      rect.setAttribute("y", String(padding.top - 12));
      rect.setAttribute("width", String(cellWidth));
      rect.setAttribute("height", "8");
      rect.setAttribute("fill", subtypeColors[filteredData.sampleSubtypes[idx]] || "#666");
      svg.appendChild(rect);
    });
    
    // Heatmap cells
    sortedGeneIndices.forEach((geneIdx, gi) => {
      sortedSampleIndices.forEach((sampleIdx, si) => {
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", String(padding.left + si * cellWidth));
        rect.setAttribute("y", String(padding.top + gi * cellHeight));
        rect.setAttribute("width", String(cellWidth));
        rect.setAttribute("height", String(cellHeight));
        rect.setAttribute("fill", getHeatmapColor(displayValues[geneIdx][sampleIdx], minVal, maxVal));
        svg.appendChild(rect);
      });
    });
    
    // Gene labels on right
    sortedGeneIndices.forEach((geneIdx, gi) => {
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(padding.left + heatmapWidthPx + dendrogramWidth + 10));
      text.setAttribute("y", String(padding.top + gi * cellHeight + cellHeight / 2 + 3));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#666");
      text.textContent = filteredData.genes[geneIdx];
      svg.appendChild(text);
    });
    
    // Color scale legend
    const legendY = padding.top + heatmapHeightPx + 30;
    const legendWidth = 200;
    const legendHeight = 12;
    const legendX = (totalWidth - legendWidth) / 2;
    
    // Legend gradient
    for (let i = 0; i < 50; i++) {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(legendX + i * (legendWidth / 50)));
      rect.setAttribute("y", String(legendY));
      rect.setAttribute("width", String(legendWidth / 50 + 1));
      rect.setAttribute("height", String(legendHeight));
      rect.setAttribute("fill", getHeatmapColor(i / 49, 0, 1));
      svg.appendChild(rect);
    }
    
    // Legend labels
    const lowLabel = document.createElementNS(svgNS, "text");
    lowLabel.setAttribute("x", String(legendX - 30));
    lowLabel.setAttribute("y", String(legendY + legendHeight / 2 + 4));
    lowLabel.setAttribute("font-size", "10");
    lowLabel.setAttribute("font-family", "Arial, sans-serif");
    lowLabel.setAttribute("fill", "#666");
    lowLabel.textContent = useZScore ? "Low (Z)" : "Low";
    svg.appendChild(lowLabel);
    
    const highLabel = document.createElementNS(svgNS, "text");
    highLabel.setAttribute("x", String(legendX + legendWidth + 5));
    highLabel.setAttribute("y", String(legendY + legendHeight / 2 + 4));
    highLabel.setAttribute("font-size", "10");
    highLabel.setAttribute("font-family", "Arial, sans-serif");
    highLabel.setAttribute("fill", "#666");
    highLabel.textContent = useZScore ? "High (Z)" : "High";
    svg.appendChild(highLabel);
    
    // Subtype legend
    const subtypeLegendY = legendY + 35;
    let xOffset = padding.left;
    uniqueSubtypes.forEach((subtype) => {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(xOffset));
      rect.setAttribute("y", String(subtypeLegendY));
      rect.setAttribute("width", "12");
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", subtypeColors[subtype] || "#666");
      svg.appendChild(rect);
      
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(xOffset + 16));
      text.setAttribute("y", String(subtypeLegendY + 10));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#666");
      text.textContent = subtype;
      svg.appendChild(text);
      
      xOffset += 16 + subtype.length * 6 + 20;
    });
    
    // Download SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "expression-heatmap.svg";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = useCallback(() => {
    setExcludedSubtypes(new Set());
    setExcludedAnnotationValues(new Set());
  }, []);

  const heatmapWidth = cellWidth * filteredData.samples.length;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm relative">
      <CardHeader className="flex flex-col space-y-2 pb-2">
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">
            Expression Heatmap ({filteredData.genes.length} genes × {filteredData.samples.length} samples)
            {(excludedSubtypes.size > 0 || excludedAnnotationValues.size > 0) && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (filtered from {data.samples.length})
              </span>
            )}
          </CardTitle>
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
            <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
              <Download className="h-4 w-4 mr-1" />
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadSVG}>
              <Download className="h-4 w-4 mr-1" />
              SVG
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            {(excludedSubtypes.size > 0 || excludedAnnotationValues.size > 0) && (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
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
      <CardContent className="pb-6">
        <div className="overflow-x-auto" ref={heatmapRef}>
          {/* Sample dendrogram (horizontal, above heatmap) */}
          {showDendrograms && sampleDendrogram && sampleClusterMethod !== "none" && (
            <div className="flex mb-1">
              <div style={{ width: heatmapWidth }} />
              <div style={{ width: 4 }} /> {/* Small gap */}
              <div style={{ width: 80 }} /> {/* Gene labels spacer */}
              {showDendrograms && geneDendrogram && geneClusterMethod !== "none" && <div style={{ width: 44 }} />}
            </div>
          )}
          {showDendrograms && sampleDendrogram && sampleClusterMethod !== "none" && (
            <div className="flex mb-1 justify-start">
              <Dendrogram
                root={sampleDendrogram}
                width={heatmapWidth}
                height={40}
                orientation="horizontal"
                itemSize={cellWidth}
              />
            </div>
          )}

          {/* Sample IDs row */}
          <div className="flex mb-0.5">
            <div className="flex">
              {sortedSampleIndices.map((idx, i) => (
                <div
                  key={`sample-${i}`}
                  className="text-[6px] text-muted-foreground overflow-hidden"
                  style={{
                    width: cellWidth,
                    height: 50,
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    transform: "rotate(180deg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                  title={filteredData.samples[idx]}
                >
                  <span className="truncate">{filteredData.samples[idx]}</span>
                </div>
              ))}
            </div>
            <div style={{ width: 4 }} />
            <div className="text-[8px] text-muted-foreground text-left truncate pl-1 flex items-end" style={{ width: 80, height: 50 }}>
              Sample ID
            </div>
          </div>

          {/* User annotation bar (if selected) */}
          {selectedAnnotation && userAnnotations && (
            <div className="flex mb-0.5">
              <div className="flex">
                {sortedSampleIndices.map((idx, i) => {
                  const sampleId = filteredData.samples[idx];
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
              <div style={{ width: 4 }} />
              <div className="text-[8px] text-muted-foreground text-left truncate pl-1" style={{ width: 80 }}>
                {selectedAnnotation}
              </div>
            </div>
          )}
          
          {/* Subtype annotation bar */}
          <div className="flex mb-1">
            <div className="flex">
              {sortedSampleIndices.map((idx, i) => (
                <div
                  key={i}
                  style={{
                    width: cellWidth,
                    height: 8,
                    backgroundColor: subtypeColors[filteredData.sampleSubtypes[idx]] || "hsl(var(--primary))",
                  }}
                  title={`${filteredData.samples[idx]} - ${filteredData.sampleSubtypes[idx]}`}
                />
              ))}
            </div>
            <div style={{ width: 4 }} />
            <div className="text-[8px] text-muted-foreground text-left truncate pl-1" style={{ width: 80 }}>
              NMF Subtype
            </div>
          </div>
          
          {/* Heatmap grid with gene dendrogram on RIGHT */}
          <div className="flex">
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

            {/* Gene dendrogram (vertical, right of heatmap) */}
            {showDendrograms && geneDendrogram && geneClusterMethod !== "none" && (
              <div className="ml-1" style={{ width: 40 }}>
                <Dendrogram
                  root={geneDendrogram}
                  width={40}
                  height={cellHeight * filteredData.genes.length}
                  orientation="vertical-right"
                  itemSize={cellHeight}
                />
              </div>
            )}

            {/* Gene labels on RIGHT */}
            <div className="flex flex-col pl-2" style={{ width: 80 }}>
              {sortedGeneIndices.map((geneIdx) => (
                <div
                  key={geneIdx}
                  className="text-xs text-left truncate text-muted-foreground"
                  style={{ height: cellHeight, lineHeight: `${cellHeight}px` }}
                >
                  {filteredData.genes[geneIdx]}
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
          
          {/* Subtype legend - clickable for exclusion */}
          <div className="flex flex-wrap gap-4 mt-3 justify-center pb-2">
            <span className="text-xs text-muted-foreground font-medium">NMF Subtypes (click to exclude):</span>
            {uniqueSubtypes.map((subtype) => {
              const isExcluded = excludedSubtypes.has(subtype);
              return (
                <div 
                  key={subtype} 
                  className={`flex items-center gap-2 cursor-pointer transition-opacity ${isExcluded ? 'opacity-40' : 'hover:opacity-80'}`}
                  onClick={() => toggleSubtypeExclusion(subtype)}
                  title={isExcluded ? `Click to include ${subtype}` : `Click to exclude ${subtype}`}
                >
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ 
                      backgroundColor: subtypeColors[subtype] || "hsl(var(--primary))",
                      textDecoration: isExcluded ? 'line-through' : 'none',
                    }} 
                  />
                  <span className={`text-xs text-muted-foreground ${isExcluded ? 'line-through' : ''}`}>{subtype}</span>
                </div>
              );
            })}
          </div>

          {/* User annotation legend - clickable for exclusion */}
          {selectedAnnotation && Object.keys(userAnnotationColors).length > 0 && (
            <div className="flex flex-wrap gap-4 mt-2 justify-center border-t border-border/50 pt-2 pb-2">
              <span className="text-xs text-muted-foreground font-medium">{selectedAnnotation} (click to exclude):</span>
              {Object.entries(userAnnotationColors).map(([value, color]) => {
                const isExcluded = excludedAnnotationValues.has(value);
                return (
                  <div 
                    key={value} 
                    className={`flex items-center gap-2 cursor-pointer transition-opacity ${isExcluded ? 'opacity-40' : 'hover:opacity-80'}`}
                    onClick={() => toggleAnnotationExclusion(value)}
                    title={isExcluded ? `Click to include ${value}` : `Click to exclude ${value}`}
                  >
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: color }} 
                    />
                    <span className={`text-xs text-muted-foreground ${isExcluded ? 'line-through' : ''}`}>{value}</span>
                  </div>
                );
              })}
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
