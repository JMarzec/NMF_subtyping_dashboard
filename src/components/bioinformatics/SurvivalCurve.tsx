import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG } from "@/lib/chartExport";

export interface SurvivalData {
  subtype: string;
  timePoints: { time: number; survival: number }[];
}

interface SurvivalCurveProps {
  data: SurvivalData[];
  subtypeColors: Record<string, string>;
}

export const SurvivalCurve = ({ data, subtypeColors }: SurvivalCurveProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    downloadChartAsPNG(chartRef.current, "survival-curve");
  };
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Get all unique time points
    const allTimes = new Set<number>();
    data.forEach(d => d.timePoints.forEach(tp => allTimes.add(tp.time)));
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Build chart data with survival values for each subtype at each time
    return sortedTimes.map(time => {
      const point: Record<string, number> = { time };
      data.forEach(d => {
        const tp = d.timePoints.find(t => t.time === time);
        if (tp) {
          point[d.subtype] = tp.survival;
        }
      });
      return point;
    });
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
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[280px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Time (months)", position: "bottom", offset: 0, fontSize: 11 }}
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
                wrapperStyle={{ fontSize: "12px" }}
                iconType="line"
              />
              {subtypes.map((subtype) => (
                <Line
                  key={subtype}
                  type="stepAfter"
                  dataKey={subtype}
                  stroke={subtypeColors[subtype] || "hsl(var(--primary))"}
                  strokeWidth={2}
                  dot={false}
                  name={subtype}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
