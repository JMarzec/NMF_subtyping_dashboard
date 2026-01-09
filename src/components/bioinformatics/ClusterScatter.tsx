import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult } from "@/data/mockNmfData";
import { useMemo } from "react";

interface ClusterScatterProps {
  samples: SampleResult[];
  subtypeColors: Record<string, string>;
}

export const ClusterScatter = ({ samples, subtypeColors }: ClusterScatterProps) => {
  // Simulate UMAP-like coordinates based on subtype scores
  const { scatterData, uniqueSubtypes } = useMemo(() => {
    const subtypes = [...new Set(samples.map(s => s.subtype))].sort();
    const subtypeAngles = new Map<string, number>();
    subtypes.forEach((subtype, idx) => {
      subtypeAngles.set(subtype, (idx / subtypes.length) * 2 * Math.PI);
    });

    const data = samples.map((sample) => {
      const baseAngle = subtypeAngles.get(sample.subtype) || 0;
      const angle = baseAngle + (Math.random() - 0.5) * 0.8;
      const radius = 2 + Math.random() * 1.5;
      
      return {
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.8,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.8,
        z: 50,
        subtype: sample.subtype,
        sample_id: sample.sample_id,
      };
    });

    return { scatterData: data, uniqueSubtypes: subtypes };
  }, [samples]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium">{data.sample_id}</p>
          <p className="text-xs text-muted-foreground">Subtype: {data.subtype}</p>
          <p className="text-xs text-muted-foreground">
            UMAP1: {data.x.toFixed(2)}, UMAP2: {data.y.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

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
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={scatterData}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={subtypeColors[entry.subtype] || "hsl(var(--primary))"}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {uniqueSubtypes.map((subtype) => (
            <div key={subtype} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: subtypeColors[subtype] || "hsl(var(--primary))" }}
              />
              <span className="text-xs text-muted-foreground">{subtype}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
