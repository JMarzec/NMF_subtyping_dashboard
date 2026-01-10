import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";

interface SubtypeDistributionProps {
  subtypeCounts: Record<string, number>;
  subtypeColors: Record<string, string>;
}

export const SubtypeDistribution = ({ subtypeCounts, subtypeColors }: SubtypeDistributionProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "subtype-distribution");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "subtype-distribution");
  };

  const data = Object.entries(subtypeCounts).map(([key, value]) => ({
    name: key,
    value,
    color: subtypeColors[key] || "hsl(var(--primary))",
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Subtype Distribution</CardTitle>
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
        <div ref={chartRef} className="h-[280px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
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
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
