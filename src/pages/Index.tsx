import { useState, useMemo, useCallback } from "react";
import { SummaryCards } from "@/components/bioinformatics/SummaryCards";
import { SubtypeDistribution } from "@/components/bioinformatics/SubtypeDistribution";
import { ClusterScatter } from "@/components/bioinformatics/ClusterScatter";
import { PCAScatter } from "@/components/bioinformatics/PCAScatter";
import { PCAScreePlot } from "@/components/bioinformatics/PCAScreePlot";
import { ClusteringMetrics } from "@/components/bioinformatics/ClusteringMetrics";
import { ExpressionHeatmap } from "@/components/bioinformatics/ExpressionHeatmap";
import { MarkerGenesTable } from "@/components/bioinformatics/MarkerGenesTable";
import { CopheneticPlot } from "@/components/bioinformatics/CopheneticPlot";
import { JsonUploader, NmfData } from "@/components/bioinformatics/JsonUploader";
import { AnnotationUploader, AnnotationData } from "@/components/bioinformatics/AnnotationUploader";
import { SurvivalCurve } from "@/components/bioinformatics/SurvivalCurve";
import { 
  nmfSummary as defaultSummary, 
  sampleResults as defaultSamples, 
  markerGenes as defaultMarkerGenes, 
  generateHeatmapData,
  generateSubtypeColors,
  defaultRankMetrics,
  defaultSurvivalData,
} from "@/data/mockNmfData";
import { Dna } from "lucide-react";

const Index = () => {
  const [data, setData] = useState<NmfData>({
    summary: defaultSummary,
    samples: defaultSamples,
    markerGenes: defaultMarkerGenes,
    rankMetrics: defaultRankMetrics,
    survivalData: defaultSurvivalData,
  });

  // User-provided annotation data
  const [userAnnotations, setUserAnnotations] = useState<AnnotationData | undefined>(undefined);

  // Get sample IDs for validation
  const sampleIds = useMemo(() => data.samples.map(s => s.sample_id), [data.samples]);

  const heatmapData = useMemo(() => {
    return data.heatmapData || generateHeatmapData();
  }, [data.heatmapData]);

  // Generate colors dynamically from subtype names in data
  const subtypeColors = useMemo(() => {
    const subtypes = Object.keys(data.summary.subtype_counts);
    return generateSubtypeColors(subtypes);
  }, [data.summary.subtype_counts]);

  const handleAnnotationLoaded = useCallback((annotation: AnnotationData) => {
    setUserAnnotations(annotation);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Dna className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">NMF Subtyping Dashboard</h1>
              <p className="text-sm text-muted-foreground">{data.summary.dataset} Molecular Subtypes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <JsonUploader onDataLoaded={setData} />
            <AnnotationUploader 
              onAnnotationLoaded={handleAnnotationLoaded} 
              sampleIds={sampleIds}
            />
          </div>
          <div className="lg:col-span-3">
            <SummaryCards summary={data.summary} />
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SubtypeDistribution subtypeCounts={data.summary.subtype_counts} subtypeColors={subtypeColors} />
          <ClusterScatter 
            samples={data.samples} 
            subtypeColors={subtypeColors} 
            userAnnotations={userAnnotations}
          />
          <div className="space-y-4">
            <PCAScatter 
              samples={data.samples} 
              subtypeColors={subtypeColors} 
              userAnnotations={userAnnotations}
              heatmapData={heatmapData}
            />
            <PCAScreePlot heatmapData={heatmapData} samples={data.samples} />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ExpressionHeatmap 
              data={heatmapData} 
              subtypeColors={subtypeColors} 
              userAnnotations={userAnnotations}
            />
          </div>
          <div className="space-y-6">
            <CopheneticPlot 
              rankMetrics={data.rankMetrics} 
              optimalRank={data.summary.optimal_rank} 
            />
            <ClusteringMetrics samples={data.samples} />
          </div>
        </div>

        {/* Survival Analysis Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SurvivalCurve data={data.survivalData || []} subtypeColors={subtypeColors} />
        </div>

        {/* Marker Genes */}
        <div className="grid grid-cols-1 gap-6">
          <MarkerGenesTable genes={data.markerGenes} subtypeColors={subtypeColors} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Analysis pipeline: GEOquery → limma → NMF (Brunet algorithm)
        </div>
      </footer>
    </div>
  );
};

export default Index;
