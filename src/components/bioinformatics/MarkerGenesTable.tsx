import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkerGene } from "@/data/mockNmfData";
import { useState } from "react";

interface MarkerGenesTableProps {
  genes: MarkerGene[];
}

const SUBTYPE_COLORS: Record<string, string> = {
  "Subtype_1": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Subtype_2": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Subtype_3": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Subtype_4": "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const SUBTYPE_LABELS: Record<string, string> = {
  "Subtype_1": "Proliferative",
  "Subtype_2": "Epithelial",
  "Subtype_3": "Mesenchymal",
  "Subtype_4": "Immune",
};

export const MarkerGenesTable = ({ genes }: MarkerGenesTableProps) => {
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  
  const subtypes = [...new Set(genes.map(g => g.subtype))];
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
                  ? SUBTYPE_COLORS[subtype] 
                  : "hover:bg-muted"
              }`}
              onClick={() => setSelectedSubtype(subtype)}
            >
              {SUBTYPE_LABELS[subtype]}
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
                    <Badge variant="outline" className={SUBTYPE_COLORS[gene.subtype]}>
                      {SUBTYPE_LABELS[gene.subtype]}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                          style={{ width: `${gene.weight * 100}%` }}
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
