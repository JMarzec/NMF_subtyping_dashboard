import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, ArrowRight, Check, X, Trash2, Zap } from "lucide-react";
import { BackwardEliminationResult } from "@/lib/coxphAnalysis";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BackwardEliminationPanelProps {
  result: BackwardEliminationResult;
  onApplyFinal?: (covariates: string[]) => void;
}

export const BackwardEliminationPanel = ({ result, onApplyFinal }: BackwardEliminationPanelProps) => {
  if (result.steps.length === 0) {
    return null;
  }

  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push([
      'Step',
      'Removed Covariate',
      'Removed P-value',
      'Remaining Covariates',
      'Model AIC',
      'Wald P-value'
    ].join(separator));
    
    // Data rows
    result.steps.forEach(step => {
      lines.push([
        step.step.toString(),
        step.removedCovariate || 'Initial model',
        step.removedPValue !== null ? step.removedPValue.toExponential(4) : 'N/A',
        step.remainingCovariates.join('; '),
        step.modelAIC.toFixed(2),
        step.waldPValue.toExponential(4)
      ].join(separator));
    });
    
    // Summary
    lines.push('');
    lines.push(['Final significant covariates:', result.significantCovariates.join('; ')].join(separator));
    lines.push(['Removed covariates:', result.removedCovariates.join('; ')].join(separator));
    lines.push(['Significance threshold:', result.threshold.toString()].join(separator));
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backward-elimination.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const initialStep = result.steps[0];
  const finalStep = result.steps[result.steps.length - 1];
  const aicImprovement = initialStep.modelAIC - finalStep.modelAIC;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base">Backward Elimination</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  <Trash2 className="h-3 w-3 mr-1" />
                  {result.removedCovariates.length} removed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Covariates with p &gt; {result.threshold} removed iteratively</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge 
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="h-3 w-3 mr-1" />
            {result.finalCovariates.length} retained
          </Badge>
          {aicImprovement > 0 && (
            <Badge variant="secondary" className="text-xs">
              AIC improved by {aicImprovement.toFixed(1)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {onApplyFinal && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => onApplyFinal(result.finalCovariates)}
              className="bg-primary"
            >
              <Zap className="h-4 w-4 mr-1" />
              Apply Final Model
            </Button>
          )}
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
              <TableHead>Action</TableHead>
              <TableHead className="text-right">P-value</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">AIC</TableHead>
              <TableHead className="text-right">Wald P</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.steps.map((step, index) => {
              const isInitial = step.step === 0;
              const isFinal = index === result.steps.length - 1;
              const prevAIC = index > 0 ? result.steps[index - 1].modelAIC : step.modelAIC;
              const aicChange = prevAIC - step.modelAIC;
              
              return (
                <TableRow key={step.step} className={isFinal ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                  <TableCell className="font-mono text-sm">
                    {isInitial ? (
                      <Badge variant="outline" className="text-xs">Start</Badge>
                    ) : (
                      step.step
                    )}
                  </TableCell>
                  <TableCell>
                    {isInitial ? (
                      <span className="text-muted-foreground text-sm">Initial model with {step.remainingCovariates.length} covariates</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{step.removedCovariate}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {step.remainingCovariates.length} left
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {step.removedPValue !== null ? (
                      <Badge 
                        variant="secondary"
                        className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      >
                        {formatPValue(step.removedPValue)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {step.remainingCovariates.length}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-mono text-sm">{step.modelAIC.toFixed(1)}</span>
                      {!isInitial && aicChange !== 0 && (
                        <span className={`text-xs ${aicChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({aicChange > 0 ? '+' : ''}{aicChange.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={step.waldPValue < 0.05 ? "default" : "secondary"}
                      className={`text-xs ${step.waldPValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {formatPValue(step.waldPValue)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {/* Summary section */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
            <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-1">
              <Check className="h-4 w-4" />
              Final Model ({result.finalCovariates.length} covariates)
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.finalCovariates.length > 0 ? (
                result.finalCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/50">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No significant covariates</span>
              )}
            </div>
          </div>
          
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-1">
              <X className="h-4 w-4" />
              Removed ({result.removedCovariates.length} covariates)
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.removedCovariates.length > 0 ? (
                result.removedCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs bg-red-100 dark:bg-red-900/50 line-through opacity-70">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">All covariates retained</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Covariates with p-value &gt; {result.threshold} are removed iteratively until all remaining are significant.
        </div>
      </CardContent>
    </Card>
  );
};