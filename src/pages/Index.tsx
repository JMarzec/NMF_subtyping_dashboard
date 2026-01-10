import { useState, useMemo, useCallback } from "react";
import { SummaryCards } from "@/components/bioinformatics/SummaryCards";
import { SubtypeDistribution } from "@/components/bioinformatics/SubtypeDistribution";
import { ClusterScatter } from "@/components/bioinformatics/ClusterScatter";
import { ExpressionHeatmap } from "@/components/bioinformatics/ExpressionHeatmap";
import { MarkerGenesTable } from "@/components/bioinformatics/MarkerGenesTable";
import { CopheneticPlot } from "@/components/bioinformatics/CopheneticPlot";
import { JsonUploader, NmfData } from "@/components/bioinformatics/JsonUploader";
import { MatrixUploader, MatrixData, AnnotationData } from "@/components/bioinformatics/MatrixUploader";
import { SurvivalCurve } from "@/components/bioinformatics/SurvivalCurve";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  nmfSummary as defaultSummary, 
  sampleResults as defaultSamples, 
  markerGenes as defaultMarkerGenes, 
  generateHeatmapData,
  generateSubtypeColors,
  defaultRankMetrics,
  defaultSurvivalData,
} from "@/data/mockNmfData";
import { Dna, FileJson, FileSpreadsheet } from "lucide-react";

const Index = () => {
  const [data, setData] = useState<NmfData>({
    summary: defaultSummary,
    samples: defaultSamples,
    markerGenes: defaultMarkerGenes,
    rankMetrics: defaultRankMetrics,
    survivalData: defaultSurvivalData,
  });

  // User-provided annotation data from matrix upload
  const [userAnnotations, setUserAnnotations] = useState<AnnotationData | undefined>(undefined);
  
  // Custom matrix data (if uploaded)
  const [customMatrix, setCustomMatrix] = useState<MatrixData | null>(null);

  const heatmapData = useMemo(() => {
    // If custom matrix is uploaded, use it for heatmap
    if (customMatrix) {
      // Get sample subtypes from NMF data or annotation data
      const sampleSubtypes = customMatrix.samples.map(sampleId => {
        const nmfSample = data.samples.find(s => s.sample_id === sampleId);
        if (nmfSample) return nmfSample.subtype;
        // If no NMF subtype, use first annotation column or "Unknown"
        if (userAnnotations?.annotations[sampleId]) {
          const firstCol = userAnnotations.columns[0];
          return userAnnotations.annotations[sampleId][firstCol] || "Unknown";
        }
        return "Unknown";
      });

      return {
        genes: customMatrix.genes.slice(0, 50), // Limit for display
        samples: customMatrix.samples,
        sampleSubtypes,
        values: customMatrix.values.slice(0, 50),
      };
    }
    return data.heatmapData || generateHeatmapData();
  }, [data.heatmapData, data.samples, customMatrix, userAnnotations]);

  // Generate colors dynamically from subtype names in data
  const subtypeColors = useMemo(() => {
    const subtypes = Object.keys(data.summary.subtype_counts);
    return generateSubtypeColors(subtypes);
  }, [data.summary.subtype_counts]);

  const handleMatrixLoaded = useCallback((matrix: MatrixData, annotation?: AnnotationData) => {
    setCustomMatrix(matrix);
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
          <div className="lg:col-span-1">
            <Tabs defaultValue="nmf" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="nmf" className="text-xs">
                  <FileJson className="h-3 w-3 mr-1" />
                  NMF JSON
                </TabsTrigger>
                <TabsTrigger value="matrix" className="text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  Matrix
                </TabsTrigger>
              </TabsList>
              <TabsContent value="nmf" className="mt-2">
                <JsonUploader onDataLoaded={setData} />
              </TabsContent>
              <TabsContent value="matrix" className="mt-2">
                <MatrixUploader onMatrixLoaded={handleMatrixLoaded} />
              </TabsContent>
            </Tabs>
          </div>
          <div className="lg:col-span-3">
            <SummaryCards summary={data.summary} />
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SubtypeDistribution subtypeCounts={data.summary.subtype_counts} subtypeColors={subtypeColors} />
          <ClusterScatter 
            samples={data.samples} 
            subtypeColors={subtypeColors} 
            userAnnotations={userAnnotations}
          />
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
          <CopheneticPlot 
            rankMetrics={data.rankMetrics} 
            optimalRank={data.summary.optimal_rank} 
          />
        </div>

        {/* Survival Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SurvivalCurve data={data.survivalData || []} subtypeColors={subtypeColors} />
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
