import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, AlertCircle, X } from "lucide-react";

export interface MatrixData {
  genes: string[];
  samples: string[];
  values: number[][];
}

export interface AnnotationData {
  sampleColumn: string;
  annotations: Record<string, Record<string, string>>; // sample -> {columnName: value}
  columns: string[];
}

interface MatrixUploaderProps {
  onMatrixLoaded: (matrix: MatrixData, annotation?: AnnotationData) => void;
}

type UploadStep = "matrix" | "annotation" | "complete";

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

export const MatrixUploader = ({ onMatrixLoaded }: MatrixUploaderProps) => {
  const [step, setStep] = useState<UploadStep>("matrix");
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null);
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [matrixFileName, setMatrixFileName] = useState<string>("");

  const processMatrixFile = useCallback(async (file: File) => {
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
        setError("File must have at least 2 columns and 1 data row");
        return;
      }

      // First column is gene names, rest are samples
      const samples = headers.slice(1);
      const genes: string[] = [];
      const values: number[][] = [];

      for (const row of rows) {
        if (row.length < 2) continue;
        const gene = row[0];
        const geneValues = row.slice(1).map(v => {
          const num = parseFloat(v);
          return isNaN(num) ? 0 : num;
        });
        
        if (geneValues.length === samples.length) {
          genes.push(gene);
          values.push(geneValues);
        }
      }

      if (genes.length === 0) {
        setError("No valid gene expression data found");
        return;
      }

      setMatrixData({ genes, samples, values });
      setMatrixFileName(file.name);
      setStep("annotation");
      setError("");
    } catch (err) {
      setError("Failed to parse matrix file");
    }
  }, []);

  const processAnnotationFile = useCallback(async (file: File) => {
    if (!matrixData) return;

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

      // Find which column matches sample IDs
      let sampleColIndex = -1;
      for (let i = 0; i < headers.length; i++) {
        const colValues = rows.map(row => row[i]);
        const matchCount = matrixData.samples.filter(s => colValues.includes(s)).length;
        if (matchCount > matrixData.samples.length * 0.5) {
          sampleColIndex = i;
          break;
        }
      }

      if (sampleColIndex === -1) {
        setError("Could not find sample ID column matching expression matrix");
        return;
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
      setStep("complete");
      setError("");
      onMatrixLoaded(matrixData, annot);
    } catch (err) {
      setError("Failed to parse annotation file");
    }
  }, [matrixData, onMatrixLoaded]);

  const skipAnnotation = useCallback(() => {
    if (matrixData) {
      setStep("complete");
      onMatrixLoaded(matrixData, undefined);
    }
  }, [matrixData, onMatrixLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (step === "matrix") {
      processMatrixFile(file);
    } else if (step === "annotation") {
      processAnnotationFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    if (step === "matrix") {
      processMatrixFile(file);
    } else if (step === "annotation") {
      processAnnotationFile(file);
    }
  }, [step, processMatrixFile, processAnnotationFile]);

  const reset = () => {
    setStep("matrix");
    setMatrixData(null);
    setAnnotationData(null);
    setError("");
    setMatrixFileName("");
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Import Expression Matrix
        </CardTitle>
        <CardDescription>
          {step === "matrix" && "Upload expression matrix (TSV/CSV)"}
          {step === "annotation" && "Optionally add sample annotations"}
          {step === "complete" && "Data loaded successfully"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step !== "complete" ? (
          <div
            className={`
              relative rounded-lg border-2 border-dashed p-6 text-center transition-colors
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
            
            <div className="flex flex-col items-center gap-2">
              {error ? (
                <>
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </>
              ) : step === "matrix" ? (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop expression matrix or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Genes in rows, samples in columns
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop sample annotation file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Must contain sample IDs matching matrix
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-4 text-center">
            <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-green-600 dark:text-green-400">
              Loaded {matrixData?.genes.length} genes × {matrixData?.samples.length} samples
            </p>
            {annotationData && (
              <p className="text-xs text-muted-foreground mt-1">
                Annotations: {annotationData.columns.join(", ")}
              </p>
            )}
          </div>
        )}

        {step === "annotation" && !error && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              Matrix: {matrixFileName}
            </div>
            <Button variant="ghost" size="sm" onClick={skipAnnotation}>
              Skip annotations
            </Button>
          </div>
        )}

        {(step === "complete" || error) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 w-full"
            onClick={reset}
          >
            <X className="h-4 w-4 mr-1" />
            Upload different files
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
