import { useState, useMemo, useCallback, useRef } from "react";
import { SummaryCards } from "@/components/bioinformatics/SummaryCards";
import { ClusterScatter } from "@/components/bioinformatics/ClusterScatter";
import { PCAScatter } from "@/components/bioinformatics/PCAScatter";
import { PCAScreePlot } from "@/components/bioinformatics/PCAScreePlot";
import { ClusteringMetrics } from "@/components/bioinformatics/ClusteringMetrics";
import { ExpressionHeatmap, ExpressionHeatmapRef } from "@/components/bioinformatics/ExpressionHeatmap";
import { MarkerGenesTable } from "@/components/bioinformatics/MarkerGenesTable";
import { NmfOverviewPanel } from "@/components/bioinformatics/NmfOverviewPanel";
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
import { RotateCcw, RefreshCw, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import AccelBioLogo from "@/assets/AccelBio_logo.png";

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

  // Marker genes per subtype setting
  const [markerGenesPerSubtype, setMarkerGenesPerSubtype] = useState(25);

  // Chart refs for batch export
  const summaryRef = useRef<HTMLDivElement>(null);
  const nmfOverviewRef = useRef<HTMLDivElement>(null);
  const clusterScatterRef = useRef<HTMLDivElement>(null);
  const pcaScatterRef = useRef<HTMLDivElement>(null);
  const pcaScreeRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const heatmapComponentRef = useRef<ExpressionHeatmapRef>(null);
  const survivalRef = useRef<HTMLDivElement>(null);

  const handleGlobalResetFilters = useCallback(() => {
    setFilterResetKey(prev => prev + 1);
  }, []);

  const handleResetAll = useCallback(() => {
    // Reset to default data
    setData({
      summary: defaultSummary,
      samples: defaultSamples,
      markerGenes: defaultMarkerGenes,
      rankMetrics: defaultRankMetrics,
      survivalData: defaultSurvivalData,
    });
    // Clear annotations
    setUserAnnotations(undefined);
    // Reset filters
    setFilterResetKey(prev => prev + 1);
    // Reset marker genes per subtype
    setMarkerGenesPerSubtype(25);
  }, []);

  const getChartRefs = useCallback((): ChartRef[] => [
    { id: 'summary', name: 'summary-cards', ref: summaryRef.current, type: 'cards' },
    { id: 'nmf-overview', name: 'nmf-overview', ref: nmfOverviewRef.current, type: 'recharts' },
    { id: 'cluster', name: 'umap-cluster', ref: clusterScatterRef.current, type: 'recharts' },
    { id: 'pca', name: 'pca-scatter', ref: pcaScatterRef.current, type: 'recharts' },
    { id: 'scree', name: 'pca-scree', ref: pcaScreeRef.current, type: 'recharts' },
    { 
      id: 'heatmap', 
      name: 'expression-heatmap', 
      ref: heatmapRef.current, 
      type: 'heatmap', 
      pngOptions: { paddingRight: 100, paddingBottom: 140 },
      getSVGString: () => heatmapComponentRef.current?.getSVGString() || null
    },
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

  // Calculate total marker genes
  const totalMarkerGenes = useMemo(() => {
    return markerGenesPerSubtype * data.summary.n_subtypes;
  }, [markerGenesPerSubtype, data.summary.n_subtypes]);

  // Create sample to subtype mapping for survival analysis
  const sampleSubtypes = useMemo(() => {
    const map: Record<string, string> = {};
    data.samples.forEach(s => { map[s.sample_id] = s.subtype; });
    return map;
  }, [data.samples]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={AccelBioLogo} alt="Co-Lab AccelBio" className="h-12 w-auto" />
              <div>
                <h1 className="text-xl font-bold">NMF Subtyping Dashboard</h1>
                <p className="text-sm text-muted-foreground">Molecular Subtypes Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Marker genes per subtype selector */}
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <Label htmlFor="header-genes-per-subtype" className="text-xs text-muted-foreground whitespace-nowrap">
                  Marker genes/subtype:
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMarkerGenesPerSubtype(Math.max(markerGenesPerSubtype - 5, 5))}
                    disabled={markerGenesPerSubtype <= 5}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    id="header-genes-per-subtype"
                    type="number"
                    min={5}
                    max={100}
                    value={markerGenesPerSubtype}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        setMarkerGenesPerSubtype(Math.min(Math.max(value, 5), 100));
                      }
                    }}
                    className="h-7 w-14 text-center text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMarkerGenesPerSubtype(Math.min(markerGenesPerSubtype + 5, 100))}
                    disabled={markerGenesPerSubtype >= 100}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <ThemeToggle />
              <ExportAllButton getChartRefs={getChartRefs} />
              <Button variant="outline" size="sm" onClick={handleGlobalResetFilters}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset Filters
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetAll}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reset All
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <JsonUploader onDataLoaded={setData} />
          <AnnotationUploader 
            onAnnotationLoaded={handleAnnotationLoaded} 
            sampleIds={sampleIds}
          />
        </div>

        {/* Summary Cards - Full Width */}
        <div ref={summaryRef}>
          <SummaryCards 
            summary={data.summary} 
            markerGenesPerSubtype={markerGenesPerSubtype}
            totalMarkerGenes={totalMarkerGenes}
          />
        </div>

        {/* NMF Overview Panel (Rank Selection + Subtype Distribution) */}
        <div ref={nmfOverviewRef}>
          <NmfOverviewPanel 
            rankMetrics={data.rankMetrics}
            optimalRank={data.summary.optimal_rank}
            subtypeCounts={data.summary.subtype_counts}
            subtypeColors={subtypeColors}
          />
        </div>

        {/* Clustering Metrics - Below NMF Overview */}
        <ClusteringMetrics samples={data.samples} />

        {/* UMAP Cluster - Full Width */}
        <div ref={clusterScatterRef}>
          <ClusterScatter 
            samples={data.samples} 
            subtypeColors={subtypeColors} 
            userAnnotations={userAnnotations}
            filterResetKey={filterResetKey}
          />
        </div>

        {/* PCA Scatter - Full Width */}
        <div ref={pcaScatterRef}>
          <PCAScatter 
            samples={data.samples} 
            subtypeColors={subtypeColors} 
            userAnnotations={userAnnotations}
            heatmapData={heatmapData}
            filterResetKey={filterResetKey}
          />
        </div>

        {/* PCA Scree Plot - Full Width */}
        <div ref={pcaScreeRef}>
          <PCAScreePlot heatmapData={heatmapData} samples={data.samples} />
        </div>

        {/* Expression Heatmap - Full Width */}
        <div ref={heatmapRef}>
          <ExpressionHeatmap 
            ref={heatmapComponentRef}
            data={heatmapData} 
            subtypeColors={subtypeColors} 
            userAnnotations={userAnnotations}
            filterResetKey={filterResetKey}
            markerGenesPerSubtype={markerGenesPerSubtype}
            markerGenes={data.markerGenes}
          />
        </div>

        {/* Marker Genes - Full Width (now below heatmap) */}
        <MarkerGenesTable 
          genes={data.markerGenes} 
          subtypeColors={subtypeColors}
          genesPerSubtype={markerGenesPerSubtype}
        />


        {/* Survival Curve - Full Width */}
        <div ref={survivalRef}>
          <SurvivalCurve 
            data={data.survivalData || []} 
            subtypeColors={subtypeColors}
            subtypeCounts={data.summary.subtype_counts}
            survivalPValue={data.survival_pvalue}
            coxPHResults={data.coxPHResults}
            userAnnotations={userAnnotations}
            sampleSubtypes={sampleSubtypes}
          />
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
