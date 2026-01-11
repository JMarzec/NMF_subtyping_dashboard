import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from "recharts";
import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";

export interface SurvivalData {
  subtype: string;
  timePoints: { time: number; survival: number; event?: boolean }[];
}

interface SurvivalCurveProps {
  data: SurvivalData[];
  subtypeColors: Record<string, string>;
}

// Custom dot component for censored events (vertical tick marks)
const CensoredDot = (props: { cx?: number; cy?: number; stroke?: string }) => {
  const { cx, cy, stroke } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <line
      x1={cx}
      y1={cy - 6}
      x2={cx}
      y2={cy + 6}
      stroke={stroke}
      strokeWidth={2}
    />
  );
};

export const SurvivalCurve = ({ data, subtypeColors }: SurvivalCurveProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "survival-curve");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "survival-curve");
  };

  // Transform data into step-function format for proper Kaplan-Meier display
  const { chartData, eventMarkers } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], eventMarkers: [] };
    
    // Get all unique time points across all subtypes
    const allTimes = new Set<number>();
    data.forEach(d => d.timePoints.forEach(tp => allTimes.add(tp.time)));
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Build chart data - for each subtype, carry forward the last known survival value
    const lastKnownSurvival: Record<string, number> = {};
    data.forEach(d => { lastKnownSurvival[d.subtype] = 1.0; });
    
    const chartPoints = sortedTimes.map(time => {
      const point: Record<string, number> = { time };
      data.forEach(d => {
        const tp = d.timePoints.find(t => t.time === time);
        if (tp) {
          lastKnownSurvival[d.subtype] = tp.survival;
        }
        point[d.subtype] = lastKnownSurvival[d.subtype];
      });
      return point;
    });
    
    // Collect event markers (drops in survival indicate events)
    const markers: { time: number; survival: number; subtype: string }[] = [];
    data.forEach(d => {
      for (let i = 1; i < d.timePoints.length; i++) {
        const prev = d.timePoints[i - 1];
        const curr = d.timePoints[i];
        // Mark events where survival drops
        if (curr.survival < prev.survival) {
          markers.push({
            time: curr.time,
            survival: curr.survival,
            subtype: d.subtype
          });
        }
      }
    });
    
    return { chartData: chartPoints, eventMarkers: markers };
  }, [data]);

  const subtypes = data.map(d => d.subtype);

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
        <CardTitle className="text-lg">Kaplan-Meier Survival Curves</CardTitle>
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
        <div ref={chartRef} className="h-[320px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Time (months)", position: "insideBottom", offset: -5, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Survival Probability", angle: -90, position: "insideLeft", fontSize: 11 }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  `${(value * 100).toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(time) => `Time: ${time} months`}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                iconType="plainline"
              />
              {subtypes.map((subtype) => (
                <Line
                  key={subtype}
                  type="stepAfter"
                  dataKey={subtype}
                  stroke={subtypeColors[subtype] || "hsl(var(--primary))"}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name={subtype}
                />
              ))}
              {/* Event markers - small circles at each survival drop */}
              {eventMarkers.map((marker, idx) => (
                <ReferenceDot
                  key={`event-${idx}`}
                  x={marker.time}
                  y={marker.survival}
                  r={4}
                  fill={subtypeColors[marker.subtype] || "hsl(var(--primary))"}
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
