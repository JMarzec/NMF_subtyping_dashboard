import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Activity, BarChart3 } from "lucide-react";
import { CrossValidationResult } from "@/lib/coxphAnalysis";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CrossValidationPanelProps {
  result: CrossValidationResult;
  selectedCovariates: string[];
}

export const CrossValidationPanel = ({ result, selectedCovariates }: CrossValidationPanelProps) => {
  if (result.concordanceScores.length === 0) {
    return null;
  }

  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Fold', 'Concordance Index'].join(separator));
    
    // Data rows
    result.concordanceScores.forEach((score, idx) => {
      lines.push([(idx + 1).toString(), score.toFixed(4)].join(separator));
    });
    
    // Summary
    lines.push('');
    lines.push(['Mean C-index:', result.meanConcordance.toFixed(4)].join(separator));
    lines.push(['Std Dev:', result.stdConcordance.toFixed(4)].join(separator));
    lines.push(['95% CI Lower:', result.ci95Lower.toFixed(4)].join(separator));
    lines.push(['95% CI Upper:', result.ci95Upper.toFixed(4)].join(separator));
    lines.push(['Number of Folds:', result.folds.toString()].join(separator));
    lines.push(['Covariates:', selectedCovariates.join('; ')].join(separator));
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-validation.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getQualityLabel = (cIndex: number) => {
    if (cIndex >= 0.8) return { label: 'Excellent', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
    if (cIndex >= 0.7) return { label: 'Good', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
    if (cIndex >= 0.6) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
    return { label: 'Poor', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
  };

  const quality = getQualityLabel(result.meanConcordance);
  const minScore = Math.min(...result.concordanceScores);
  const maxScore = Math.max(...result.concordanceScores);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base">Cross-Validation</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="bg-violet-600 hover:bg-violet-700 cursor-help">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {result.folds}-fold CV
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Out-of-sample concordance index estimation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className={`cursor-help ${quality.bg} ${quality.color}`}
                >
                  <Activity className="h-3 w-3 mr-1" />
                  {quality.label}: {result.meanConcordance.toFixed(3)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mean out-of-sample concordance index</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData('tsv')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            TSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary Statistics */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Summary Statistics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground">Mean C-index</div>
                <div className={`text-lg font-bold ${quality.color}`}>
                  {result.meanConcordance.toFixed(3)}
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground">Std Deviation</div>
                <div className="text-lg font-bold text-foreground">
                  ±{result.stdConcordance.toFixed(3)}
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-md col-span-2">
                <div className="text-xs text-muted-foreground">Approximate 95% fold interval</div>
                <div className="text-lg font-bold text-foreground">
                  {result.ci95Lower.toFixed(3)} – {result.ci95Upper.toFixed(3)}
                </div>
              </div>
            </div>
          </div>

          {/* Fold-by-Fold Results */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Fold-by-Fold Results</h4>
            <div className="space-y-2">
              {result.concordanceScores.map((score, idx) => {
                const isMin = score === minScore;
                const isMax = score === maxScore;
                const barWidth = ((score - 0.4) / 0.6) * 100; // Scale from 0.4-1.0
                const foldQuality = getQualityLabel(score);
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12">Fold {idx + 1}</span>
                    <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full ${foldQuality.bg.replace('bg-', 'bg-')}`}
                        style={{ 
                          width: `${Math.max(0, Math.min(100, barWidth))}%`,
                          backgroundColor: score >= 0.7 
                            ? 'hsl(var(--success, 142 76% 36%))' 
                            : score >= 0.6 
                              ? 'hsl(var(--warning, 48 96% 53%))' 
                              : 'hsl(var(--destructive, 0 84% 60%))'
                        }}
                      />
                      {/* Mean line indicator */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
                        style={{ left: `${((result.meanConcordance - 0.4) / 0.6) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-14 text-right ${foldQuality.color}`}>
                      {score.toFixed(3)}
                      {isMin && <span className="text-red-500 ml-1">↓</span>}
                      {isMax && <span className="text-green-500 ml-1">↑</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Min: {minScore.toFixed(3)}</span>
              <span className="border-l border-foreground/50 h-3 mx-2" />
              <span>Mean</span>
              <span className="flex-1" />
              <span>Max: {maxScore.toFixed(3)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <div className="text-xs text-muted-foreground mb-1">Model Covariates ({selectedCovariates.length})</div>
          <div className="flex flex-wrap gap-1">
            {selectedCovariates.map(cov => (
              <Badge key={cov} variant="secondary" className="text-xs">
                {cov}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Cross-validation estimates out-of-sample concordance to assess model generalizability and detect overfitting.
        </div>
      </CardContent>
    </Card>
  );
};