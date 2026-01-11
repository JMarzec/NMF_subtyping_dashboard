import { useState, useMemo, useCallback, useRef } from "react";
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
import { ExportAllButton } from "@/components/bioinformatics/ExportAllButton";
import { ChartRef } from "@/lib/chartExport";
import { 
  nmfSummary as defaultSummary, 
  sampleResults as defaultSamples, 
  markerGenes as defaultMarkerGenes, 
  generateHeatmapData,
  generateSubtypeColors,
  defaultRankMetrics,
  defaultSurvivalData,
} from "@/data/mockNmfData";
import { Dna, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Global filter reset key - increment to trigger reset in all components
  const [filterResetKey, setFilterResetKey] = useState(0);

  // Chart refs for batch export
  const summaryRef = useRef<HTMLDivElement>(null);
  const subtypeDistRef = useRef<HTMLDivElement>(null);
  const clusterScatterRef = useRef<HTMLDivElement>(null);
  const pcaScatterRef = useRef<HTMLDivElement>(null);
  const pcaScreeRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const copheneticRef = useRef<HTMLDivElement>(null);
  const survivalRef = useRef<HTMLDivElement>(null);

  const handleGlobalResetFilters = useCallback(() => {
    setFilterResetKey(prev => prev + 1);
  }, []);

  const getChartRefs = useCallback((): ChartRef[] => [
    { id: 'summary', name: 'summary-cards', ref: summaryRef.current, type: 'cards' },
    { id: 'subtype', name: 'subtype-distribution', ref: subtypeDistRef.current, type: 'recharts' },
    { id: 'cluster', name: 'umap-cluster', ref: clusterScatterRef.current, type: 'recharts' },
    { id: 'pca', name: 'pca-scatter', ref: pcaScatterRef.current, type: 'recharts' },
    { id: 'scree', name: 'pca-scree', ref: pcaScreeRef.current, type: 'recharts' },
    { id: 'heatmap', name: 'expression-heatmap', ref: heatmapRef.current, type: 'heatmap', pngOptions: { paddingRight: 100, paddingBottom: 50 } },
    { id: 'cophenetic', name: 'cophenetic-plot', ref: copheneticRef.current, type: 'recharts' },
    { id: 'survival', name: 'survival-curve', ref: survivalRef.current, type: 'recharts' },
  ], []);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <Dna className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">NMF Subtyping Dashboard</h1>
                <p className="text-sm text-muted-foreground">Molecular Subtypes Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportAllButton getChartRefs={getChartRefs} />
              <Button variant="outline" size="sm" onClick={handleGlobalResetFilters}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset All Filters
              </Button>
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
          <div className="lg:col-span-3" ref={summaryRef}>
            <SummaryCards summary={data.summary} />
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div ref={subtypeDistRef}>
            <SubtypeDistribution subtypeCounts={data.summary.subtype_counts} subtypeColors={subtypeColors} />
          </div>
          <div ref={clusterScatterRef}>
            <ClusterScatter 
              samples={data.samples} 
              subtypeColors={subtypeColors} 
              userAnnotations={userAnnotations}
              filterResetKey={filterResetKey}
            />
          </div>
          <div className="space-y-4">
            <div ref={pcaScatterRef}>
              <PCAScatter 
                samples={data.samples} 
                subtypeColors={subtypeColors} 
                userAnnotations={userAnnotations}
                heatmapData={heatmapData}
                filterResetKey={filterResetKey}
              />
            </div>
            <div ref={pcaScreeRef}>
              <PCAScreePlot heatmapData={heatmapData} samples={data.samples} />
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2" ref={heatmapRef}>
            <ExpressionHeatmap 
              data={heatmapData} 
              subtypeColors={subtypeColors} 
              userAnnotations={userAnnotations}
              filterResetKey={filterResetKey}
            />
          </div>
          <div className="space-y-6">
            <div ref={copheneticRef}>
              <CopheneticPlot 
                rankMetrics={data.rankMetrics} 
                optimalRank={data.summary.optimal_rank} 
              />
            </div>
            <ClusteringMetrics samples={data.samples} />
          </div>
        </div>

        {/* Survival Analysis Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div ref={survivalRef}>
            <SurvivalCurve data={data.survivalData || []} subtypeColors={subtypeColors} />
          </div>
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
