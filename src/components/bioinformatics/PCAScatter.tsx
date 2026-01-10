import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SampleResult, generateSubtypeColors } from "@/data/mockNmfData";
import { useMemo, useState } from "react";
import { AnnotationSelector } from "./AnnotationSelector";
import { AnnotationData } from "./AnnotationUploader";

interface PCAScatterProps {
  samples: SampleResult[];
  subtypeColors: Record<string, string>;
  userAnnotations?: AnnotationData;
}

// Simple PCA implementation using power iteration for top 2 components
const computePCA = (data: number[][]): { pc1: number[]; pc2: number[] } => {
  if (data.length === 0) return { pc1: [], pc2: [] };

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

  // Power iteration for top eigenvector
  const powerIteration = (matrix: number[][], deflated = false, prevVector?: number[]): number[] => {
    let vector = Array(m).fill(0).map(() => Math.random());
    
    // Normalize
    let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    vector = vector.map(v => v / norm);

    for (let iter = 0; iter < 100; iter++) {
      // Multiply by matrix
      const newVector = Array(m).fill(0);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          newVector[i] += matrix[i][j] * vector[j];
        }
      }

      // Normalize
      norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      vector = newVector.map(v => v / norm);
    }

    return vector;
  };

  // Get first principal component
  const pc1Vector = powerIteration(cov);
  const pc1Scores = centered.map(row => 
    row.reduce((sum, v, j) => sum + v * pc1Vector[j], 0)
  );

  // Deflate covariance matrix
  const eigenvalue1 = pc1Scores.reduce((sum, v) => sum + v * v, 0) / (n - 1);
  const deflatedCov = cov.map((row, i) =>
    row.map((v, j) => v - eigenvalue1 * pc1Vector[i] * pc1Vector[j])
  );

  // Get second principal component
  const pc2Vector = powerIteration(deflatedCov, true, pc1Vector);
  const pc2Scores = centered.map(row =>
    row.reduce((sum, v, j) => sum + v * pc2Vector[j], 0)
  );

  return { pc1: pc1Scores, pc2: pc2Scores };
};

export const PCAScatter = ({ samples, subtypeColors, userAnnotations }: PCAScatterProps) => {
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

  // Compute PCA from sample scores
  const { scatterData, uniqueSubtypes, uniqueAnnotationValues } = useMemo(() => {
    const subtypes = [...new Set(samples.map(s => s.subtype))].sort();

    // Extract score matrix from samples (all score_subtype_* columns)
    const scoreMatrix = samples.map(sample => {
      const scores: number[] = [];
      Object.entries(sample).forEach(([key, value]) => {
        if (key.startsWith("score_") && typeof value === "number") {
          scores.push(value);
        }
      });
      return scores.length > 0 ? scores : [Math.random(), Math.random(), Math.random()];
    });

    // Compute PCA
    const { pc1, pc2 } = computePCA(scoreMatrix);

    const data = samples.map((sample, idx) => {
      const userAnnotValue = selectedAnnotation && userAnnotations?.annotations[sample.sample_id]
        ? userAnnotations.annotations[sample.sample_id][selectedAnnotation]
        : undefined;

      return {
        x: pc1[idx] || 0,
        y: pc2[idx] || 0,
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
            PC1: {data.x.toFixed(2)}, PC2: {data.y.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-lg">Sample Clustering (PCA)</CardTitle>
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
                name="PC1"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "PC1", position: "bottom", offset: 0, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="PC2"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "PC2", angle: -90, position: "insideLeft", offset: 10, fontSize: 10 }}
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
