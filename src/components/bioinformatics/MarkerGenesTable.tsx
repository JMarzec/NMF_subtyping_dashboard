import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkerGene } from "@/data/mockNmfData";
import { useState } from "react";
import { Download } from "lucide-react";

interface MarkerGenesTableProps {
  genes: MarkerGene[];
  subtypeColors: Record<string, string>;
}

export const MarkerGenesTable = ({ genes, subtypeColors }: MarkerGenesTableProps) => {
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  
  const subtypes = [...new Set(genes.map(g => g.subtype))].sort();
  
  // When no filter is selected, show top genes from ALL subtypes (balanced representation)
  const filteredGenes = selectedSubtype 
    ? genes.filter(g => g.subtype === selectedSubtype)
    : (() => {
        // Get top genes from each subtype for balanced display
        const genesBySubtype = subtypes.map(subtype => 
          genes.filter(g => g.subtype === subtype).slice(0, Math.ceil(20 / subtypes.length))
        );
        // Interleave genes from different subtypes and limit to 20
        const interleaved: typeof genes = [];
        const maxPerSubtype = Math.max(...genesBySubtype.map(arr => arr.length));
        for (let i = 0; i < maxPerSubtype; i++) {
          for (const subtypeGenes of genesBySubtype) {
            if (subtypeGenes[i]) {
              interleaved.push(subtypeGenes[i]);
            }
          }
        }
        return interleaved.slice(0, 20);
      })();

  const exportToCSV = () => {
    const header = ["Gene", "Subtype", "Weight"];
    const exportGenes = selectedSubtype ? genes.filter(g => g.subtype === selectedSubtype) : genes;
    const rows = exportGenes.map(g => [g.gene, g.subtype, g.weight.toString()]);
    const csvContent = [header, ...rows].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marker_genes${selectedSubtype ? `_${selectedSubtype}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToTSV = () => {
    const header = ["Gene", "Subtype", "Weight"];
    const exportGenes = selectedSubtype ? genes.filter(g => g.subtype === selectedSubtype) : genes;
    const rows = exportGenes.map(g => [g.gene, g.subtype, g.weight.toString()]);
    const tsvContent = [header, ...rows].map(row => row.join("\t")).join("\n");
    
    const blob = new Blob([tsvContent], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marker_genes${selectedSubtype ? `_${selectedSubtype}` : ""}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Top Marker Genes</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
          <Badge
            variant="outline"
            className={`cursor-pointer transition-all ${!selectedSubtype ? "bg-primary/20 border-primary" : ""}`}
            onClick={() => setSelectedSubtype(null)}
          >
            All
          </Badge>
          {subtypes.map(subtype => (
            <Badge
              key={subtype}
              variant="outline"
              className={`cursor-pointer transition-all ${
                selectedSubtype === subtype 
                  ? "border-current" 
                  : "hover:bg-muted"
              }`}
              style={{ 
                backgroundColor: selectedSubtype === subtype ? `${subtypeColors[subtype]}33` : undefined,
                color: subtypeColors[subtype],
                borderColor: selectedSubtype === subtype ? subtypeColors[subtype] : undefined,
              }}
              onClick={() => setSelectedSubtype(subtype)}
            >
              {subtype}
            </Badge>
          ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToTSV}>
            <Download className="h-4 w-4 mr-1" />
            TSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Gene</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Subtype</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Weight</th>
              </tr>
            </thead>
            <tbody>
              {filteredGenes.slice(0, 20).map((gene, idx) => (
                <tr key={`${gene.gene}-${idx}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3">
                    <span className="font-mono text-sm font-medium">{gene.gene}</span>
                  </td>
                  <td className="py-2 px-3">
                    <Badge 
                      variant="outline" 
                      style={{ 
                        backgroundColor: `${subtypeColors[gene.subtype]}33`,
                        color: subtypeColors[gene.subtype],
                        borderColor: `${subtypeColors[gene.subtype]}50`,
                      }}
                    >
                      {gene.subtype}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${gene.weight * 100}%`,
                            backgroundColor: subtypeColors[gene.subtype],
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground font-mono w-12 text-right">
                        {gene.weight.toFixed(3)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
