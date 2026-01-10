import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult, generateSubtypeColors } from "@/data/mockNmfData";
import { useMemo, useState } from "react";
import { AnnotationSelector } from "./AnnotationSelector";

interface AnnotationData {
  annotations: Record<string, Record<string, string>>;
  columns: string[];
}

interface ClusterScatterProps {
  samples: SampleResult[];
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
}

export const ClusterScatter = ({ samples, subtypeColors, userAnnotations }: ClusterScatterProps) => {
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);

  // Generate colors for user annotation values
  const userAnnotationColors = useMemo(() => {
    if (!selectedAnnotation || !userAnnotations) return {};
    const values = new Set<string>();
    Object.values(userAnnotations.annotations).forEach(annot => {
      if (annot[selectedAnnotation]) values.add(annot[selectedAnnotation]);
    });
    return generateSubtypeColors([...values].sort());
  }, [selectedAnnotation, userAnnotations]);

  // Simulate UMAP-like coordinates based on subtype scores
  const { scatterData, uniqueSubtypes, uniqueAnnotationValues } = useMemo(() => {
    const subtypes = [...new Set(samples.map(s => s.subtype))].sort();
    const subtypeAngles = new Map<string, number>();
    subtypes.forEach((subtype, idx) => {
      subtypeAngles.set(subtype, (idx / subtypes.length) * 2 * Math.PI);
    });

    const data = samples.map((sample) => {
      const baseAngle = subtypeAngles.get(sample.subtype) || 0;
      const angle = baseAngle + (Math.random() - 0.5) * 0.8;
      const radius = 2 + Math.random() * 1.5;
      
      const userAnnotValue = selectedAnnotation && userAnnotations?.annotations[sample.sample_id]
        ? userAnnotations.annotations[sample.sample_id][selectedAnnotation]
        : undefined;
      
      return {
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.8,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.8,
        z: 50,
        subtype: sample.subtype,
        sample_id: sample.sample_id,
        userAnnotation: userAnnotValue,
      };
    });

    const annotValues = selectedAnnotation 
      ? [...new Set(data.map(d => d.userAnnotation).filter(Boolean))].sort()
      : [];

    return { scatterData: data, uniqueSubtypes: subtypes, uniqueAnnotationValues: annotValues };
  }, [samples, selectedAnnotation, userAnnotations]);

  const getPointColor = (entry: typeof scatterData[0]) => {
    if (selectedAnnotation && entry.userAnnotation) {
      return userAnnotationColors[entry.userAnnotation] || "hsl(var(--muted))";
    }
    return subtypeColors[entry.subtype] || "hsl(var(--primary))";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium">{data.sample_id}</p>
          <p className="text-xs text-muted-foreground">Subtype: {data.subtype}</p>
          {data.userAnnotation && selectedAnnotation && (
            <p className="text-xs text-muted-foreground">{selectedAnnotation}: {data.userAnnotation}</p>
          )}
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-lg">Sample Clustering (UMAP-style)</CardTitle>
        {userAnnotations && userAnnotations.columns.length > 0 && (
          <AnnotationSelector
            columns={userAnnotations.columns}
            selectedColumn={selectedAnnotation}
            onColumnChange={setSelectedAnnotation}
            label="Color by"
          />
        )}
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
                    fill={getPointColor(entry)}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {selectedAnnotation && uniqueAnnotationValues.length > 0 ? (
            <>
              <span className="text-xs text-muted-foreground font-medium">{selectedAnnotation}:</span>
              {uniqueAnnotationValues.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: userAnnotationColors[value as string] || "hsl(var(--primary))" }}
                  />
                  <span className="text-xs text-muted-foreground">{value}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground font-medium">NMF Subtypes:</span>
              {uniqueSubtypes.map((subtype) => (
                <div key={subtype} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: subtypeColors[subtype] || "hsl(var(--primary))" }}
                  />
                  <span className="text-xs text-muted-foreground">{subtype}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
