import { computePCA, nmfVectors } from "@/lib/dimensionality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart, ReferenceLine } from "recharts";
import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { SampleResult } from "@/data/mockNmfData";

interface HeatmapData {
  genes: string[];
  samples: string[];
  sampleSubtypes: string[];
  values: number[][];
}

type PCADataSource = "expression" | "nmf";

interface PCAScreePlotProps {
  heatmapData: HeatmapData;
  samples: SampleResult[];
}

const varianceResult=(rows:number[][])=>{
  const variances=computePCA(rows).variance.slice(0,50);let sum=0;
  return {variances,cumulative:variances.map(v=>{sum+=v;return Math.min(100,sum);})};
};
const computeAllPCAVariance=(values:number[][],_nGenes:number,nSamples:number)=>varianceResult(Array.from({length:nSamples},(_,i)=>values.map(r=>r[i])));
const computeNMFVariance=(samples:SampleResult[])=>varianceResult(nmfVectors(samples));

export const PCAScreePlot = ({ heatmapData, samples }: PCAScreePlotProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [dataSource, setDataSource] = useState<PCADataSource>("expression");

  const chartData = useMemo(() => {
    if (dataSource === "expression") {
      const { variances, cumulative } = computeAllPCAVariance(
        heatmapData.values, 
        heatmapData.genes.length, 
        heatmapData.samples.length
      );

      return variances.map((variance, idx) => ({
        pc: `PC${idx + 1}`,
        pcNum: idx + 1,
        variance: variance,
        cumulative: cumulative[idx],
      }));
    } else {
      const { variances, cumulative } = computeNMFVariance(samples);

      return variances.map((variance, idx) => ({
        pc: `PC${idx + 1}`,
        pcNum: idx + 1,
        variance: variance,
        cumulative: cumulative[idx],
      }));
    }
  }, [heatmapData, samples, dataSource]);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "pca-scree-plot");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "pca-scree-plot");
  };

  // Find PC where cumulative reaches 80%
  const pc80 = chartData.findIndex(d => d.cumulative >= 80);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-lg">PCA Scree Plot ({chartData.length} components)</CardTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">NMF</Label>
            <Switch
              checked={dataSource === "expression"}
              onCheckedChange={(checked) => setDataSource(checked ? "expression" : "nmf")}
              className="scale-75"
            />
            <Label className="text-xs text-muted-foreground">Expr</Label>
          </div>
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
        <div ref={chartRef} className="h-[200px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 40, bottom: 30, left: 10 }}>
              <XAxis
                dataKey="pcNum"
                type="number"
                domain={[1, chartData.length]}
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(v) => `${v}`}
                label={{ value: "Principal Component", position: "bottom", offset: 10, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Variance (%)", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Cumulative (%)", angle: 90, position: "insideRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)}%`,
                  name === "variance" ? "Variance" : "Cumulative"
                ]}
                labelFormatter={(label) => `PC${label}`}
              />
              <Bar yAxisId="left" dataKey="variance" fill="hsl(var(--primary))" radius={[1, 1, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fillOpacity={0.8} />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine yAxisId="right" y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          {dataSource === "expression" ? "Gene Expression" : "NMF Scores"} - {pc80 >= 0 
            ? `80% variance explained by first ${pc80 + 1} components`
            : "Dashed line indicates 80% cumulative variance threshold"}
        </p>
      </CardContent>
    </Card>
  );
};
