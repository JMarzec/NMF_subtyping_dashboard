import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, ArrowRight, Check, X, Plus, Zap } from "lucide-react";
import { ForwardSelectionResult } from "@/lib/coxphAnalysis";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ForwardSelectionPanelProps {
  result: ForwardSelectionResult;
  onApplyFinal?: (covariates: string[]) => void;
}

export const ForwardSelectionPanel = ({ result, onApplyFinal }: ForwardSelectionPanelProps) => {
  if (result.steps.length === 0) {
    return null;
  }

  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push([
      'Step',
      'Added Covariate',
      'P-value',
      'LRT P-value',
      'Selected Covariates',
      'Model AIC',
      'AIC Change',
      'Wald P-value'
    ].join(separator));
    
    // Data rows
    result.steps.forEach(step => {
      lines.push([
        step.step.toString(),
        step.addedCovariate || 'Null model',
        step.addedPValue !== null ? step.addedPValue.toExponential(4) : 'N/A',
        step.lrtPValue !== undefined ? step.lrtPValue.toExponential(4) : 'N/A',
        step.selectedCovariates.join('; '),
        step.modelAIC.toFixed(2),
        step.aicChange !== undefined ? step.aicChange.toFixed(2) : 'N/A',
        step.waldPValue.toExponential(4)
      ].join(separator));
    });
    
    // Summary
    lines.push('');
    lines.push(['Final selected covariates:', result.finalCovariates.join('; ')].join(separator));
    lines.push(['Rejected covariates:', result.rejectedCovariates.join('; ')].join(separator));
    lines.push(['Significance threshold:', result.threshold.toString()].join(separator));
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forward-selection.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const finalStep = result.steps[result.steps.length - 1];
  const totalAICImprovement = result.steps
    .filter(s => s.aicChange !== undefined)
    .reduce((sum, s) => sum + (s.aicChange || 0), 0);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base">Forward Selection</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 cursor-help">
                  <Plus className="h-3 w-3 mr-1" />
                  {result.finalCovariates.length} selected
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Covariates with p &lt; {result.threshold} added iteratively</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {result.rejectedCovariates.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <X className="h-3 w-3 mr-1" />
              {result.rejectedCovariates.length} rejected
            </Badge>
          )}
          {totalAICImprovement > 0 && (
            <Badge variant="secondary" className="text-xs">
              Total AIC improvement: {totalAICImprovement.toFixed(1)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {onApplyFinal && result.finalCovariates.length > 0 && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => onApplyFinal(result.finalCovariates)}
              className="bg-primary"
            >
              <Zap className="h-4 w-4 mr-1" />
              Apply Selected Model
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
              <TableHead className="text-right">LRT P</TableHead>
              <TableHead className="text-right">Selected</TableHead>
              <TableHead className="text-right">AIC</TableHead>
              <TableHead className="text-right">Wald P</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.steps.map((step, index) => {
              const isInitial = step.step === 0;
              const isFinal = index === result.steps.length - 1 && result.finalCovariates.length > 0;
              
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
                      <span className="text-muted-foreground text-sm">Null model (no covariates)</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{step.addedCovariate}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {step.selectedCovariates.length} total
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {step.addedPValue !== null ? (
                      <Badge 
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      >
                        {formatPValue(step.addedPValue)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {step.lrtPValue !== undefined ? (
                      <Badge 
                        variant={step.lrtPValue < 0.05 ? "default" : "secondary"}
                        className={`text-xs ${step.lrtPValue < 0.05 ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      >
                        {formatPValue(step.lrtPValue)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {step.selectedCovariates.length}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-mono text-sm">{step.modelAIC.toFixed(1)}</span>
                      {step.aicChange !== undefined && step.aicChange !== 0 && (
                        <span className={`text-xs ${step.aicChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({step.aicChange > 0 ? '+' : ''}{step.aicChange.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isInitial && (
                      <Badge 
                        variant={step.waldPValue < 0.05 ? "default" : "secondary"}
                        className={`text-xs ${step.waldPValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                      >
                        {formatPValue(step.waldPValue)}
                      </Badge>
                    )}
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
              Selected Model ({result.finalCovariates.length} covariates)
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.finalCovariates.length > 0 ? (
                result.finalCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/50">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No significant covariates found</span>
              )}
            </div>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <X className="h-4 w-4" />
              Not Selected ({result.rejectedCovariates.length} covariates)
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.rejectedCovariates.length > 0 ? (
                result.rejectedCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs opacity-70">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">All candidates were selected</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Covariates are added one at a time if they significantly improve model fit (p &lt; {result.threshold}).
        </div>
      </CardContent>
    </Card>
  );
};