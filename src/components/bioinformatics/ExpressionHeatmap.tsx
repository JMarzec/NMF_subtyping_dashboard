import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

interface ExpressionHeatmapProps {
  data: HeatmapData;
  subtypeColors: Record<string, string>;
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

export const ExpressionHeatmap = ({ data, subtypeColors }: ExpressionHeatmapProps) => {
  const [hoveredCell, setHoveredCell] = useState<{ gene: string; sample: string; value: number; subtype: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { minVal, maxVal, sortedIndices, uniqueSubtypes } = useMemo(() => {
    const allValues = data.values.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Sort samples by subtype
    const indices = data.sampleSubtypes
      .map((subtype, idx) => ({ subtype, idx }))
      .sort((a, b) => a.subtype.localeCompare(b.subtype))
      .map(item => item.idx);
    
    const subtypes = [...new Set(data.sampleSubtypes)].sort();
    
    return { minVal: min, maxVal: max, sortedIndices: indices, uniqueSubtypes: subtypes };
  }, [data]);

  const cellWidth = Math.max(4, Math.min(10, 600 / data.samples.length));
  const cellHeight = 12;

  const handleCellHover = (
    e: React.MouseEvent,
    geneIdx: number,
    sampleIdx: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setHoveredCell({
      gene: data.genes[geneIdx],
      sample: data.samples[sampleIdx],
      value: data.values[geneIdx][sampleIdx],
      subtype: data.sampleSubtypes[sampleIdx],
    });
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm relative">
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
                  backgroundColor: subtypeColors[data.sampleSubtypes[idx]] || "hsl(var(--primary))",
                }}
                title={`${data.samples[idx]} - ${data.sampleSubtypes[idx]}`}
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
            <p className="text-xs text-muted-foreground">Expression: {hoveredCell.value.toFixed(2)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
