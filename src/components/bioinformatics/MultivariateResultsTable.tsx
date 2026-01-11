import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Calculator } from "lucide-react";
import { MultivariateCoxPHResult, formatHR } from "@/lib/coxphAnalysis";
import { formatPValue } from "@/lib/logRankTest";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MultivariateResultsTableProps {
  result: MultivariateCoxPHResult;
}

export const MultivariateResultsTable = ({ result }: MultivariateResultsTableProps) => {
  const exportData = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Covariate', 'HR', '95% CI Lower', '95% CI Upper', 'P-value', 'Coefficient', 'SE'].join(separator));
    
    // Data rows
    result.covariates.forEach(cov => {
      lines.push([
        cov.name,
        cov.hazardRatio.toFixed(4),
        cov.lowerCI.toFixed(4),
        cov.upperCI.toFixed(4),
        cov.pValue.toExponential(4),
        cov.coefficient.toFixed(4),
        cov.se.toFixed(4)
      ].join(separator));
    });
    
    // Wald test
    lines.push('');
    lines.push(['Wald Test', '', '', '', result.waldTest.pValue.toExponential(4), `Chi-sq: ${result.waldTest.chiSquare.toFixed(2)}`, `df: ${result.waldTest.df}`].join(separator));
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multivariate-cox-results.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Multivariate Cox Regression</CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  <Calculator className="h-3 w-3 mr-1" />
                  {result.covariates.length} covariates
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Independent effects estimated for each covariate</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <Badge 
            variant={result.waldTest.pValue < 0.05 ? "default" : "secondary"}
            className={result.waldTest.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Wald p={formatPValue(result.waldTest.pValue)}
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
              <TableHead>Covariate</TableHead>
              <TableHead className="text-right">HR</TableHead>
              <TableHead className="text-right">95% CI</TableHead>
              <TableHead className="text-right">P-value</TableHead>
              <TableHead className="text-center">Significance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.covariates.map((cov) => (
              <TableRow key={cov.name}>
                <TableCell className="font-medium">{cov.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {cov.hazardRatio.toFixed(3)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {cov.lowerCI.toFixed(2)}–{cov.upperCI.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatPValue(cov.pValue)}
                </TableCell>
                <TableCell className="text-center">
                  {cov.pValue < 0.001 ? (
                    <Badge className="bg-red-600 hover:bg-red-700">***</Badge>
                  ) : cov.pValue < 0.01 ? (
                    <Badge className="bg-orange-600 hover:bg-orange-700">**</Badge>
                  ) : cov.pValue < 0.05 ? (
                    <Badge className="bg-yellow-600 hover:bg-yellow-700">*</Badge>
                  ) : (
                    <Badge variant="secondary">ns</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-3 text-xs text-muted-foreground">
          *** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05, ns = not significant
        </div>
      </CardContent>
    </Card>
  );
};
