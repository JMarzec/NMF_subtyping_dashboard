import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NmfSummary } from "@/data/mockNmfData";
import { Database, Dna, Users, TrendingUp } from "lucide-react";

interface SummaryCardsProps {
  summary: NmfSummary;
}

export const SummaryCards = ({ summary }: SummaryCardsProps) => {
  const cards = [
    {
      title: "Dataset",
      value: summary.dataset,
      subtitle: "GEO Accession",
      icon: Database,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "Samples",
      value: summary.n_samples.toLocaleString(),
      subtitle: "Total analyzed",
      icon: Users,
      gradient: "from-violet-500 to-purple-500",
    },
    {
      title: "Genes",
      value: summary.n_genes.toLocaleString(),
      subtitle: "Filtered features",
      icon: Dna,
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      title: "Subtypes",
      value: summary.n_subtypes,
      subtitle: `Cophenetic: ${summary.cophenetic_correlation.toFixed(3)}`,
      icon: TrendingUp,
      gradient: "from-orange-500 to-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden border-0 bg-card/50 backdrop-blur-sm">
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-5`} />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient}`}>
              <card.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
