import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileJson, Check, AlertCircle } from "lucide-react";
import { NmfSummary, SampleResult, MarkerGene } from "@/data/mockNmfData";

interface NmfData {
  summary: NmfSummary;
  samples: SampleResult[];
  markerGenes: MarkerGene[];
  heatmapData?: {
    genes: string[];
    samples: string[];
    sampleSubtypes: string[];
    values: number[][];
  };
}

interface JsonUploaderProps {
  onDataLoaded: (data: NmfData) => void;
}

type UploadStatus = "idle" | "success" | "error";

export const JsonUploader = ({ onDataLoaded }: JsonUploaderProps) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const validateData = (data: unknown): data is NmfData => {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    
    // Check for required fields
    if (!d.summary || !d.samples || !d.markerGenes) return false;
    
    // Validate summary structure
    const summary = d.summary as Record<string, unknown>;
    if (
      typeof summary.n_samples !== "number" ||
      typeof summary.n_subtypes !== "number" ||
      !summary.subtype_counts
    ) {
      return false;
    }
    
    // Validate samples array
    if (!Array.isArray(d.samples) || d.samples.length === 0) return false;
    
    // Validate markerGenes array
    if (!Array.isArray(d.markerGenes)) return false;
    
    return true;
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setStatus("error");
      setMessage("Please upload a JSON file");
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!validateData(data)) {
        setStatus("error");
        setMessage("Invalid NMF data format. Expected: summary, samples, markerGenes");
        return;
      }

      onDataLoaded(data);
      setStatus("success");
      setMessage(`Loaded ${data.summary.n_samples} samples with ${data.summary.n_subtypes} subtypes`);
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
        <CardTitle className="text-lg flex items-center gap-2">
          <FileJson className="h-5 w-5 text-primary" />
          Import NMF Results
        </CardTitle>
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
