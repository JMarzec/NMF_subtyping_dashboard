import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Database, Calculator, FileSpreadsheet } from "lucide-react";
import { useMemo, useRef } from "react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HazardRatioGroup {
  subtype: string;
  hazardRatio: number;
  lowerCI: number;
  upperCI: number;
  pValue: number;
}

interface ForestPlotProps {
  referenceGroup: string;
  groups: HazardRatioGroup[];
  subtypeColors: Record<string, string>;
  isPrecomputed?: boolean;
  title?: string;
}

export const ForestPlot = ({ 
  referenceGroup, 
  groups, 
  subtypeColors,
  isPrecomputed = false,
  title = "Forest Plot: Hazard Ratios"
}: ForestPlotProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "forest-plot");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "forest-plot");
  };

  // Export forest plot data as CSV/TSV
  const exportForestPlotData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Subtype', 'Hazard Ratio', 'Lower 95% CI', 'Upper 95% CI', 'P-value', 'Significant', 'Data Source'].join(separator));
    
    // Reference group
    lines.push([
      referenceGroup,
      '1.00',
      '-',
      '-',
      '-',
      '-',
      isPrecomputed ? 'R (pre-computed)' : 'Estimated'
    ].join(separator));
    
    // Comparison groups
    groups.forEach(g => {
      lines.push([
        g.subtype,
        g.hazardRatio.toFixed(4),
        g.lowerCI.toFixed(4),
        g.upperCI.toFixed(4),
        g.pValue.toExponential(4),
        g.pValue < 0.05 ? 'Yes' : 'No',
        isPrecomputed ? 'R (pre-computed)' : 'Estimated'
      ].join(separator));
    });
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forest-plot-data.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate the range for the plot
  const { minHR, maxHR, logScale } = useMemo(() => {
    if (groups.length === 0) {
      return { minHR: 0.1, maxHR: 10, logScale: true };
    }

    // Get min and max from all CIs
    let min = Math.min(...groups.map(g => g.lowerCI));
    let max = Math.max(...groups.map(g => g.upperCI));
    
    // Ensure we include 1 (reference line)
    min = Math.min(min, 0.8);
    max = Math.max(max, 1.2);
    
    // Add some padding
    const padding = 0.2;
    min = Math.max(0.05, min - padding);
    max = max + padding;
    
    return { minHR: min, maxHR: max, logScale: max / min > 4 };
  }, [groups]);

  // Convert HR to position on the plot (0-100%)
  const hrToPosition = (hr: number): number => {
    if (logScale) {
      const logMin = Math.log10(minHR);
      const logMax = Math.log10(maxHR);
      const logHR = Math.log10(Math.max(minHR, Math.min(maxHR, hr)));
      return ((logHR - logMin) / (logMax - logMin)) * 100;
    } else {
      return ((hr - minHR) / (maxHR - minHR)) * 100;
    }
  };

  // Reference line position (HR = 1)
  const referencePosition = hrToPosition(1);

  // Generate tick marks
  const ticks = useMemo(() => {
    if (logScale) {
      const possibleTicks = [0.1, 0.2, 0.25, 0.5, 1, 2, 4, 5, 10, 20];
      return possibleTicks.filter(t => t >= minHR && t <= maxHR);
    } else {
      const tickCount = 5;
      const step = (maxHR - minHR) / (tickCount - 1);
      return Array.from({ length: tickCount }, (_, i) => minHR + i * step);
    }
  }, [minHR, maxHR, logScale]);

  if (groups.length === 0) {
    return null;
  }

  const rowHeight = 40;
  const plotHeight = (groups.length + 1) * rowHeight + 60; // +1 for reference, +60 for axis

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-xs">
                  {isPrecomputed ? <Database className="h-3 w-3 mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                  {isPrecomputed ? 'R' : 'Est.'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPrecomputed ? 'Pre-computed from R analysis' : 'Estimated from survival curves'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportForestPlotData('csv')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportForestPlotData('tsv')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            TSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadSVG}>
            <Download className="h-4 w-4 mr-1" />
            SVG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="bg-card p-4 rounded-md">
          {/* Header row */}
          <div className="flex items-center text-xs font-medium text-muted-foreground mb-2 border-b pb-2">
            <div className="w-32 shrink-0">Subtype</div>
            <div className="flex-1 px-4">
              <div className="flex justify-between">
                <span>Favors {referenceGroup}</span>
                <span>Favors comparison</span>
              </div>
            </div>
            <div className="w-36 text-right shrink-0">HR (95% CI)</div>
            <div className="w-20 text-right shrink-0">P-value</div>
          </div>

          {/* Reference group row */}
          <div className="flex items-center py-2 border-b border-border/50">
            <div className="w-32 shrink-0 flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: subtypeColors[referenceGroup] || 'hsl(var(--primary))' }}
              />
              <span className="text-sm font-medium">{referenceGroup}</span>
              <Badge variant="outline" className="text-xs">Ref</Badge>
            </div>
            <div className="flex-1 px-4 relative h-8">
              {/* Reference line */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-border"
                style={{ left: `${referencePosition}%` }}
              />
              {/* Diamond marker for reference */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45"
                style={{ 
                  left: `${referencePosition}%`, 
                  marginLeft: '-6px',
                  backgroundColor: subtypeColors[referenceGroup] || 'hsl(var(--primary))'
                }}
              />
            </div>
            <div className="w-36 text-right shrink-0 text-sm">1.00 (reference)</div>
            <div className="w-20 text-right shrink-0 text-sm text-muted-foreground">—</div>
          </div>

          {/* Comparison group rows */}
          {groups.map((group, index) => {
            const hrPos = hrToPosition(group.hazardRatio);
            const lowerPos = hrToPosition(group.lowerCI);
            const upperPos = hrToPosition(group.upperCI);
            const color = subtypeColors[group.subtype] || 'hsl(var(--primary))';
            const isSignificant = group.pValue < 0.05;

            return (
              <div 
                key={group.subtype} 
                className={`flex items-center py-2 ${index < groups.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <div className="w-32 shrink-0 flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{group.subtype}</span>
                </div>
                <div className="flex-1 px-4 relative h-8">
                  {/* Reference line at HR=1 */}
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-muted-foreground/30"
                    style={{ left: `${referencePosition}%` }}
                  />
                  
                  {/* Confidence interval line */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-0.5"
                    style={{ 
                      left: `${lowerPos}%`, 
                      width: `${upperPos - lowerPos}%`,
                      backgroundColor: color
                    }}
                  />
                  
                  {/* CI whiskers */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3"
                    style={{ left: `${lowerPos}%`, backgroundColor: color }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3"
                    style={{ left: `${upperPos}%`, backgroundColor: color }}
                  />
                  
                  {/* Point estimate (square) */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3"
                    style={{ 
                      left: `${hrPos}%`, 
                      marginLeft: '-6px',
                      backgroundColor: color
                    }}
                  />
                </div>
                <div className="w-36 text-right shrink-0 text-sm font-mono">
                  {group.hazardRatio.toFixed(2)} ({group.lowerCI.toFixed(2)}–{group.upperCI.toFixed(2)})
                </div>
                <div className="w-20 text-right shrink-0">
                  <Badge 
                    variant={isSignificant ? "default" : "secondary"}
                    className={`text-xs ${isSignificant ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {formatPValue(group.pValue)}
                  </Badge>
                </div>
              </div>
            );
          })}

          {/* X-axis */}
          <div className="mt-4 pt-2 border-t">
            <div className="relative h-6 mx-32 px-4">
              {/* Axis line */}
              <div className="absolute left-0 right-0 top-0 h-px bg-border" />
              
              {/* Tick marks and labels */}
              {ticks.map(tick => {
                const pos = hrToPosition(tick);
                const isRef = Math.abs(tick - 1) < 0.01;
                return (
                  <div 
                    key={tick} 
                    className="absolute -top-1"
                    style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className={`w-px h-2 ${isRef ? 'bg-foreground' : 'bg-muted-foreground'}`} />
                    <div className={`text-xs mt-1 ${isRef ? 'font-bold' : 'text-muted-foreground'}`}>
                      {tick < 1 ? tick.toFixed(1) : tick.toFixed(tick >= 10 ? 0 : 1)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-xs text-muted-foreground mt-2">
              Hazard Ratio {logScale ? '(log scale)' : '(linear scale)'}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Squares represent point estimates. Horizontal lines show 95% confidence intervals.
          HR &gt; 1 indicates increased risk compared to {referenceGroup}.
        </p>
      </CardContent>
    </Card>
  );
};
