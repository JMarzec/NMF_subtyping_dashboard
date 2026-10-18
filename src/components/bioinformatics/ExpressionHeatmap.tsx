import Papa from "papaparse";
import { useClustering } from "@/hooks/useClustering";
import { HeatmapCanvas } from "./HeatmapCanvas";
import { hierarchicalCluster, matrixExtent, type ClusteringMethod, type DistanceMetric } from "@/lib/clustering";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import React, { useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Download, RotateCcw } from "lucide-react";
import { AnnotationSelector } from "./AnnotationSelector";
import { generateSubtypeColors, MarkerGene, isNumericColumn, getContinuousColor, createContinuousColorScale } from "@/data/mockNmfData";
import { Dendrogram, DendrogramNode } from "./Dendrogram";
import html2canvas from "html2canvas";

import { AnnotationData } from "./AnnotationUploader";
import { usePlotFilters } from "./PlotFilters";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

export interface ExpressionHeatmapRef {
  getSVGString: () => string | null;
}

interface ExpressionHeatmapProps {
  data: HeatmapData;
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
  filterResetKey?: number;
  markerGenesPerSubtype?: number;
  markerGenes?: MarkerGene[];
}

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
  const normalized = max === min ? 0.5 : (value - min) / (max - min);
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

// Transpose matrix for column clustering
const transpose = (matrix: number[][]): number[][] => {
  if (matrix.length === 0) return [];
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
};

