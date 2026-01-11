import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileJson, Check, AlertCircle, Download, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NmfSummary, SampleResult, MarkerGene, RankMetric, SurvivalDataPoint } from "@/data/mockNmfData";

export interface NmfData {
  summary: NmfSummary;
  samples: SampleResult[];
  markerGenes: MarkerGene[];
  heatmapData?: {
    genes: string[];
    samples: string[];
    sampleSubtypes: string[];
    values: number[][];
  };
  rankMetrics?: RankMetric[];
  survivalData?: SurvivalDataPoint[];
}

// Raw JSON format (may use different field names)
interface RawNmfData {
  summary: NmfSummary;
  samples?: SampleResult[];
  sampleResults?: SampleResult[];
  markerGenes: MarkerGene[];
  heatmapData?: NmfData['heatmapData'];
  rankMetrics?: RankMetric[];
  survivalData?: SurvivalDataPoint[];
}

interface JsonUploaderProps {
  onDataLoaded: (data: NmfData) => void;
}

type UploadStatus = "idle" | "success" | "error";

export const JsonUploader = ({ onDataLoaded }: JsonUploaderProps) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const validateAndNormalize = (data: unknown): NmfData | null => {
    if (!data || typeof data !== "object") return null;
    const d = data as RawNmfData;
    
    // Check for required fields (accept both 'samples' and 'sampleResults')
    const samples = d.samples || d.sampleResults;
    if (!d.summary || !samples || !d.markerGenes) return null;
    
    // Validate summary structure
    const summary = d.summary as unknown as Record<string, unknown>;
    if (
      typeof summary.n_samples !== "number" ||
      typeof summary.n_subtypes !== "number" ||
      !summary.subtype_counts
    ) {
      return null;
    }
    
    // Validate samples array
    if (!Array.isArray(samples) || samples.length === 0) return null;
    
    // Validate markerGenes array
    if (!Array.isArray(d.markerGenes)) return null;
    
    // Optional: validate rankMetrics if present
    if (d.rankMetrics && !Array.isArray(d.rankMetrics)) return null;
    
    // Optional: validate survivalData if present
    if (d.survivalData && !Array.isArray(d.survivalData)) return null;
    
    // Return normalized data with consistent field names
    return {
      summary: d.summary,
      samples: samples,
      markerGenes: d.markerGenes,
      heatmapData: d.heatmapData,
      rankMetrics: d.rankMetrics,
      survivalData: d.survivalData,
    };
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setStatus("error");
      setMessage("Please upload a JSON file");
      return;
    }

    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      
      const normalizedData = validateAndNormalize(rawData);
      if (!normalizedData) {
        setStatus("error");
        setMessage("Invalid NMF data format. Expected: summary, samples (or sampleResults), markerGenes");
        return;
      }

      onDataLoaded(normalizedData);
      setStatus("success");
      
      const features = [];
      if (normalizedData.rankMetrics) features.push("rank metrics");
      if (normalizedData.survivalData) features.push("survival data");
      const featuresStr = features.length > 0 ? ` (includes ${features.join(", ")})` : "";
      
      setMessage(`Loaded ${normalizedData.summary.n_samples} samples with ${normalizedData.summary.n_subtypes} subtypes${featuresStr}`);
    } catch (err) {
      setStatus("error");
      setMessage("Failed to parse JSON file");
    }
  }, [onDataLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Import NMF Results
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">Expected JSON format:</p>
                  <ul className="text-xs space-y-1">
                    <li><code>summary</code>: n_samples, n_subtypes, subtype_counts, optimal_rank</li>
                    <li><code>sampleResults</code>: sample_id, subtype, score_subtype_*</li>
                    <li><code>markerGenes</code>: gene, subtype, score, pValue</li>
                    <li><code>rankMetrics</code> (optional): rank, cophenetic, silhouette</li>
                    <li><code>survivalData</code> (optional): subtype, timePoints</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              asChild
            >
              <a href="/examples/example-mock-nmf-results.json" download>
                <Download className="h-3 w-3" />
                Mock
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              asChild
            >
              <a href="/examples/example-GSE62254-nmf-results.json" download>
                <Download className="h-3 w-3" />
                GSE62254
              </a>
            </Button>
          </div>
        </div>
        <CardDescription>
          Upload JSON output from R pipeline
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`
            relative rounded-lg border-2 border-dashed p-6 text-center transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
            ${status === "success" ? "border-green-500 bg-green-500/5" : ""}
            ${status === "error" ? "border-destructive bg-destructive/5" : ""}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="flex flex-col items-center gap-2">
            {status === "idle" && (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop or click to upload
                </p>
              </>
            )}
            
            {status === "success" && (
              <>
                <Check className="h-8 w-8 text-green-500" />
                <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
              </>
            )}
            
            {status === "error" && (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{message}</p>
              </>
            )}
          </div>
        </div>
        
        {status !== "idle" && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 w-full"
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
          >
            Upload another file
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
