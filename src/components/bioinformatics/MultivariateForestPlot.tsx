import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Calculator, FileSpreadsheet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { formatPValue } from "@/lib/logRankTest";
import { MultivariateCoxPHResult } from "@/lib/coxphAnalysis";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MultivariateForestPlotProps {
  result: MultivariateCoxPHResult;
}

type PValueType = 'raw' | 'bonferroni' | 'fdr';

// Generate distinct colors for covariates
const generateCovariateColors = (covariates: string[]): Record<string, string> => {
  const colorPalette = [
    "hsl(210, 70%, 50%)", // Blue
    "hsl(0, 70%, 50%)",   // Red
    "hsl(120, 60%, 40%)", // Green
    "hsl(45, 80%, 50%)",  // Orange
    "hsl(280, 60%, 50%)", // Purple
    "hsl(180, 60%, 45%)", // Teal
    "hsl(330, 70%, 50%)", // Pink
    "hsl(60, 70%, 45%)",  // Yellow
    "hsl(200, 65%, 55%)", // Light Blue
    "hsl(15, 75%, 55%)",  // Coral
    "hsl(160, 60%, 45%)", // Sea Green
    "hsl(300, 50%, 50%)", // Magenta
  ];
  
  const colors: Record<string, string> = {};
  covariates.forEach((cov, i) => {
    colors[cov] = colorPalette[i % colorPalette.length];
  });
  return colors;
};

