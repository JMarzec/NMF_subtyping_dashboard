import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  Area, 
  ComposedChart,
  ReferenceLine
} from "recharts";
import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { logRankTest, formatPValue } from "@/lib/logRankTest";

export interface SurvivalData {
  subtype: string;
  timePoints: { time: number; survival: number; event?: boolean }[];
}

interface SurvivalCurveProps {
  data: SurvivalData[];
  subtypeColors: Record<string, string>;
  subtypeCounts?: Record<string, number>;
}

export const SurvivalCurve = ({ data, subtypeColors, subtypeCounts }: SurvivalCurveProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "survival-curve");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "survival-curve");
  };

  // Calculate log-rank test p-value
  const logRankResult = useMemo(() => {
    return logRankTest(data, subtypeCounts);
  }, [data, subtypeCounts]);

  // Transform data into step-function format with confidence intervals
  const { chartData, eventPoints, subtypes } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], eventPoints: [], subtypes: [] };
    
    const subtypeNames = data.map(d => d.subtype);
    
    // For each subtype, create a proper step function with CIs
    // Ensure survival is monotonically decreasing
    const processedData = data.map(group => {
      const subtype = group.subtype;
      const n = subtypeCounts?.[subtype] || 100;
      
      // Sort time points and ensure monotonicity
      const sortedPoints = [...group.timePoints]
        .sort((a, b) => a.time - b.time)
        .reduce<{ time: number; survival: number; se: number }[]>((acc, tp) => {
          const lastSurvival = acc.length > 0 ? acc[acc.length - 1].survival : 1;
          // Ensure survival is monotonically non-increasing
          const survival = Math.min(lastSurvival, tp.survival);
          
          // Calculate standard error using Greenwood's formula approximation
          // SE ≈ S * sqrt((1-S) / (n * S)) when S > 0
          const se = survival > 0.01 && survival < 0.99
            ? survival * Math.sqrt((1 - survival) / (n * survival))
            : 0;
          
          acc.push({ time: tp.time, survival, se });
          return acc;
        }, []);
      
      return { subtype, points: sortedPoints };
    });
    
    // Get all unique time points
    const allTimes = new Set<number>();
    processedData.forEach(group => {
      group.points.forEach(p => allTimes.add(p.time));
    });
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Build step-function chart data
    const chartPoints: Record<string, number>[] = [];
    const lastKnown: Record<string, { survival: number; se: number }> = {};
    
    processedData.forEach(g => {
      lastKnown[g.subtype] = { survival: 1.0, se: 0 };
    });
    
    for (let i = 0; i < sortedTimes.length; i++) {
      const time = sortedTimes[i];
      const point: Record<string, number> = { time };
      
      processedData.forEach(group => {
        const tp = group.points.find(p => p.time === time);
        if (tp) {
          lastKnown[group.subtype] = { survival: tp.survival, se: tp.se };
        }
        const { survival, se } = lastKnown[group.subtype];
        point[group.subtype] = survival;
        point[`${group.subtype}_upper`] = Math.min(1, survival + 1.96 * se);
        point[`${group.subtype}_lower`] = Math.max(0, survival - 1.96 * se);
      });
      
      chartPoints.push(point);
    }
    
    // Collect event markers (where survival drops)
    const markers: { time: number; survival: number; subtype: string }[] = [];
    processedData.forEach(group => {
      for (let i = 1; i < group.points.length; i++) {
        const prev = group.points[i - 1];
        const curr = group.points[i];
        if (curr.survival < prev.survival - 0.001) {
          markers.push({
            time: curr.time,
            survival: curr.survival,
            subtype: group.subtype
          });
        }
      }
    });
    
    return { chartData: chartPoints, eventPoints: markers, subtypes: subtypeNames };
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

  // Custom shape for CI band
  const renderCIBand = (subtype: string) => {
    const color = subtypeColors[subtype] || "hsl(var(--primary))";
    
    return ({ points }: { points: Array<{ x: number; y: number }> }) => {
      if (!points || points.length === 0) return null;
      
      // Build step path for upper bound
      let pathD = '';
      for (let i = 0; i < chartData.length; i++) {
        const time = chartData[i].time as number;
        const upper = chartData[i][`${subtype}_upper`] as number;
        const lower = chartData[i][`${subtype}_lower`] as number;
        
        // We need the actual x,y coordinates - this is complex with recharts
        // so we'll use a simpler Area approach
      }
      
      return null;
    };
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Kaplan-Meier Survival Curves</CardTitle>
          {logRankResult && (
            <Badge 
              variant={logRankResult.pValue < 0.05 ? "default" : "secondary"}
              className={logRankResult.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}
            >
              Log-rank: {formatPValue(logRankResult.pValue)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
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
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Time (months)", position: "insideBottom", offset: -15, fontSize: 12 }}
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
                labelFormatter={(time) => `Time: ${time} months`}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                iconType="plainline"
                payload={subtypes.map(subtype => ({
                  value: subtype,
                  type: 'line' as const,
                  color: subtypeColors[subtype] || "hsl(var(--primary))"
                }))}
              />
              
              {/* Reference line at 50% survival */}
              <ReferenceLine 
                y={0.5} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
              />
              
              {/* Confidence interval areas - upper bounds with fill */}
              {subtypes.map((subtype) => {
                const color = subtypeColors[subtype] || "hsl(var(--primary))";
                return (
                  <Area
                    key={`${subtype}-upper`}
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
              
              {/* Lower bounds - just show as dashed line */}
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
              
              {/* Survival lines */}
              {subtypes.map((subtype) => (
                <Line
                  key={subtype}
                  type="stepAfter"
                  dataKey={subtype}
                  stroke={subtypeColors[subtype] || "hsl(var(--primary))"}
                  strokeWidth={2.5}
                  dot={(props) => {
                    // Show dots at event points
                    const { cx, cy, payload } = props;
                    if (!payload) return null;
                    const isEvent = eventPoints.some(
                      e => e.subtype === subtype && e.time === payload.time
                    );
                    if (!isEvent) return null;
                    return (
                      <circle
                        key={`dot-${subtype}-${payload.time}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={subtypeColors[subtype] || "hsl(var(--primary))"}
                        stroke="hsl(var(--background))"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  connectNulls
                  name={subtype}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Shaded regions show 95% confidence intervals. Dots indicate events.
          Dashed line at 50% indicates median survival.
        </p>
      </CardContent>
    </Card>
  );
};
