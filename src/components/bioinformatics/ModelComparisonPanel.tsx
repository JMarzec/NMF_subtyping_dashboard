import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ModelComparisonResult } from "@/lib/coxphAnalysis";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModelComparisonPanelProps {
  comparisons: ModelComparisonResult[];
}

export const ModelComparisonPanel = ({ comparisons }: ModelComparisonPanelProps) => {
  if (comparisons.length === 0) {
    return null;
  }

  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    lines.push([
      'Step',
      'Added Covariate(s)',
      'Model Covariates',
      'LRT Chi-sq',
      'LRT df',
      'LRT P-value',
      'Significant',
      'Null AIC',
      'Full AIC',
      'AIC Improvement'
    ].join(separator));
    
    comparisons.forEach((comp, i) => {
      const aicImprovement = comp.nullModel.aic - comp.fullModel.aic;
      lines.push([
        (i + 1).toString(),
        comp.addedCovariates.join('; '),
        comp.fullModel.covariates.join('; '),
        comp.likelihoodRatioTest.chiSquare.toFixed(4),
        comp.likelihoodRatioTest.df.toString(),
        comp.likelihoodRatioTest.pValue.toExponential(4),
        comp.significantImprovement ? 'Yes' : 'No',
        comp.nullModel.aic.toFixed(2),
        comp.fullModel.aic.toFixed(2),
        aicImprovement.toFixed(2)
      ].join(separator));
    });
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-comparison.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { significantSteps, bestModel } = (() => {
    const significant = comparisons.filter(c => c.significantImprovement).length;
    
    let minAIC = Infinity;
    let bestIdx = -1;
    comparisons.forEach((comp, i) => {
      if (comp.fullModel.aic < minAIC) {
        minAIC = comp.fullModel.aic;
        bestIdx = i;
      }
    });
    
    return {
      significantSteps: significant,
      bestModel: bestIdx >= 0 ? comparisons[bestIdx] : null
    };
  })();

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base">Nested Model Comparison</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  <GitCompare className="h-3 w-3 mr-1" />
                  {comparisons.length} comparisons
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Likelihood ratio tests comparing sequential nested models</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge 
            variant={significantSteps > 0 ? "default" : "secondary"}
            className={significantSteps > 0 ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {significantSteps}/{comparisons.length} significant
          </Badge>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Step</TableHead>
              <TableHead>Added Covariate</TableHead>
              <TableHead className="text-right">LRT χ²</TableHead>
              <TableHead className="text-right">df</TableHead>
              <TableHead className="text-right">P-value</TableHead>
              <TableHead className="text-center">Sig.</TableHead>
              <TableHead className="text-right">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                      ΔAIC
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AIC improvement (positive = better fit)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comp, index) => {
              const aicImprovement = comp.nullModel.aic - comp.fullModel.aic;
              const aicBetter = aicImprovement > 2;
              const aicWorse = aicImprovement < -2;
              
              return (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{comp.addedCovariates.join(', ')}</span>
                      {comp.fullModel.aic === (bestModel?.fullModel.aic ?? Infinity) && (
                        <Badge variant="outline" className="text-xs bg-primary/10">
                          Best
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {comp.likelihoodRatioTest.chiSquare.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {comp.likelihoodRatioTest.df}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatPValue(comp.likelihoodRatioTest.pValue)}
                  </TableCell>
                  <TableCell className="text-center">
                    {comp.significantImprovement ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {aicBetter && <TrendingDown className="h-4 w-4 text-green-600" />}
                      {aicWorse && <TrendingUp className="h-4 w-4 text-red-600" />}
                      {!aicBetter && !aicWorse && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className={`font-mono text-sm ${
                        aicBetter ? 'text-green-600' : 
                        aicWorse ? 'text-red-600' : 
                        'text-muted-foreground'
                      }`}>
                        {aicImprovement > 0 ? '+' : ''}{aicImprovement.toFixed(1)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        <div className="mt-4 p-3 bg-muted/30 rounded-md">
          <h4 className="text-sm font-medium mb-2">Interpretation</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Likelihood Ratio Test (LRT)</p>
              <p>Tests if adding covariates significantly improves model fit. P &lt; 0.05 indicates the larger model is significantly better.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Akaike Information Criterion (AIC)</p>
              <p>Lower AIC = better model. ΔAIC &gt; 2 is meaningful improvement; ΔAIC &lt; -2 suggests overfitting.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};