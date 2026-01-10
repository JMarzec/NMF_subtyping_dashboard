import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleResult } from "@/data/mockNmfData";
import { useMemo } from "react";

interface ClusteringMetricsProps {
  samples: SampleResult[];
}

// Calculate silhouette score for clustering
const calculateSilhouetteScore = (samples: SampleResult[]): number => {
  if (samples.length < 2) return 0;

  const subtypes = [...new Set(samples.map(s => s.subtype))];
  if (subtypes.length < 2) return 0;

  // Extract score vectors
  const getScoreVector = (sample: SampleResult): number[] => {
    const scores: number[] = [];
    Object.entries(sample).forEach(([key, value]) => {
      if (key.startsWith("score_") && typeof value === "number") {
        scores.push(value);
      }
    });
    return scores.length > 0 ? scores : [0];
  };

  const euclidean = (a: number[], b: number[]): number => {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  };

  let totalSilhouette = 0;

  for (const sample of samples) {
    const sampleVector = getScoreVector(sample);
    const sameCluster = samples.filter(s => s.subtype === sample.subtype && s.sample_id !== sample.sample_id);
    const otherClusters = subtypes.filter(st => st !== sample.subtype);

    // a(i) - average distance to same cluster
    let a = 0;
    if (sameCluster.length > 0) {
      a = sameCluster.reduce((sum, s) => sum + euclidean(sampleVector, getScoreVector(s)), 0) / sameCluster.length;
    }

    // b(i) - minimum average distance to other clusters
    let b = Infinity;
    for (const otherSubtype of otherClusters) {
      const otherSamples = samples.filter(s => s.subtype === otherSubtype);
      if (otherSamples.length > 0) {
        const avgDist = otherSamples.reduce((sum, s) => sum + euclidean(sampleVector, getScoreVector(s)), 0) / otherSamples.length;
        b = Math.min(b, avgDist);
      }
    }

    if (b === Infinity) b = 0;

    // s(i) = (b(i) - a(i)) / max(a(i), b(i))
    const maxAB = Math.max(a, b);
    const silhouette = maxAB > 0 ? (b - a) / maxAB : 0;
    totalSilhouette += silhouette;
  }

  return totalSilhouette / samples.length;
};

// Calculate Davies-Bouldin Index
const calculateDaviesBouldinIndex = (samples: SampleResult[]): number => {
  const subtypes = [...new Set(samples.map(s => s.subtype))];
  if (subtypes.length < 2) return 0;

  const getScoreVector = (sample: SampleResult): number[] => {
    const scores: number[] = [];
    Object.entries(sample).forEach(([key, value]) => {
      if (key.startsWith("score_") && typeof value === "number") {
        scores.push(value);
      }
    });
    return scores.length > 0 ? scores : [0];
  };

  const euclidean = (a: number[], b: number[]): number => {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  };

  // Calculate centroids and within-cluster scatter
  const clusterStats = subtypes.map(subtype => {
    const clusterSamples = samples.filter(s => s.subtype === subtype);
    const vectors = clusterSamples.map(getScoreVector);
    const dim = vectors[0]?.length || 1;

    // Centroid
    const centroid = Array(dim).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += v[i] / vectors.length;
      }
    }

    // Scatter (average distance to centroid)
    const scatter = vectors.reduce((sum, v) => sum + euclidean(v, centroid), 0) / vectors.length;

    return { subtype, centroid, scatter };
  });

  // Calculate DB index
  let dbSum = 0;
  for (let i = 0; i < clusterStats.length; i++) {
    let maxRatio = 0;
    for (let j = 0; j < clusterStats.length; j++) {
      if (i !== j) {
        const dist = euclidean(clusterStats[i].centroid, clusterStats[j].centroid);
        if (dist > 0) {
          const ratio = (clusterStats[i].scatter + clusterStats[j].scatter) / dist;
          maxRatio = Math.max(maxRatio, ratio);
        }
      }
    }
    dbSum += maxRatio;
  }

  return dbSum / clusterStats.length;
};

// Calculate Calinski-Harabasz Index
const calculateCalinskiHarabaszIndex = (samples: SampleResult[]): number => {
  const subtypes = [...new Set(samples.map(s => s.subtype))];
  if (subtypes.length < 2) return 0;

  const getScoreVector = (sample: SampleResult): number[] => {
    const scores: number[] = [];
    Object.entries(sample).forEach(([key, value]) => {
      if (key.startsWith("score_") && typeof value === "number") {
        scores.push(value);
      }
    });
    return scores.length > 0 ? scores : [0];
  };

  const vectors = samples.map(getScoreVector);
  const dim = vectors[0]?.length || 1;
  const n = samples.length;
  const k = subtypes.length;

  // Overall centroid
  const overallCentroid = Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      overallCentroid[i] += v[i] / n;
    }
  }

  // Between-cluster dispersion (BGSS) and within-cluster dispersion (WGSS)
  let bgss = 0;
  let wgss = 0;

  for (const subtype of subtypes) {
    const clusterSamples = samples.filter(s => s.subtype === subtype);
    const clusterVectors = clusterSamples.map(getScoreVector);
    const nk = clusterVectors.length;

    // Cluster centroid
    const centroid = Array(dim).fill(0);
    for (const v of clusterVectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += v[i] / nk;
      }
    }

    // BGSS contribution
    let distSq = 0;
    for (let i = 0; i < dim; i++) {
      distSq += Math.pow(centroid[i] - overallCentroid[i], 2);
    }
    bgss += nk * distSq;

    // WGSS contribution
    for (const v of clusterVectors) {
      for (let i = 0; i < dim; i++) {
        wgss += Math.pow(v[i] - centroid[i], 2);
      }
    }
  }

  if (wgss === 0) return 0;

  return (bgss / (k - 1)) / (wgss / (n - k));
};

export const ClusteringMetrics = ({ samples }: ClusteringMetricsProps) => {
  const metrics = useMemo(() => {
    const silhouette = calculateSilhouetteScore(samples);
    const daviesBouldin = calculateDaviesBouldinIndex(samples);
    const calinskiHarabasz = calculateCalinskiHarabaszIndex(samples);
    const numClusters = new Set(samples.map(s => s.subtype)).size;

    return { silhouette, daviesBouldin, calinskiHarabasz, numClusters };
  }, [samples]);

  const getQualityLabel = (silhouette: number): { label: string; color: string } => {
    if (silhouette > 0.7) return { label: "Strong", color: "text-green-400" };
    if (silhouette > 0.5) return { label: "Good", color: "text-emerald-400" };
    if (silhouette > 0.25) return { label: "Fair", color: "text-yellow-400" };
    return { label: "Weak", color: "text-red-400" };
  };

  const quality = getQualityLabel(metrics.silhouette);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Clustering Quality Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Silhouette Score</p>
            <p className="text-2xl font-bold">{metrics.silhouette.toFixed(3)}</p>
            <p className={`text-xs ${quality.color}`}>{quality.label} clustering</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Davies-Bouldin Index</p>
            <p className="text-2xl font-bold">{metrics.daviesBouldin.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">Lower is better</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Calinski-Harabasz Index</p>
            <p className="text-2xl font-bold">{metrics.calinskiHarabasz.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Higher is better</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Number of Clusters</p>
            <p className="text-2xl font-bold">{metrics.numClusters}</p>
            <p className="text-xs text-muted-foreground">NMF subtypes</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Interpretation:</span> Silhouette ranges from -1 to 1, where higher values indicate better-defined clusters. 
            Davies-Bouldin measures cluster separation (lower = better). Calinski-Harabasz measures cluster density ratio (higher = better).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