export const MultivariateForestPlot = ({ result }: MultivariateForestPlotProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [pValueType, setPValueType] = useState<PValueType>('raw');

  const covariateColors = useMemo(() => 
    generateCovariateColors(result.covariates.map(c => c.name)), 
    [result.covariates]
  );

  const getPValue = (cov: MultivariateCoxPHResult['covariates'][0]) => {
    switch (pValueType) {
      case 'bonferroni':
        return cov.pValueBonferroni;
      case 'fdr':
        return cov.pValueFDR;
      default:
        return cov.pValue;
    }
  };

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "multivariate-forest-plot");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "multivariate-forest-plot");
  };

  // Export forest plot data as CSV/TSV
  const exportForestPlotData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Covariate', 'Hazard Ratio', 'Lower 95% CI', 'Upper 95% CI', 'P-value', 'P-value (Bonf.)', 'P-value (FDR)', 'Significant'].join(separator));
    
    // Covariate rows
    result.covariates.forEach(cov => {
      lines.push([
        cov.name,
        cov.hazardRatio.toFixed(4),
        cov.lowerCI.toFixed(4),
        cov.upperCI.toFixed(4),
        cov.pValue.toExponential(4),
        cov.pValueBonferroni.toExponential(4),
        cov.pValueFDR.toExponential(4),
        cov.pValue < 0.05 ? 'Yes' : 'No'
      ].join(separator));
    });
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multivariate-forest-plot.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate the range for the plot
  const { minHR, maxHR, logScale } = useMemo(() => {
    if (result.covariates.length === 0) {
      return { minHR: 0.1, maxHR: 10, logScale: true };
    }

    // Get min and max from all CIs
    let min = Math.min(...result.covariates.map(c => c.lowerCI));
    let max = Math.max(...result.covariates.map(c => c.upperCI));
    
    // Ensure we include 1 (reference line)
    min = Math.min(min, 0.8);
    max = Math.max(max, 1.2);
    
    // Add some padding
    const padding = 0.2;
    min = Math.max(0.05, min - padding);
    max = max + padding;
    
    return { minHR: min, maxHR: max, logScale: max / min > 4 };
  }, [result.covariates]);

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

  if (result.covariates.length === 0) {
    return null;
  }

  const pValueLabel = pValueType === 'raw' ? 'P-value' 
    : pValueType === 'bonferroni' ? 'P (Bonf.)' 
    : 'P (FDR)';

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-lg">Multivariate Forest Plot</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-xs">
                  <Calculator className="h-3 w-3 mr-1" />
                  {result.covariates.length} covariates
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Independent covariate effects from multivariate Cox model</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* P-value type selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">P-value:</span>
            <Select value={pValueType} onValueChange={(v) => setPValueType(v as PValueType)}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="bonferroni">Bonferroni</SelectItem>
                <SelectItem value="fdr">FDR</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <div className="w-48 shrink-0">Covariate</div>
            <div className="flex-1 px-4">
              <div className="flex justify-between">
                <span>Protective (HR &lt; 1)</span>
                <span>Risk (HR &gt; 1)</span>
              </div>
            </div>
            <div className="w-40 text-right shrink-0">HR (95% CI)</div>
            <div className="w-24 text-right shrink-0">{pValueLabel}</div>
          </div>

          {/* Covariate rows */}
          {result.covariates.map((cov, index) => {
            const hrPos = hrToPosition(cov.hazardRatio);
            const lowerPos = hrToPosition(cov.lowerCI);
            const upperPos = hrToPosition(cov.upperCI);
            const color = covariateColors[cov.name] || 'hsl(var(--primary))';
            const displayPValue = getPValue(cov);
            const isSignificant = displayPValue < 0.05;

            // Determine significance level for visual indicator
            const getSignificanceIndicator = () => {
              if (displayPValue < 0.001) return '***';
              if (displayPValue < 0.01) return '**';
              if (displayPValue < 0.05) return '*';
              return '';
            };

            return (
              <div 
                key={cov.name} 
                className={`flex items-center py-2 ${index < result.covariates.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <div className="w-48 shrink-0 flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium truncate" title={cov.name}>
                    {cov.name.length > 22 ? `${cov.name.slice(0, 22)}...` : cov.name}
                  </span>
                  {getSignificanceIndicator() && (
                    <span className="text-xs font-bold text-orange-500 shrink-0">
                      {getSignificanceIndicator()}
                    </span>
                  )}
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
                      left: `${Math.max(0, lowerPos)}%`, 
                      width: `${Math.min(100, upperPos) - Math.max(0, lowerPos)}%`,
                      backgroundColor: color
                    }}
                  />
                  
                  {/* CI whiskers */}
                  {lowerPos >= 0 && lowerPos <= 100 && (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3"
                      style={{ left: `${lowerPos}%`, backgroundColor: color }}
                    />
                  )}
                  {upperPos >= 0 && upperPos <= 100 && (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3"
                      style={{ left: `${upperPos}%`, backgroundColor: color }}
                    />
                  )}
                  
                  {/* Point estimate (square/diamond based on significance) */}
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 ${isSignificant ? 'w-3.5 h-3.5' : 'w-3 h-3'}`}
                    style={{ 
                      left: `${hrPos}%`, 
                      marginLeft: isSignificant ? '-7px' : '-6px',
                      backgroundColor: color,
                      transform: isSignificant ? 'translateY(-50%) rotate(45deg)' : 'translateY(-50%)'
                    }}
                  />
                </div>
                <div className="w-40 text-right shrink-0 text-sm font-mono">
                  {cov.hazardRatio.toFixed(2)} ({cov.lowerCI.toFixed(2)}–{cov.upperCI.toFixed(2)})
                </div>
                <div className="w-24 text-right shrink-0">
                  <Badge 
                    variant={isSignificant ? "default" : "secondary"}
                    className={`text-xs ${
                      displayPValue < 0.001 ? "bg-red-600 hover:bg-red-700" :
                      displayPValue < 0.01 ? "bg-orange-600 hover:bg-orange-700" :
                      displayPValue < 0.05 ? "bg-yellow-600 hover:bg-yellow-700" : ""
                    }`}
                  >
                    {formatPValue(displayPValue)}
                  </Badge>
                </div>
              </div>
            );
          })}

          {/* X-axis */}
          <div className="mt-4 pt-2 border-t">
            <div className="relative h-6 ml-48 mr-64 px-4">
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Squares = point estimates (diamonds for significant). Lines = 95% CI. 
            HR &gt; 1 = increased risk; HR &lt; 1 = protective effect.
          </span>
          <span>
            {pValueType === 'bonferroni' && `Bonferroni: p × ${result.covariates.length}`}
            {pValueType === 'fdr' && 'Benjamini-Hochberg FDR'}
          </span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          *** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05
        </div>
      </CardContent>
    </Card>
  );
};
