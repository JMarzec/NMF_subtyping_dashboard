import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  Area, 
  ComposedChart,
  ReferenceLine,
  Line
} from "recharts";
import { useMemo, useRef } from "react";
import { Download, FileSpreadsheet, Database, Calculator } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { logRankTest, formatPValue } from "@/lib/logRankTest";
import { estimateCoxPH, formatHR, CoxPHResult } from "@/lib/coxphAnalysis";
import { CoxPHResultFromJSON } from "@/components/bioinformatics/JsonUploader";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SurvivalTimePoint {
  time: number;
  survival: number;
  censored?: number;
  events?: number;
  atRisk?: number;
  stdErr?: number;
  lowerCI?: number;
  upperCI?: number;
}

export interface SurvivalData {
  subtype: string;
  nTotal?: number;
  nEvents?: number;
  nCensored?: number;
  timePoints: SurvivalTimePoint[];
}

interface SurvivalCurveProps {
  data: SurvivalData[];
  subtypeColors: Record<string, string>;
  subtypeCounts?: Record<string, number>;
  // Pre-computed values from R (optional - will estimate if not provided)
  survivalPValue?: number;
  coxPHResults?: CoxPHResultFromJSON;
}

export const SurvivalCurve = ({ 
  data, 
  subtypeColors, 
  subtypeCounts,
  survivalPValue,
  coxPHResults 
}: SurvivalCurveProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "survival-curve");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "survival-curve");
  };

  // Track data source for statistics
  const isPrecomputedPValue = survivalPValue !== undefined;
  const isPrecomputedCoxPH = !!coxPHResults;

  // Use pre-computed log-rank p-value from JSON if available, otherwise calculate
  const logRankResult = useMemo(() => {
    if (survivalPValue !== undefined) {
      // Use the pre-computed p-value from R
      return { pValue: survivalPValue, chiSquare: 0, df: 0 };
    }
    return logRankTest(data, subtypeCounts);
  }, [data, subtypeCounts, survivalPValue]);

  // Use pre-computed Cox PH results from JSON if available, otherwise estimate
  const coxPHResult = useMemo((): CoxPHResult | CoxPHResultFromJSON | null => {
    if (coxPHResults) {
      // Use the pre-computed results from R
      return coxPHResults;
    }
    return estimateCoxPH(data, subtypeCounts);
  }, [data, subtypeCounts, coxPHResults]);

  // Export survival statistics as CSV/TSV
  const exportSurvivalStats = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Statistic', 'Subtype', 'Value', 'Lower CI', 'Upper CI', 'P-value', 'Source'].join(separator));
    
    // Log-rank test
    if (logRankResult) {
      lines.push([
        'Log-rank Test',
        'All groups',
        logRankResult.chiSquare ? logRankResult.chiSquare.toFixed(4) : 'N/A',
        'N/A',
        'N/A',
        logRankResult.pValue.toExponential(4),
        isPrecomputedPValue ? 'R (pre-computed)' : 'Estimated'
      ].join(separator));
    }
    
    // Median survival for each subtype
    subtypes.forEach(subtype => {
      const median = medianSurvival[subtype];
      lines.push([
        'Median Survival (months)',
        subtype,
        median !== null ? median.toFixed(2) : 'Not Reached',
        'N/A',
        'N/A',
        'N/A',
        'Calculated from curve'
      ].join(separator));
    });
    
    // Cox PH results
    if (coxPHResult) {
      lines.push([
        'Cox PH Reference Group',
        coxPHResult.referenceGroup,
        '1.00',
        'N/A',
        'N/A',
        'N/A',
        isPrecomputedCoxPH ? 'R (pre-computed)' : 'Estimated'
      ].join(separator));
      
      coxPHResult.groups.forEach(g => {
        lines.push([
          'Cox PH Hazard Ratio',
          g.subtype,
          g.hazardRatio.toFixed(4),
          g.lowerCI.toFixed(4),
          g.upperCI.toFixed(4),
          g.pValue.toExponential(4),
          isPrecomputedCoxPH ? 'R (pre-computed)' : 'Estimated'
        ].join(separator));
      });
      
      lines.push([
        'Wald Test',
        'All groups',
        coxPHResult.waldTest.chiSquare.toFixed(4),
        'N/A',
        'N/A',
        coxPHResult.waldTest.pValue.toExponential(4),
        isPrecomputedCoxPH ? 'R (pre-computed)' : 'Estimated'
      ].join(separator));
    }
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survival-analysis-results.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate median survival for each subtype
  const medianSurvival = useMemo(() => {
    const result: Record<string, number | null> = {};
    
    data.forEach(group => {
      // Sort time points
      const sorted = [...group.timePoints].sort((a, b) => a.time - b.time);
      
      // Ensure monotonic decreasing survival
      let lastSurvival = 1;
      const monotonic = sorted.map(tp => {
        const survival = Math.min(lastSurvival, tp.survival);
        lastSurvival = survival;
        return { ...tp, survival };
      });
      
      // Find first time where survival drops to or below 0.5
      let median: number | null = null;
      for (let i = 0; i < monotonic.length; i++) {
        if (monotonic[i].survival <= 0.5) {
          if (i > 0) {
            const prev = monotonic[i - 1];
            const curr = monotonic[i];
            if (prev.survival > 0.5) {
              const slope = (curr.survival - prev.survival) / (curr.time - prev.time);
              if (slope !== 0) {
                median = prev.time + (0.5 - prev.survival) / slope;
              } else {
                median = curr.time;
              }
            } else {
              median = curr.time;
            }
          } else {
            median = monotonic[i].time;
          }
          break;
        }
      }
      
      result[group.subtype] = median;
    });
    
    return result;
  }, [data]);

  // Transform data for chart - ensure monotonic survival and proper step function
  const { chartData, eventPoints, censorPoints, subtypes, maxTime, riskTableData } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], eventPoints: [], censorPoints: [], subtypes: [], maxTime: 100, riskTableData: [] };
    }
    
    const subtypeNames = data.map(d => d.subtype);
    
    // Process each subtype - ensure monotonic decreasing survival
    const processedData = data.map(group => {
      const subtype = group.subtype;
      const n = group.nTotal || subtypeCounts?.[subtype] || 100;
      
      // Add initial point at time 0 with survival 1 if not present
      let points = [...group.timePoints];
      if (points.length === 0 || points[0].time > 0) {
        points.unshift({
          time: 0,
          survival: 1,
          atRisk: n,
          events: 0,
          censored: 0
        });
      }
      
      // Sort by time
      points.sort((a, b) => a.time - b.time);
      
      // Ensure monotonically decreasing survival
      let lastSurvival = 1;
      const sortedPoints = points.map(tp => {
        const survival = Math.min(lastSurvival, tp.survival);
        lastSurvival = survival;
        
        // Calculate CI if not provided
        const stdErr = tp.stdErr || (survival > 0.01 && survival < 0.99
          ? survival * Math.sqrt((1 - survival) / (n * survival))
          : 0);
        
        return { 
          time: tp.time, 
          survival, 
          stdErr,
          lowerCI: tp.lowerCI ?? Math.max(0, survival - 1.96 * stdErr),
          upperCI: tp.upperCI ?? Math.min(1, survival + 1.96 * stdErr),
          atRisk: tp.atRisk,
          events: tp.events,
          censored: tp.censored
        };
      });
      
      return { subtype, points: sortedPoints, n };
    });
    
    // Find max time across all subtypes
    const maxT = Math.max(...processedData.flatMap(g => g.points.map(p => p.time)));
    
    // Get all unique time points
    const allTimes = new Set<number>();
    processedData.forEach(group => {
      group.points.forEach(p => allTimes.add(p.time));
    });
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Build step-function chart data
    const chartPoints: Record<string, number>[] = [];
    const lastKnown: Record<string, { survival: number; lowerCI: number; upperCI: number; atRisk?: number }> = {};
    
    processedData.forEach(g => {
      lastKnown[g.subtype] = { survival: 1.0, lowerCI: 1.0, upperCI: 1.0, atRisk: g.n };
    });
    
    for (let i = 0; i < sortedTimes.length; i++) {
      const time = sortedTimes[i];
      const point: Record<string, number> = { time };
      
      processedData.forEach(group => {
        const tp = group.points.find(p => p.time === time);
        if (tp) {
          lastKnown[group.subtype] = { 
            survival: tp.survival, 
            lowerCI: tp.lowerCI,
            upperCI: tp.upperCI,
            atRisk: tp.atRisk
          };
        }
        const { survival, lowerCI, upperCI } = lastKnown[group.subtype];
        point[group.subtype] = survival;
        point[`${group.subtype}_upper`] = upperCI;
        point[`${group.subtype}_lower`] = lowerCI;
      });
      
      chartPoints.push(point);
    }
    
    // Collect event markers (where survival drops)
    const markers: { time: number; survival: number; subtype: string }[] = [];
    processedData.forEach(group => {
      for (let i = 0; i < group.points.length; i++) {
        const curr = group.points[i];
        // Add event marker if there are events at this time
        if ((curr.events && curr.events > 0) || (i > 0 && curr.survival < group.points[i - 1].survival - 0.001)) {
          markers.push({
            time: curr.time,
            survival: curr.survival,
            subtype: group.subtype
          });
        }
      }
    });
    
    // Collect censoring markers (including end-of-follow-up without event)
    const censors: { time: number; survival: number; subtype: string; isEndOfFollowUp?: boolean }[] = [];
    processedData.forEach(group => {
      const maxTimeForSubtype = Math.max(...group.points.map(p => p.time));
      
      for (let i = 0; i < group.points.length; i++) {
        const curr = group.points[i];
        const isLastPoint = i === group.points.length - 1 || curr.time === maxTimeForSubtype;
        
        // Check if explicitly marked as censored
        if (curr.censored && curr.censored > 0) {
          censors.push({
            time: curr.time,
            survival: curr.survival,
            subtype: group.subtype,
            isEndOfFollowUp: isLastPoint && curr.survival > 0
          });
        }
        
        // Also mark end of follow-up if survival > 0 and it's the last point
        // (indicating participants finished follow-up without event)
        if (isLastPoint && curr.survival > 0) {
          // Check if we haven't already added this as a censored point
          const alreadyAdded = censors.some(
            c => c.subtype === group.subtype && Math.abs(c.time - curr.time) < 0.01
          );
          if (!alreadyAdded) {
            censors.push({
              time: curr.time,
              survival: curr.survival,
              subtype: group.subtype,
              isEndOfFollowUp: true
            });
          }
        }
      }
    });
    
    // Generate risk table data at regular intervals
    const riskIntervals = generateRiskIntervals(maxT);
    const riskTable = riskIntervals.map(t => {
      const row: Record<string, number | string> = { time: t };
      processedData.forEach(group => {
        // Find the last point at or before this time
        const relevantPoints = group.points.filter(p => p.time <= t);
        if (relevantPoints.length > 0) {
          const lastPoint = relevantPoints[relevantPoints.length - 1];
          row[group.subtype] = lastPoint.atRisk ?? estimateAtRisk(group.points, t, group.n);
        } else {
          row[group.subtype] = group.n;
        }
      });
      return row;
    });
    
    return { 
      chartData: chartPoints, 
      eventPoints: markers, 
      censorPoints: censors, 
      subtypes: subtypeNames, 
      maxTime: maxT,
      riskTableData: riskTable
    };
  }, [data, subtypeCounts]);

  if (!data || data.length === 0) {
    return (
      <Card className="border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Survival Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            No survival data available. Include survivalData in your JSON.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-lg">Kaplan-Meier Survival Curves</CardTitle>
          {logRankResult && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={logRankResult.pValue < 0.05 ? "default" : "secondary"}
                    className={`cursor-help ${logRankResult.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {isPrecomputedPValue ? <Database className="h-3 w-3 mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                    Log-rank: {formatPValue(logRankResult.pValue)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPrecomputedPValue ? 'Pre-computed from R analysis' : 'Estimated from survival curves'}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSurvivalStats('csv')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSurvivalStats('tsv')}>
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
        <div ref={chartRef} className="h-[420px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, 'dataMax']}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Time (months)", position: "insideBottom", offset: -15, fontSize: 12 }}
                tickFormatter={(value) => value.toFixed(0)}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Survival Probability", angle: -90, position: "insideLeft", fontSize: 12, dx: -5 }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  if (name.includes('_upper') || name.includes('_lower')) {
                    return null;
                  }
                  return [`${(value * 100).toFixed(1)}%`, name];
                }}
                labelFormatter={(time) => `Time: ${Number(time).toFixed(1)} months`}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                iconType="plainline"
                payload={subtypes.map(subtype => ({
                  value: `${subtype}${medianSurvival[subtype] !== null ? ` (median: ${medianSurvival[subtype]?.toFixed(1)}mo)` : ' (median: NR)'}`,
                  type: 'line' as const,
                  color: subtypeColors[subtype] || "hsl(var(--primary))"
                }))}
              />
              
              {/* Reference line at 50% survival (median) */}
              <ReferenceLine 
                y={0.5} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
              />
              
              {/* Median survival vertical lines for each subtype */}
              {subtypes.map(subtype => {
                const median = medianSurvival[subtype];
                if (median === null) return null;
                return (
                  <ReferenceLine
                    key={`median-line-${subtype}`}
                    x={median}
                    stroke={subtypeColors[subtype] || "hsl(var(--primary))"}
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                );
              })}
              
              {/* Confidence interval areas */}
              {subtypes.map((subtype) => {
                const color = subtypeColors[subtype] || "hsl(var(--primary))";
                return (
                  <Area
                    key={`${subtype}-ci`}
                    type="stepAfter"
                    dataKey={`${subtype}_upper`}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeWidth={0.5}
                    strokeDasharray="2 2"
                    strokeOpacity={0.3}
                    connectNulls
                    isAnimationActive={false}
                    legendType="none"
                  />
                );
              })}
              
              {/* Lower CI bounds */}
              {subtypes.map((subtype) => {
                const color = subtypeColors[subtype] || "hsl(var(--primary))";
                return (
                  <Line
                    key={`${subtype}-lower`}
                    type="stepAfter"
                    dataKey={`${subtype}_lower`}
                    stroke={color}
                    strokeWidth={0.5}
                    strokeDasharray="2 2"
                    strokeOpacity={0.3}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    legendType="none"
                  />
                );
              })}
              
              {/* Survival lines with event dots and censoring marks */}
              {subtypes.map((subtype) => (
                <Line
                  key={subtype}
                  type="stepAfter"
                  dataKey={subtype}
                  stroke={subtypeColors[subtype] || "hsl(var(--primary))"}
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload || cx === undefined || cy === undefined) return null;
                    
                    const time = payload.time;
                    const color = subtypeColors[subtype] || "hsl(var(--primary))";
                    
                    // Check if this is an event point
                    const isEvent = eventPoints.some(
                      e => e.subtype === subtype && Math.abs(e.time - time) < 0.01
                    );
                    
                    // Check if this is a censoring point
                    const isCensor = censorPoints.some(
                      c => c.subtype === subtype && Math.abs(c.time - time) < 0.01
                    );
                    
                    if (isEvent) {
                      return (
                        <circle
                          key={`event-${subtype}-${time}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={color}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                        />
                      );
                    }
                    
                    if (isCensor) {
                      const censorInfo = censorPoints.find(
                        c => c.subtype === subtype && Math.abs(c.time - time) < 0.01
                      );
                      const isEndOfFollowUp = censorInfo?.isEndOfFollowUp;
                      
                      // End of follow-up uses a different marker (cross/plus)
                      if (isEndOfFollowUp) {
                        return (
                          <g key={`end-followup-${subtype}-${time}`}>
                            {/* Vertical line */}
                            <line
                              x1={cx}
                              y1={cy - 6}
                              x2={cx}
                              y2={cy + 6}
                              stroke={color}
                              strokeWidth={2.5}
                            />
                            {/* Horizontal line to form a cross */}
                            <line
                              x1={cx - 5}
                              y1={cy}
                              x2={cx + 5}
                              y2={cy}
                              stroke={color}
                              strokeWidth={2.5}
                            />
                          </g>
                        );
                      }
                      
                      // Regular censoring marker (vertical tick)
                      return (
                        <g key={`censor-${subtype}-${time}`}>
                          <line
                            x1={cx}
                            y1={cy - 6}
                            x2={cx}
                            y2={cy + 6}
                            stroke={color}
                            strokeWidth={2}
                          />
                        </g>
                      );
                    }
                    
                    return null;
                  }}
                  connectNulls
                  name={subtype}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Risk Table */}
        {riskTableData.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <h4 className="text-sm font-semibold mb-2">Number at Risk</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 font-medium">Time</th>
                  {riskTableData.map((row, i) => (
                    <th key={i} className="text-center py-1 px-2 font-normal text-muted-foreground">
                      {Number(row.time).toFixed(0)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subtypes.map(subtype => (
                  <tr key={subtype} className="border-b border-border/50">
                    <td className="py-1 pr-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: subtypeColors[subtype] }}
                        />
                        <span className="font-medium">{subtype}</span>
                      </div>
                    </td>
                    {riskTableData.map((row, i) => (
                      <td key={i} className="text-center py-1 px-2">
                        {row[subtype] !== undefined ? Math.round(Number(row[subtype])) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Summary statistics */}
        <div className="mt-4 space-y-3">
          {/* Median survival times */}
          <div className="flex flex-wrap gap-4 justify-center">
            {subtypes.map(subtype => (
              <div 
                key={subtype}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: subtypeColors[subtype] }}
                />
                <span className="text-sm font-medium">{subtype}:</span>
                <span className="text-sm text-muted-foreground">
                  Median = {medianSurvival[subtype] !== null 
                    ? `${medianSurvival[subtype]?.toFixed(1)} mo` 
                    : 'Not Reached'}
                </span>
              </div>
            ))}
          </div>
          
          {/* Cox PH results */}
          {coxPHResult && (
            <div className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Cox Proportional Hazards Analysis</h4>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help text-xs">
                        {isPrecomputedCoxPH ? <Database className="h-3 w-3 mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                        {isPrecomputedCoxPH ? 'R' : 'Est.'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isPrecomputedCoxPH ? 'Pre-computed from R analysis' : 'Estimated from survival curves'}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Reference: {coxPHResult.referenceGroup}
              </div>
              <div className="space-y-1">
                {coxPHResult.groups.map(g => (
                  <div key={g.subtype} className="flex flex-wrap items-center gap-2 text-sm">
                    <span 
                      className="font-medium"
                      style={{ color: subtypeColors[g.subtype] }}
                    >
                      {g.subtype}:
                    </span>
                    <span>HR = {formatHR(g.hazardRatio, g.lowerCI, g.upperCI)}</span>
                    <Badge 
                      variant={g.pValue < 0.05 ? "default" : "secondary"}
                      className={`text-xs ${g.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {formatPValue(g.pValue)}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Wald test: χ² = {coxPHResult.waldTest.chiSquare.toFixed(2)}, 
                df = {coxPHResult.waldTest.df}, 
                {formatPValue(coxPHResult.waldTest.pValue)}
              </div>
            </div>
          )}
        </div>
        
        {/* Data source legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            <span>= Pre-computed (R)</span>
          </div>
          <div className="flex items-center gap-1">
            <Calculator className="h-3 w-3" />
            <span>= Estimated</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-current" />
            <span>| = Censored</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold">+</span>
            <span>= End of follow-up</span>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Shaded regions show 95% confidence intervals. Dots indicate events (deaths). 
          Vertical ticks (|) indicate censored observations. Plus signs (+) indicate end of follow-up without event.
          Dashed line at 50% indicates median survival.
        </p>
      </CardContent>
    </Card>
  );
};

// Helper function to generate risk table time intervals
function generateRiskIntervals(maxTime: number): number[] {
  const intervals: number[] = [0];
  
  // Determine appropriate interval based on max time
  let step: number;
  if (maxTime <= 24) {
    step = 6;
  } else if (maxTime <= 60) {
    step = 12;
  } else if (maxTime <= 120) {
    step = 24;
  } else {
    step = Math.ceil(maxTime / 6);
  }
  
  for (let t = step; t <= maxTime; t += step) {
    intervals.push(t);
  }
  
  return intervals;
}

// Helper function to estimate at-risk count when not provided
function estimateAtRisk(points: SurvivalTimePoint[], time: number, n: number): number {
  const relevantPoints = points.filter(p => p.time <= time);
  if (relevantPoints.length === 0) return n;
  
  const lastPoint = relevantPoints[relevantPoints.length - 1];
  // Estimate based on survival probability
  return Math.round(lastPoint.survival * n);
}
