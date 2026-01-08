import { SummaryCards } from "@/components/bioinformatics/SummaryCards";
import { SubtypeDistribution } from "@/components/bioinformatics/SubtypeDistribution";
import { ClusterScatter } from "@/components/bioinformatics/ClusterScatter";
import { ExpressionHeatmap } from "@/components/bioinformatics/ExpressionHeatmap";
import { MarkerGenesTable } from "@/components/bioinformatics/MarkerGenesTable";
import { CopheneticPlot } from "@/components/bioinformatics/CopheneticPlot";
import { nmfSummary, sampleResults, markerGenes, generateHeatmapData } from "@/data/mockNmfData";
import { Dna } from "lucide-react";

const Index = () => {
  const heatmapData = generateHeatmapData();

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
              <p className="text-sm text-muted-foreground">GSE62254 Gastric Cancer Molecular Subtypes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <SummaryCards summary={nmfSummary} />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SubtypeDistribution subtypeCounts={nmfSummary.subtype_counts} />
          <ClusterScatter samples={sampleResults} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ExpressionHeatmap data={heatmapData} />
          </div>
          <CopheneticPlot />
        </div>

        {/* Marker Genes */}
        <MarkerGenesTable genes={markerGenes} />
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
