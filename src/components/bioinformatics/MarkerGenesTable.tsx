import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkerGene } from "@/data/mockNmfData";
import { useState } from "react";

interface MarkerGenesTableProps {
  genes: MarkerGene[];
  subtypeColors: Record<string, string>;
}

export const MarkerGenesTable = ({ genes, subtypeColors }: MarkerGenesTableProps) => {
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  
  const subtypes = [...new Set(genes.map(g => g.subtype))].sort();
  const filteredGenes = selectedSubtype 
    ? genes.filter(g => g.subtype === selectedSubtype)
    : genes;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader>
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
