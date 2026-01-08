import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

interface ExpressionHeatmapProps {
  data: HeatmapData;
}

const SUBTYPE_COLORS: Record<string, string> = {
  "Subtype_1": "#3b82f6",
  "Subtype_2": "#8b5cf6",
  "Subtype_3": "#22c55e",
  "Subtype_4": "#f97316",
};

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

export const ExpressionHeatmap = ({ data }: ExpressionHeatmapProps) => {
  const { minVal, maxVal, sortedIndices } = useMemo(() => {
    const allValues = data.values.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Sort samples by subtype
    const indices = data.sampleSubtypes
      .map((subtype, idx) => ({ subtype, idx }))
      .sort((a, b) => a.subtype.localeCompare(b.subtype))
      .map(item => item.idx);
    
    return { minVal: min, maxVal: max, sortedIndices: indices };
  }, [data]);

  const cellWidth = Math.max(4, Math.min(10, 600 / data.samples.length));
  const cellHeight = 12;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Expression Heatmap (Top Marker Genes)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Subtype annotation bar */}
          <div className="flex mb-1 ml-20">
            {sortedIndices.map((idx, i) => (
              <div
                key={i}
                style={{
                  width: cellWidth,
                  height: 8,
                  backgroundColor: SUBTYPE_COLORS[data.sampleSubtypes[idx]],
                }}
              />
            ))}
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
              {data.values.map((row, geneIdx) => (
                <div key={geneIdx} className="flex">
                  {sortedIndices.map((sampleIdx, i) => (
                    <div
                      key={i}
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: getHeatmapColor(row[sampleIdx], minVal, maxVal),
                      }}
                      title={`${data.genes[geneIdx]}: ${row[sampleIdx].toFixed(2)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Color scale legend */}
          <div className="flex items-center justify-center mt-4 gap-2">
            <span className="text-xs text-muted-foreground">Low</span>
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
            <span className="text-xs text-muted-foreground">High</span>
          </div>
          
          {/* Subtype legend */}
          <div className="flex flex-wrap gap-4 mt-3 justify-center">
            {Object.entries(SUBTYPE_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">
                  {key.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
