import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";
import { exportAllAsZip, ChartRef, ExportProgress } from "@/lib/chartExport";
import { Progress } from "@/components/ui/progress";

interface ExportAllButtonProps {
  getChartRefs: () => ChartRef[];
}

export const ExportAllButton = ({ getChartRefs }: ExportAllButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const handleProgress = useCallback((p: ExportProgress) => {
    setProgress(p);
  }, []);

  const handleExportPNG = useCallback(async () => {
    setIsExporting(true);
    setProgress(null);
    try {
      const charts = getChartRefs();
      await exportAllAsZip(charts, 'png', 'nmf-visualizations', handleProgress);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  }, [getChartRefs, handleProgress]);

  const handleExportSVG = useCallback(async () => {
    setIsExporting(true);
    setProgress(null);
    try {
      const charts = getChartRefs();
      await exportAllAsZip(charts, 'svg', 'nmf-visualizations', handleProgress);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  }, [getChartRefs, handleProgress]);

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      {isExporting && progress && (
        <div className="flex items-center gap-2 min-w-[200px]">
          <Progress value={progressPercent} className="h-2 w-24" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {progress.current}/{progress.total}: {progress.currentChart.replace(/-/g, ' ')}
          </span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export All
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={handleExportPNG}>
            Export as PNG (ZIP)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportSVG}>
            Export as SVG (ZIP)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
