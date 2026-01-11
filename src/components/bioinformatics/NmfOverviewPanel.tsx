import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Line,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { RankMetric, defaultRankMetrics } from "@/data/mockNmfData";
import { useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";

interface NmfOverviewPanelProps {
  rankMetrics?: RankMetric[];
  optimalRank?: number;
  subtypeCounts: Record<string, number>;
  subtypeColors: Record<string, string>;
}

export const NmfOverviewPanel = ({ 
  rankMetrics, 
  optimalRank, 
  subtypeCounts, 
  subtypeColors 
}: NmfOverviewPanelProps) => {
  const copheneticRef = useRef<HTMLDivElement>(null);
  const distributionRef = useRef<HTMLDivElement>(null);

  const handleDownloadCopheneticPNG = () => {
    downloadChartAsPNG(copheneticRef.current, "nmf-rank-selection");
  };

  const handleDownloadCopheneticSVG = () => {
    downloadRechartsAsSVG(copheneticRef.current, "nmf-rank-selection");
  };

  const handleDownloadDistributionPNG = () => {
    downloadChartAsPNG(distributionRef.current, "subtype-distribution");
  };

  const handleDownloadDistributionSVG = () => {
    downloadRechartsAsSVG(distributionRef.current, "subtype-distribution");
  };

  // Cophenetic data
  const rankData = rankMetrics && rankMetrics.length > 0 ? rankMetrics : defaultRankMetrics;
  const optimal = optimalRank ?? rankData.reduce((max, curr) => 
    curr.cophenetic > max.cophenetic ? curr : max, rankData[0]
  ).rank;

  // Distribution data
  const distributionData = Object.entries(subtypeCounts).map(([key, value]) => ({
    name: key,
    value,
    color: subtypeColors[key] || "hsl(var(--primary))",
  }));
  const total = distributionData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">NMF Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NMF Rank Selection (Cophenetic Plot) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Rank Selection</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDownloadCopheneticPNG}>
                  <Download className="h-3 w-3 mr-1" />
                  PNG
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDownloadCopheneticSVG}>
                  <Download className="h-3 w-3 mr-1" />
                  SVG
                </Button>
              </div>
            </div>
            <div ref={copheneticRef} className="h-[220px] bg-card">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rankData} margin={{ top: 28, right: 20, left: 0, bottom: 24 }}>
                  <defs>
                    <linearGradient id="copheneticGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="rank" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    label={{ value: "Factorization Rank (k)", position: "bottom", offset: 8, fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0.5, 1]}
                    tick={{ fontSize: 10 }}
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
                    label={{ value: `Optimal (k=${optimal})`, position: "top", fontSize: 9, fill: "hsl(142, 71%, 45%)", offset: 10 }}
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
                    dot={{ fill: "hsl(221, 83%, 53%)", strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="silhouette"
                    stroke="hsl(262, 83%, 58%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(262, 83%, 58%)", strokeWidth: 2, r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-blue-500" />
                <span className="text-[10px] text-muted-foreground">Cophenetic</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-violet-500" style={{ borderTop: "2px dashed" }} />
                <span className="text-[10px] text-muted-foreground">Silhouette</span>
              </div>
            </div>
          </div>

          {/* Subtype Distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Subtype Distribution</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDownloadDistributionPNG}>
                  <Download className="h-3 w-3 mr-1" />
                  PNG
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDownloadDistributionSVG}>
                  <Download className="h-3 w-3 mr-1" />
                  SVG
                </Button>
              </div>
            </div>
            <div ref={distributionRef} className="h-[220px] bg-card">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Samples"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
