import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult } from "@/data/mockNmfData";
import { useMemo } from "react";

interface ClusterScatterProps {
  samples: SampleResult[];
}

const SUBTYPE_COLORS: Record<string, string> = {
  "Subtype_1": "hsl(221, 83%, 53%)",
  "Subtype_2": "hsl(262, 83%, 58%)",
  "Subtype_3": "hsl(142, 71%, 45%)",
  "Subtype_4": "hsl(24, 95%, 53%)",
};

const SUBTYPE_LABELS: Record<string, string> = {
  "Subtype_1": "Proliferative",
  "Subtype_2": "Epithelial",
  "Subtype_3": "Mesenchymal",
  "Subtype_4": "Immune",
};

export const ClusterScatter = ({ samples }: ClusterScatterProps) => {
  // Simulate UMAP-like coordinates based on subtype scores
  const scatterData = useMemo(() => {
    return samples.map((sample, idx) => {
      const subtypeNum = parseInt(sample.subtype.split("_")[1]);
      const angle = ((subtypeNum - 1) / 4) * 2 * Math.PI + (Math.random() - 0.5) * 0.8;
      const radius = 2 + Math.random() * 1.5;
      
      return {
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.8,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.8,
        z: 50,
        subtype: sample.subtype,
        sample_id: sample.sample_id,
      };
    });
  }, [samples]);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Sample Clustering (UMAP-style)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="UMAP1"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="UMAP2"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <ZAxis type="number" dataKey="z" range={[30, 60]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any, name: string) => {
                  if (name === "subtype") return [SUBTYPE_LABELS[value] || value, "Subtype"];
                  return [value, name];
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SUBTYPE_COLORS[entry.subtype]}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {Object.entries(SUBTYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SUBTYPE_COLORS[key] }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
