import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Check, AlertCircle, X, Download } from "lucide-react";

export interface AnnotationData {
  sampleColumn: string;
  annotations: Record<string, Record<string, string>>; // sample -> {columnName: value}
  columns: string[];
}

interface AnnotationUploaderProps {
  onAnnotationLoaded: (annotation: AnnotationData) => void;
  sampleIds?: string[]; // Optional: sample IDs from NMF data to validate against
}

const parseDelimitedFile = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Detect delimiter (tab vs comma)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map(line => 
    line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''))
  );
  
  return { headers, rows };
};

export const AnnotationUploader = ({ onAnnotationLoaded, sampleIds }: AnnotationUploaderProps) => {
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null);
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const processAnnotationFile = useCallback(async (file: File) => {
    const validExtensions = ['.tsv', '.txt', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setError("Please upload a TSV, TXT, or CSV file");
      return;
    }

    try {
      const text = await file.text();
      const { headers, rows } = parseDelimitedFile(text);
      
      if (headers.length < 2 || rows.length < 1) {
        setError("Annotation file must have at least 2 columns");
        return;
      }

      // Find which column matches sample IDs (if provided)
      let sampleColIndex = 0; // Default to first column
      
      if (sampleIds && sampleIds.length > 0) {
        for (let i = 0; i < headers.length; i++) {
          const colValues = rows.map(row => row[i]);
          const matchCount = sampleIds.filter(s => colValues.includes(s)).length;
          if (matchCount > sampleIds.length * 0.3) {
            sampleColIndex = i;
            break;
          }
        }
      }

      const sampleColumn = headers[sampleColIndex];
      const annotationColumns = headers.filter((_, i) => i !== sampleColIndex);
      const annotations: Record<string, Record<string, string>> = {};

      for (const row of rows) {
        const sampleId = row[sampleColIndex];
        if (!sampleId) continue;
        
        annotations[sampleId] = {};
        headers.forEach((col, i) => {
          if (i !== sampleColIndex) {
            annotations[sampleId][col] = row[i] || "";
          }
        });
      }

      const annot: AnnotationData = {
        sampleColumn,
        annotations,
        columns: annotationColumns,
      };

      setAnnotationData(annot);
      setError("");
      onAnnotationLoaded(annot);
    } catch (err) {
      setError("Failed to parse annotation file");
    }
  }, [sampleIds, onAnnotationLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAnnotationFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processAnnotationFile(file);
  }, [processAnnotationFile]);

  const reset = () => {
    setAnnotationData(null);
    setError("");
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Sample Annotations
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            asChild
          >
            <a href="/examples/example-annotations.tsv" download>
              <Download className="h-3 w-3" />
              Example
            </a>
          </Button>
        </div>
        <CardDescription className="text-xs">
          Optional: upload sample metadata
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!annotationData ? (
          <div
            className={`
              relative rounded-lg border-2 border-dashed p-4 text-center transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
              ${error ? "border-destructive bg-destructive/5" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <input
              type="file"
              accept=".tsv,.txt,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="flex flex-col items-center gap-1">
              {error ? (
                <>
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <p className="text-xs text-destructive">{error}</p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Drop annotation file (TSV/CSV)
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-3 text-center">
            <Check className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-green-600 dark:text-green-400">
              {annotationData.columns.length} columns loaded
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {annotationData.columns.slice(0, 3).join(", ")}
              {annotationData.columns.length > 3 && "..."}
            </p>
          </div>
        )}

        {(annotationData || error) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 w-full text-xs"
            onClick={reset}
          >
            <X className="h-3 w-3 mr-1" />
            {annotationData ? "Remove" : "Clear"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
