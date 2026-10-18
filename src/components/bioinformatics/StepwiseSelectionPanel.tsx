import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Plus, Minus, Check, X, Zap, Activity } from "lucide-react";
import { StepwiseSelectionResult } from "@/lib/coxphAnalysis";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StepwiseSelectionPanelProps {
  result: StepwiseSelectionResult;
  onApplyFinal?: (covariates: string[]) => void;
}

export const StepwiseSelectionPanel = ({ result, onApplyFinal }: StepwiseSelectionPanelProps) => {
  if (result.steps.length === 0) {
    return null;
  }

  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push([
      'Step',
      'Action',
      'Covariate',
      'P-value',
      'Selected Covariates',
      'Model AIC',
      'Concordance'
    ].join(separator));
    
    // Data rows
    result.steps.forEach(step => {
      lines.push([
        step.step.toString(),
        step.action.toUpperCase(),
        step.covariate,
        step.pValue.toExponential(4),
        step.selectedCovariates.join('; '),
        step.modelAIC.toFixed(2),
        step.concordance?.toFixed(3) || 'N/A'
      ].join(separator));
    });
    
    // Summary
    lines.push('');
    lines.push(['Final selected covariates:', result.finalCovariates.join('; ')].join(separator));
    lines.push(['Total added:', result.addedCovariates.length.toString()].join(separator));
    lines.push(['Total removed:', result.removedCovariates.length.toString()].join(separator));
    lines.push(['Significance threshold:', result.threshold.toString()].join(separator));
    if (result.finalConcordance) {
      lines.push(['Final C-index:', result.finalConcordance.toFixed(3)].join(separator));
    }
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stepwise-selection.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addSteps = result.steps.filter(s => s.action === 'add').length;
  const removeSteps = result.steps.filter(s => s.action === 'remove').length;

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base">Stepwise Selection</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 cursor-help">
                  {result.finalCovariates.length} final
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Combined forward selection (p &lt; {result.threshold}) and backward elimination</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
            <Plus className="h-3 w-3 mr-1" />
            {addSteps} added
          </Badge>
          {removeSteps > 0 && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-600">
              <Minus className="h-3 w-3 mr-1" />
              {removeSteps} removed
            </Badge>
          )}
          {result.finalConcordance !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs cursor-help ${
                      result.finalConcordance >= 0.7 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : result.finalConcordance >= 0.6 
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : ''
                    }`}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    C-index: {result.finalConcordance.toFixed(3)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {result.finalConcordance >= 0.7 
                      ? 'Good discriminative ability' 
                      : result.finalConcordance >= 0.6 
                        ? 'Moderate discriminative ability'
                        : 'Poor discriminative ability'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
              <TableHead className="text-right">Selected</TableHead>
              <TableHead className="text-right">AIC</TableHead>
              <TableHead className="text-right">C-index</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.steps.map((step, index) => {
              const isAdd = step.action === 'add';
              const isFinal = index === result.steps.length - 1;
              
              return (
                <TableRow 
                  key={step.step} 
                  className={isFinal ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
                >
                  <TableCell className="font-mono text-sm">
                    {step.step}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isAdd ? (
                        <Plus className="h-4 w-4 text-green-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`font-medium ${isAdd ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {isAdd ? 'Add' : 'Remove'}
                      </span>
                      <span className="font-medium">{step.covariate}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant="secondary"
                      className={`text-xs ${
                        isAdd 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {formatPValue(step.pValue)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {step.selectedCovariates.length}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {step.modelAIC.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    {step.concordance !== undefined ? (
                      <span className={`font-mono text-sm ${
                        step.concordance >= 0.7 
                          ? 'text-green-600 dark:text-green-400' 
                          : step.concordance >= 0.6 
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-muted-foreground'
                      }`}>
                        {step.concordance.toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {/* Summary section */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
              <Check className="h-4 w-4" />
              Final Model ({result.finalCovariates.length} covariates)
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.finalCovariates.length > 0 ? (
                result.finalCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/50">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No covariates selected</span>
              )}
            </div>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <X className="h-4 w-4" />
              Removed During Selection ({result.removedCovariates.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.removedCovariates.length > 0 ? (
                result.removedCovariates.map(cov => (
                  <Badge key={cov} variant="secondary" className="text-xs opacity-70 line-through">
                    {cov}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No covariates removed</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Stepwise selection alternates between adding (p &lt; {result.threshold}) and removing (p &gt; {(result.removalThreshold ?? 0.10).toFixed(2)}) covariates.
        </div>
      </CardContent>
    </Card>
  );
};