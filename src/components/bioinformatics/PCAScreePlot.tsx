import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart } from "recharts";
import { SampleResult } from "@/data/mockNmfData";
import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { downloadChartAsPNG } from "@/lib/chartExport";

interface PCAScreePlotProps {
  samples: SampleResult[];
}

// Compute all principal components variance
const computeAllPCAVariance = (data: number[][]): { variances: number[]; cumulative: number[] } => {
  if (data.length === 0) return { variances: [], cumulative: [] };

  const n = data.length;
  const m = data[0].length;

  // Center the data
  const means = Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      means[j] += data[i][j];
    }
  }
  for (let j = 0; j < m; j++) {
    means[j] /= n;
  }

  const centered = data.map(row => row.map((v, j) => v - means[j]));

  // Compute covariance matrix
  const cov: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = i; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      cov[i][j] = sum / (n - 1);
      cov[j][i] = cov[i][j];
    }
  }

  // Calculate total variance
  let totalVariance = 0;
  for (let i = 0; i < m; i++) {
    totalVariance += cov[i][i];
  }

  // Power iteration for eigenvalues
  const eigenvalues: number[] = [];
  let currentCov = cov.map(row => [...row]);

  for (let pc = 0; pc < Math.min(m, 10); pc++) {
    let vector = Array(m).fill(0).map(() => Math.random());
    let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    vector = vector.map(v => v / norm);

    let eigenvalue = 0;
    for (let iter = 0; iter < 100; iter++) {
      const newVector = Array(m).fill(0);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          newVector[i] += currentCov[i][j] * vector[j];
        }
      }
      eigenvalue = newVector.reduce((sum, v, i) => sum + v * vector[i], 0);
      norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      vector = newVector.map(v => v / norm);
    }

    if (eigenvalue > 0) {
      eigenvalues.push(eigenvalue);
      // Deflate
      currentCov = currentCov.map((row, i) =>
        row.map((v, j) => v - eigenvalue * vector[i] * vector[j])
      );
    }
  }

  const variances = eigenvalues.map(e => totalVariance > 0 ? (e / totalVariance) * 100 : 0);
  const cumulative: number[] = [];
  let sum = 0;
  for (const v of variances) {
    sum += v;
    cumulative.push(sum);
  }

  return { variances, cumulative };
};

export const PCAScreePlot = ({ samples }: PCAScreePlotProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    const scoreMatrix = samples.map(sample => {
      const scores: number[] = [];
      Object.entries(sample).forEach(([key, value]) => {
        if (key.startsWith("score_") && typeof value === "number") {
          scores.push(value);
        }
      });
      return scores.length > 0 ? scores : [Math.random(), Math.random(), Math.random()];
    });

    const { variances, cumulative } = computeAllPCAVariance(scoreMatrix);

    return variances.map((variance, idx) => ({
      pc: `PC${idx + 1}`,
      variance: variance,
      cumulative: cumulative[idx],
    }));
  }, [samples]);

  const handleDownload = () => {
    downloadChartAsPNG(chartRef.current, "pca-scree-plot");
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">PCA Scree Plot</CardTitle>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[280px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
              <XAxis
                dataKey="pc"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Principal Component", position: "bottom", offset: 10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Variance (%)", angle: -90, position: "insideLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Cumulative (%)", angle: 90, position: "insideRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === "variance" ? "Variance" : "Cumulative"
                ]}
              />
              <Bar yAxisId="left" dataKey="variance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
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
                dot={{ fill: "hsl(var(--destructive))", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
