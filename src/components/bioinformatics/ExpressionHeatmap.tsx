import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AnnotationSelector } from "./AnnotationSelector";
import { generateSubtypeColors } from "@/data/mockNmfData";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

interface AnnotationData {
  annotations: Record<string, Record<string, string>>;
  columns: string[];
}

interface ExpressionHeatmapProps {
  data: HeatmapData;
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
}

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

export const ExpressionHeatmap = ({ data, subtypeColors, userAnnotations }: ExpressionHeatmapProps) => {
  const [hoveredCell, setHoveredCell] = useState<{ gene: string; sample: string; value: number; subtype: string; userAnnotation?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [useZScore, setUseZScore] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);

  // Generate colors for user annotation values
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations]);

  const { displayValues, minVal, maxVal, sortedIndices, uniqueSubtypes } = useMemo(() => {
    const normalizedValues = useZScore ? zScoreNormalize(data.values) : data.values;
    const allValues = normalizedValues.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Sort samples by subtype
    const indices = data.sampleSubtypes
      .map((subtype, idx) => ({ subtype, idx }))
      .sort((a, b) => a.subtype.localeCompare(b.subtype))
      .map(item => item.idx);
    
    const subtypes = [...new Set(data.sampleSubtypes)].sort();
    
    return { displayValues: normalizedValues, minVal: min, maxVal: max, sortedIndices: indices, uniqueSubtypes: subtypes };
  }, [data, useZScore]);

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
    const header = ["Gene", ...sortedIndices.map(idx => data.samples[idx])];
    const subtypeRow = ["Subtype", ...sortedIndices.map(idx => data.sampleSubtypes[idx])];
    const dataRows = data.genes.map((gene, geneIdx) => [
      gene,
      ...sortedIndices.map(sampleIdx => displayValues[geneIdx][sampleIdx].toFixed(4))
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-lg">Expression Heatmap (Top Marker Genes)</CardTitle>
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* User annotation bar (if selected) */}
          {selectedAnnotation && userAnnotations && (
            <div className="flex mb-0.5">
              <div className="mr-2 text-[8px] text-muted-foreground text-right truncate pr-1" style={{ width: 72 }}>
                {selectedAnnotation}
              </div>
              <div className="flex">
                {sortedIndices.map((idx, i) => {
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
            <div className="flex">
              {sortedIndices.map((idx, i) => (
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
          
          {/* Heatmap grid */}
          <div className="flex">
            {/* Gene labels */}
            <div className="flex flex-col mr-2" style={{ width: 72 }}>
              {data.genes.map((gene) => (
                <div
                  key={gene}
                  className="text-xs text-right pr-1 truncate text-muted-foreground"
                  style={{ height: cellHeight, lineHeight: `${cellHeight}px` }}
                >
                  {gene}
                </div>
              ))}
            </div>
            
            {/* Heatmap cells */}
            <div>
              {displayValues.map((row, geneIdx) => (
                <div key={geneIdx} className="flex">
                  {sortedIndices.map((sampleIdx, i) => (
                    <div
                      key={i}
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: getHeatmapColor(row[sampleIdx], minVal, maxVal),
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