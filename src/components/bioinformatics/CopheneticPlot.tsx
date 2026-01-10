import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Line } from "recharts";
import { RankMetric, defaultRankMetrics } from "@/data/mockNmfData";
import { useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";

interface CopheneticPlotProps {
  rankMetrics?: RankMetric[];
  optimalRank?: number;
}

export const CopheneticPlot = ({ rankMetrics, optimalRank }: CopheneticPlotProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "nmf-rank-selection");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "nmf-rank-selection");
  };

  const data = rankMetrics && rankMetrics.length > 0 ? rankMetrics : defaultRankMetrics;
  const optimal = optimalRank ?? data.reduce((max, curr) => 
    curr.cophenetic > max.cophenetic ? curr : max, data[0]
  ).rank;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">NMF Rank Selection</CardTitle>
        <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadSVG}>
          <Download className="h-4 w-4 mr-1" />
          SVG
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[240px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="copheneticGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="rank" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Factorization Rank (k)", position: "bottom", offset: -5, fontSize: 11 }}
              />
              <YAxis 
                domain={[0.5, 1]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  value.toFixed(3),
                  name === "cophenetic" ? "Cophenetic Corr." : "Silhouette"
                ]}
              />
              <ReferenceLine 
                x={optimal} 
                stroke="hsl(142, 71%, 45%)" 
                strokeDasharray="4 4"
                label={{ value: `Optimal (k=${optimal})`, position: "top", fontSize: 10, fill: "hsl(142, 71%, 45%)" }}
              />
              <Area
                type="monotone"
                dataKey="cophenetic"
                stroke="hsl(221, 83%, 53%)"
                fillOpacity={1}
                fill="url(#copheneticGradient)"
              />
              <Line
                type="monotone"
                dataKey="cophenetic"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                dot={{ fill: "hsl(221, 83%, 53%)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="silhouette"
                stroke="hsl(262, 83%, 58%)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(262, 83%, 58%)", strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span className="text-xs text-muted-foreground">Cophenetic Correlation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-violet-500" style={{ borderTop: "2px dashed" }} />
            <span className="text-xs text-muted-foreground">Silhouette Score</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