export const ExpressionHeatmap = forwardRef<ExpressionHeatmapRef, ExpressionHeatmapProps>(({ data, subtypeColors, userAnnotations, filterResetKey, markerGenesPerSubtype, markerGenes }, ref) => {
  const [hoveredCell, setHoveredCell] = useState<{ gene: string; sample: string; value: number; subtype: string; userAnnotation?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [useZScore, setUseZScore] = useState(false);
  const {selectedAnnotation,setSelectedAnnotation,excludedSubtypes,setExcludedSubtypes,excludedAnnotationValues,setExcludedAnnotationValues}=usePlotFilters();
  const [sampleClusterMethod, setSampleClusterMethod] = useState<ClusteringMethod>("ward");
  const [geneClusterMethod, setGeneClusterMethod] = useState<ClusteringMethod>("ward");
  const [distanceMetric, setDistanceMetric] = useState<DistanceMetric>("euclidean");
  const [showDendrograms, setShowDendrograms] = useState(true);

  // Reset filters when global reset key changes
  React.useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setExcludedSubtypes(new Set());
      setExcludedAnnotationValues(new Set());
    }
  }, [filterResetKey]);

  // Filter genes based on marker genes per subtype setting
  const geneFilteredData = useMemo(() => {
    if (!markerGenes || !markerGenesPerSubtype) {
      return data;
    }

    // Get top marker genes per subtype
    const subtypes = [...new Set(markerGenes.map(g => g.subtype))];
    const topGeneNames = new Set<string>();
    
    subtypes.forEach(subtype => {
      const subtypeGenes = markerGenes
        .filter(g => g.subtype === subtype)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, markerGenesPerSubtype);
      subtypeGenes.forEach(g => topGeneNames.add(g.gene));
    });

    // Filter heatmap data to only include these genes
    const geneIndices: number[] = [];
    data.genes.forEach((gene, idx) => {
      if (topGeneNames.has(gene)) {
        geneIndices.push(idx);
      }
    });

    // If no matching genes found, return original data
    if (geneIndices.length === 0) {
      return data;
    }

    return {
      genes: geneIndices.map(i => data.genes[i]),
      samples: data.samples,
      sampleSubtypes: data.sampleSubtypes,
      values: geneIndices.map(i => data.values[i]),
    };
  }, [data, markerGenes, markerGenesPerSubtype]);

  // Outer scroll container (for UI)
  const heatmapScrollRef = useRef<HTMLDivElement>(null);
  // Inner content container (for exports)
  const heatmapExportRef = useRef<HTMLDivElement>(null);

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

  // Get color for annotation value (handles both categorical and continuous)
  const getAnnotationColor = useCallback((value: string | undefined): string => {
    if (value === undefined || value === null || value === '') {
      return "hsl(var(--muted))";
    }
    if (isNumericAnnotation && continuousColorScale) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return continuousColorScale.getColor(numValue);
      }
    }
    return userAnnotationColors[value] || "hsl(var(--muted))";
  }, [isNumericAnnotation, continuousColorScale, userAnnotationColors]);

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
    let includedIndices = geneFilteredData.samples.map((_, i) => i);

    // Filter by subtype exclusions
    if (excludedSubtypes.size > 0) {
      includedIndices = includedIndices.filter(i => !excludedSubtypes.has(geneFilteredData.sampleSubtypes[i]));
    }

    // Filter by annotation exclusions
    if (selectedAnnotation && userAnnotations && excludedAnnotationValues.size > 0) {
      includedIndices = includedIndices.filter(i => {
        const sampleId = geneFilteredData.samples[i];
        const annotValue = userAnnotations.annotations[sampleId]?.[selectedAnnotation];
        return !annotValue || !excludedAnnotationValues.has(annotValue);
      });
    }

    return {
      samples: includedIndices.map(i => geneFilteredData.samples[i]),
      sampleSubtypes: includedIndices.map(i => geneFilteredData.sampleSubtypes[i]),
      values: geneFilteredData.values.map(row => includedIndices.map(i => row[i])),
      genes: geneFilteredData.genes,
      originalIndices: includedIndices,
    };
  }, [geneFilteredData, excludedSubtypes, excludedAnnotationValues, selectedAnnotation, userAnnotations]);

  const displayValues=useMemo(()=>useZScore?zScoreNormalize(filteredData.values):filteredData.values,[useZScore,filteredData.values]);
  const transposed=useMemo(()=>transpose(displayValues),[displayValues]);
  const samplesCluster=useClustering(transposed,sampleClusterMethod,distanceMetric);
  const genesCluster=useClustering(displayValues,geneClusterMethod,distanceMetric);
  const sortedSampleIndices=samplesCluster.order.length===filteredData.samples.length?samplesCluster.order:filteredData.samples.map((_,i)=>i);
  const sortedGeneIndices=genesCluster.order.length===filteredData.genes.length?genesCluster.order:filteredData.genes.map((_,i)=>i);
  const sampleDendrogram=samplesCluster.tree,geneDendrogram=genesCluster.tree;
  const {min:minVal,max:maxVal}=useMemo(()=>matrixExtent(displayValues),[displayValues]);
  const uniqueSubtypes=useMemo(()=>[...new Set(geneFilteredData.sampleSubtypes)].sort(),[geneFilteredData.sampleSubtypes]);

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

    const csvContent = Papa.unparse([header, subtypeRow, ...dataRows]);

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heatmap_${useZScore ? "zscore" : "raw"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: get dendrogram line segments (same logic as Dendrogram component)
  const getDendrogramLines = useCallback((
    root: DendrogramNode,
    width: number,
    height: number,
    orientation: "horizontal" | "vertical" | "vertical-right",
    itemSize: number
  ): { x1: number; y1: number; x2: number; y2: number }[] => {
    if (!root || (!root.left && !root.right)) return [];

    const leafPositions = new Map<number, number>();
    const currentPos = { value: itemSize / 2 };

    const getLeafPositions = (node: DendrogramNode) => {
      if (!node.left && !node.right) {
        leafPositions.set(node.indices[0], currentPos.value);
        currentPos.value += itemSize;
        return;
      }
      if (node.left) getLeafPositions(node.left);
      if (node.right) getLeafPositions(node.right);
    };

    const getNodePosition = (node: DendrogramNode): number => {
      if (!node.left && !node.right) {
        return leafPositions.get(node.indices[0]) || 0;
      }
      const leftPos = node.left ? getNodePosition(node.left) : 0;
      const rightPos = node.right ? getNodePosition(node.right) : 0;
      return (leftPos + rightPos) / 2;
    };

    const getMaxDistance = (node: DendrogramNode): number => {
      if (!node.left && !node.right) return 0;
      const leftMax = node.left ? getMaxDistance(node.left) : 0;
      const rightMax = node.right ? getMaxDistance(node.right) : 0;
      return Math.max(node.distance, leftMax, rightMax);
    };

    getLeafPositions(root);
    const maxDist = getMaxDistance(root);
    if (maxDist === 0) return [];

    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    const traverse = (node: DendrogramNode) => {
      if (!node.left || !node.right) return;

      const nodePos = getNodePosition(node);
      const leftPos = getNodePosition(node.left);
      const rightPos = getNodePosition(node.right);

      const leftDist = node.left.distance;
      const rightDist = node.right.distance;

      if (orientation === "horizontal") {
        const yNode = height - (node.distance / maxDist) * height;
        const yLeft = height - (leftDist / maxDist) * height;
        const yRight = height - (rightDist / maxDist) * height;
        lines.push({ x1: leftPos, y1: yNode, x2: rightPos, y2: yNode });
        lines.push({ x1: leftPos, y1: yNode, x2: leftPos, y2: yLeft });
        lines.push({ x1: rightPos, y1: yNode, x2: rightPos, y2: yRight });
      } else if (orientation === "vertical") {
        const xNode = width - (node.distance / maxDist) * width;
        const xLeft = width - (leftDist / maxDist) * width;
        const xRight = width - (rightDist / maxDist) * width;
        lines.push({ x1: xNode, y1: leftPos, x2: xNode, y2: rightPos });
        lines.push({ x1: xNode, y1: leftPos, x2: xLeft, y2: leftPos });
        lines.push({ x1: xNode, y1: rightPos, x2: xRight, y2: rightPos });
      } else {
        const xNode = (node.distance / maxDist) * width;
        const xLeft = (leftDist / maxDist) * width;
        const xRight = (rightDist / maxDist) * width;
        lines.push({ x1: xNode, y1: leftPos, x2: xNode, y2: rightPos });
        lines.push({ x1: xNode, y1: leftPos, x2: xLeft, y2: leftPos });
        lines.push({ x1: xNode, y1: rightPos, x2: xRight, y2: rightPos });
      }

      traverse(node.left);
      traverse(node.right);
    };

    traverse(root);
    return lines;
  }, []);

  const handleDownloadPNG = async () => {
    if (!heatmapExportRef.current) return;
    try {
      const element = heatmapExportRef.current;
      const scrollWidth = element.scrollWidth;
      const scrollHeight = element.scrollHeight;

      // Extra padding for labels
      const paddingLeft = 20;
      const paddingRight = 100;
      const paddingTop = 80; // For sample names at top
      const paddingBottom = 140; // For legends

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 4,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: scrollWidth + paddingLeft + paddingRight,
        height: scrollHeight + paddingTop + paddingBottom,
        windowWidth: scrollWidth + paddingLeft + paddingRight,
        windowHeight: scrollHeight + paddingTop + paddingBottom,
        x: -paddingLeft,
        y: -paddingTop,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.body.querySelector('[data-heatmap-export="true"]') as HTMLElement | null;
          if (!clonedElement) return;

          // Add margins to the cloned element
          clonedElement.style.marginLeft = `${paddingLeft}px`;
          clonedElement.style.marginRight = `${paddingRight}px`;
          clonedElement.style.marginTop = `${paddingTop}px`;
          clonedElement.style.paddingBottom = `${paddingBottom}px`;

          // Force all text to web-safe fonts
          clonedElement.querySelectorAll('*').forEach((el) => {
            if (el instanceof HTMLElement) {
              el.style.fontFamily = 'Arial, sans-serif';
            }
          });

          // Fix gene labels
          clonedElement.querySelectorAll('.text-xs.text-left.truncate.text-muted-foreground').forEach((el) => {
            if (el instanceof HTMLElement && el.closest('.flex-col')) {
              el.style.fontSize = '9px';
              el.style.overflow = 'visible';
              el.style.whiteSpace = 'nowrap';
            }
          });

          // Fix sample labels - use writing-mode approach that works with html2canvas
          clonedElement.querySelectorAll('[data-heatmap-sample-label="true"]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            const span = el.querySelector('span');
            
            // Increase container height significantly
            el.style.height = '70px';
            el.style.width = `${cellWidth}px`;
            el.style.overflow = 'visible';
            el.style.writingMode = 'vertical-rl';
            el.style.textOrientation = 'mixed';
            el.style.transform = 'rotate(180deg)';
            el.style.display = 'flex';
            el.style.alignItems = 'flex-start';
            el.style.justifyContent = 'flex-start';
            el.style.paddingTop = '2px';
            
            if (span) {
              span.style.fontSize = '5px';
              span.style.fontFamily = 'Arial, sans-serif';
              span.style.color = '#374151';
              span.style.whiteSpace = 'nowrap';
              span.style.overflow = 'visible';
              span.style.textOverflow = 'clip';
              span.style.maxWidth = 'none';
              span.style.maxHeight = 'none';
            }
          });
        },
      });

      const link = document.createElement("a");
      link.download = "expression-heatmap.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export heatmap:", error);
    }
  };

  // Generate SVG string for export (reusable for both download and batch export)
  const generateSVGString = useCallback((): string | null => {
    if (!heatmapExportRef.current) return null;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    const heatmapWidthPx = cellWidth * filteredData.samples.length;
    const heatmapHeightPx = cellHeight * filteredData.genes.length;

    const hasSampleDendro = showDendrograms && !!sampleDendrogram && sampleClusterMethod !== "none";
    const hasGeneDendro = showDendrograms && !!geneDendrogram && geneClusterMethod !== "none";

    const sampleDendroH = hasSampleDendro ? 40 : 0;
    const sampleLabelH = 70; // Increased for sample names
    const annotBarsH = (selectedAnnotation && userAnnotations ? 12 : 0) + 12; // user annot + subtype with gap

    // Calculate user annotation legend height
    const userAnnotEntries = selectedAnnotation ? Object.entries(userAnnotationColors) : [];
    const hasUserAnnotLegend = userAnnotEntries.length > 0;
    const userAnnotLegendH = hasUserAnnotLegend ? 25 : 0;

    const padding = { top: 20, right: 140, bottom: 130 + userAnnotLegendH, left: 30 }; // Increased left padding
    const topBlockH = sampleDendroH + sampleLabelH + annotBarsH;

    const dendrogramWidth = hasGeneDendro ? 40 : 0;
    const geneLabelWidth = 100;

    const totalWidth = padding.left + heatmapWidthPx + 4 + dendrogramWidth + geneLabelWidth + padding.right;
    const totalHeight = padding.top + topBlockH + heatmapHeightPx + padding.bottom;

    svg.setAttribute("width", String(totalWidth));
    svg.setAttribute("height", String(totalHeight));
    svg.setAttribute("xmlns", svgNS);

    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "white");
    svg.appendChild(bg);

    const yDendro = padding.top;
    // Position sample labels to end just above annotation bars with gap
    const ySubtypeBar = padding.top + sampleDendroH + sampleLabelH + (selectedAnnotation && userAnnotations ? 12 : 0) + 4;
    const yUserAnnotBar = padding.top + sampleDendroH + sampleLabelH + 4;
    const ySampleLabels = yUserAnnotBar - 4; // Sample labels end just above first annotation bar
    const yCellsStart = padding.top + topBlockH;

    // Sample dendrogram
    if (hasSampleDendro && sampleDendrogram) {
      const lines = getDendrogramLines(sampleDendrogram, heatmapWidthPx, sampleDendroH, "horizontal", cellWidth);
      lines.forEach((l) => {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", String(padding.left + l.x1));
        line.setAttribute("y1", String(yDendro + l.y1));
        line.setAttribute("x2", String(padding.left + l.x2));
        line.setAttribute("y2", String(yDendro + l.y2));
        line.setAttribute("stroke", "#6b7280");
        line.setAttribute("stroke-width", "0.5");
        line.setAttribute("stroke-opacity", "0.6");
        svg.appendChild(line);
      });
    }

    // Sample names (rotated) - positioned to not overlap with annotation bars
    sortedSampleIndices.forEach((sampleIdx, i) => {
      const sampleName = filteredData.samples[sampleIdx];
      const x = padding.left + i * cellWidth + cellWidth / 2;
      const y = ySampleLabels;

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y));
      text.setAttribute("font-size", "6");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#4b5563");
      text.setAttribute("text-anchor", "start");
      text.setAttribute("transform", `rotate(-90, ${x}, ${y})`);
      text.textContent = sampleName;
      svg.appendChild(text);
    });

    // Optional user annotation bar
    if (selectedAnnotation && userAnnotations) {
      sortedSampleIndices.forEach((sampleIdx, i) => {
        const sampleId = filteredData.samples[sampleIdx];
        const value = userAnnotations.annotations[sampleId]?.[selectedAnnotation] || "";
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", String(padding.left + i * cellWidth));
        rect.setAttribute("y", String(yUserAnnotBar));
        rect.setAttribute("width", String(cellWidth));
        rect.setAttribute("height", "8");
        rect.setAttribute("fill", userAnnotationColors[value] || "#e5e7eb");
        svg.appendChild(rect);
      });
    }

    // Subtype annotation bar
    sortedSampleIndices.forEach((sampleIdx, i) => {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(padding.left + i * cellWidth));
      rect.setAttribute("y", String(ySubtypeBar));
      rect.setAttribute("width", String(cellWidth));
      rect.setAttribute("height", "8");
      rect.setAttribute("fill", subtypeColors[filteredData.sampleSubtypes[sampleIdx]] || "#6b7280");
      svg.appendChild(rect);
    });

    // Heatmap cells
    sortedGeneIndices.forEach((geneIdx, gi) => {
      sortedSampleIndices.forEach((sampleIdx, si) => {
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", String(padding.left + si * cellWidth));
        rect.setAttribute("y", String(yCellsStart + gi * cellHeight));
        rect.setAttribute("width", String(cellWidth));
        rect.setAttribute("height", String(cellHeight));
        rect.setAttribute("fill", getHeatmapColor(displayValues[geneIdx][sampleIdx], minVal, maxVal));
        svg.appendChild(rect);
      });
    });

    // Gene dendrogram (right)
    if (hasGeneDendro && geneDendrogram) {
      const xOffset = padding.left + heatmapWidthPx + 4;
      const yOffset = yCellsStart;
      const lines = getDendrogramLines(geneDendrogram, 40, heatmapHeightPx, "vertical-right", cellHeight);
      lines.forEach((l) => {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", String(xOffset + l.x1));
        line.setAttribute("y1", String(yOffset + l.y1));
        line.setAttribute("x2", String(xOffset + l.x2));
        line.setAttribute("y2", String(yOffset + l.y2));
        line.setAttribute("stroke", "#6b7280");
        line.setAttribute("stroke-width", "0.5");
        line.setAttribute("stroke-opacity", "0.6");
        svg.appendChild(line);
      });
    }

    // Gene labels
    sortedGeneIndices.forEach((geneIdx, gi) => {
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(padding.left + heatmapWidthPx + 4 + dendrogramWidth + 10));
      text.setAttribute("y", String(yCellsStart + gi * cellHeight + cellHeight / 2 + 3));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#4b5563");
      text.textContent = filteredData.genes[geneIdx];
      svg.appendChild(text);
    });

    // Color scale legend
    const legendY = yCellsStart + heatmapHeightPx + 30;
    const legendWidth = 200;
    const legendHeight = 12;
    const legendX = (totalWidth - legendWidth) / 2;

    for (let i = 0; i < 50; i++) {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(legendX + i * (legendWidth / 50)));
      rect.setAttribute("y", String(legendY));
      rect.setAttribute("width", String(legendWidth / 50 + 1));
      rect.setAttribute("height", String(legendHeight));
      rect.setAttribute("fill", getHeatmapColor(i / 49, 0, 1));
      svg.appendChild(rect);
    }

    const lowLabel = document.createElementNS(svgNS, "text");
    lowLabel.setAttribute("x", String(legendX - 30));
    lowLabel.setAttribute("y", String(legendY + legendHeight / 2 + 4));
    lowLabel.setAttribute("font-size", "10");
    lowLabel.setAttribute("font-family", "Arial, sans-serif");
    lowLabel.setAttribute("fill", "#4b5563");
    lowLabel.textContent = useZScore ? "Low (Z)" : "Low";
    svg.appendChild(lowLabel);

    const highLabel = document.createElementNS(svgNS, "text");
    highLabel.setAttribute("x", String(legendX + legendWidth + 5));
    highLabel.setAttribute("y", String(legendY + legendHeight / 2 + 4));
    highLabel.setAttribute("font-size", "10");
    highLabel.setAttribute("font-family", "Arial, sans-serif");
    highLabel.setAttribute("fill", "#4b5563");
    highLabel.textContent = useZScore ? "High (Z)" : "High";
    svg.appendChild(highLabel);

    // Subtype legend
    const subtypeLegendY = legendY + 35;
    let xOffset = padding.left;
    
    // Add "NMF Subtypes:" label
    const subtypeLegendLabel = document.createElementNS(svgNS, "text");
    subtypeLegendLabel.setAttribute("x", String(xOffset));
    subtypeLegendLabel.setAttribute("y", String(subtypeLegendY + 10));
    subtypeLegendLabel.setAttribute("font-size", "10");
    subtypeLegendLabel.setAttribute("font-family", "Arial, sans-serif");
    subtypeLegendLabel.setAttribute("font-weight", "500");
    subtypeLegendLabel.setAttribute("fill", "#6b7280");
    subtypeLegendLabel.textContent = "NMF Subtypes:";
    svg.appendChild(subtypeLegendLabel);
    xOffset += 80;

    uniqueSubtypes.forEach((subtype) => {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(xOffset));
      rect.setAttribute("y", String(subtypeLegendY));
      rect.setAttribute("width", "12");
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", subtypeColors[subtype] || "#6b7280");
      svg.appendChild(rect);

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(xOffset + 16));
      text.setAttribute("y", String(subtypeLegendY + 10));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("fill", "#4b5563");
      text.textContent = subtype;
      svg.appendChild(text);

      xOffset += 16 + subtype.length * 6 + 20;
    });

    // User annotation legend (if selected) - always render if annotation is selected
    if (selectedAnnotation && userAnnotations && !isNumericAnnotation) {
      const userAnnotLegendY = subtypeLegendY + 22;
      let annotXOffset = padding.left;

      // Get annotation values from the data
      const annotationValues = new Set<string>();
      Object.values(userAnnotations.annotations).forEach(annot => {
        if (annot[selectedAnnotation]) annotationValues.add(annot[selectedAnnotation]);
      });
      const sortedAnnotValues = [...annotationValues].sort();

      if (sortedAnnotValues.length > 0) {
        // Add annotation name label
        const annotLegendLabel = document.createElementNS(svgNS, "text");
        annotLegendLabel.setAttribute("x", String(annotXOffset));
        annotLegendLabel.setAttribute("y", String(userAnnotLegendY + 10));
        annotLegendLabel.setAttribute("font-size", "10");
        annotLegendLabel.setAttribute("font-family", "Arial, sans-serif");
        annotLegendLabel.setAttribute("font-weight", "500");
        annotLegendLabel.setAttribute("fill", "#6b7280");
        annotLegendLabel.textContent = `${selectedAnnotation}:`;
        svg.appendChild(annotLegendLabel);
        annotXOffset += selectedAnnotation.length * 6 + 16;

        sortedAnnotValues.forEach((value) => {
          const color = userAnnotationColors[value] || "#6b7280";
          const rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", String(annotXOffset));
          rect.setAttribute("y", String(userAnnotLegendY));
          rect.setAttribute("width", "12");
          rect.setAttribute("height", "12");
          rect.setAttribute("rx", "2");
          rect.setAttribute("fill", color);
          svg.appendChild(rect);

          const text = document.createElementNS(svgNS, "text");
          text.setAttribute("x", String(annotXOffset + 16));
          text.setAttribute("y", String(userAnnotLegendY + 10));
          text.setAttribute("font-size", "10");
          text.setAttribute("font-family", "Arial, sans-serif");
          text.setAttribute("fill", "#4b5563");
          text.textContent = value;
          svg.appendChild(text);

          annotXOffset += 16 + value.length * 6 + 20;
        });
      }
    }

    if(selectedAnnotation && isNumericAnnotation && continuousColorScale){
      const y=subtypeLegendY+32,x=padding.left;
      const label=document.createElementNS(svgNS,"text");label.setAttribute("x",String(x));label.setAttribute("y",String(y));label.setAttribute("font-size","10");label.textContent=`${selectedAnnotation}: ${continuousColorScale.min.toFixed(1)} – ${continuousColorScale.max.toFixed(1)}`;svg.appendChild(label);
      for(let i=0;i<100;i++){const rect=document.createElementNS(svgNS,"rect");rect.setAttribute("x",String(x+i*2));rect.setAttribute("y",String(y+5));rect.setAttribute("width","2");rect.setAttribute("height","10");rect.setAttribute("fill",continuousColorScale.getColor(continuousColorScale.min+i/99*(continuousColorScale.max-continuousColorScale.min)));svg.appendChild(rect);}
    }
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  }, [
    cellWidth, cellHeight, filteredData, showDendrograms, sampleDendrogram, geneDendrogram,
    sampleClusterMethod, geneClusterMethod, selectedAnnotation, userAnnotations,
    userAnnotationColors, sortedSampleIndices, sortedGeneIndices, displayValues,
    minVal, maxVal, subtypeColors, uniqueSubtypes, getDendrogramLines, useZScore, isNumericAnnotation, continuousColorScale
  ]);

  // Expose getSVGString via ref for batch export
  useImperativeHandle(ref, () => ({
    getSVGString: generateSVGString
  }), [generateSVGString]);

  const handleDownloadSVG = () => {
    const svgString = generateSVGString();
    if (!svgString) return;

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
            <Select value={distanceMetric} onValueChange={(v) => { setDistanceMetric(v as DistanceMetric); if(v !== "euclidean") { if(sampleClusterMethod === "ward") setSampleClusterMethod("average"); if(geneClusterMethod === "ward") setGeneClusterMethod("average"); } }}>
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
        <div className="overflow-x-auto" ref={heatmapScrollRef}>
          <div ref={heatmapExportRef} data-heatmap-export="true">
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
                  data-heatmap-sample-label="true"
                  className="text-[5px] text-muted-foreground"
                  style={{
                    width: cellWidth,
                    height: 65,
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    transform: "rotate(180deg)",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    paddingTop: 2,
                    overflow: "visible",
                  }}
                  title={filteredData.samples[idx]}
                >
                  <span style={{ whiteSpace: "nowrap", overflow: "visible" }}>{filteredData.samples[idx]}</span>
                </div>
              ))}
            </div>
            <div style={{ width: 4 }} />
            <div className="text-[8px] text-muted-foreground text-left truncate pl-1 flex items-end" style={{ width: 80, height: 65 }}>
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
                        backgroundColor: getAnnotationColor(value),
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
            <HeatmapCanvas values={displayValues} genes={sortedGeneIndices} samples={sortedSampleIndices} cellWidth={cellWidth} cellHeight={cellHeight} color={value=>getHeatmapColor(value,minVal,maxVal)} onHover={handleCellHover} onLeave={()=>setHoveredCell(null)} />

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

          {/* User annotation legend - continuous color bar or clickable for exclusion */}
          {selectedAnnotation && isNumericAnnotation && continuousColorScale ? (
            <div className="flex items-center gap-2 mt-2 justify-center border-t border-border/50 pt-2 pb-2">
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
          ) : selectedAnnotation && Object.keys(userAnnotationColors).length > 0 && (
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
});

ExpressionHeatmap.displayName = "ExpressionHeatmap";
