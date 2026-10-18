import { kaplanMeier } from "@/lib/survivalEngine";
import type { SurvivalObservation } from "@/lib/analysisData";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  Area, 
  ComposedChart,
  ReferenceLine,
  Line
} from "recharts";
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Database, Calculator, Trash2, TrendingUp, ArrowLeftRight, BarChart3 } from "lucide-react";
import { downloadChartAsPNG, downloadRechartsAsSVG } from "@/lib/chartExport";
import { logRankTest, formatPValue } from "@/lib/logRankTest";
import { observedGroupCox, formatHR, CoxPHResult, StratifiedCoxPHResult, multivariateCoxPH, MultivariateCoxPHResult, stepwiseModelComparison, ModelComparisonResult, backwardElimination, BackwardEliminationResult, forwardSelection, ForwardSelectionResult, stepwiseSelection, StepwiseSelectionResult, crossValidateConcordance, CrossValidationResult } from "@/lib/coxphAnalysis";
import { CoxPHResultFromJSON } from "@/components/bioinformatics/JsonUploader";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnnotationData } from "@/components/bioinformatics/AnnotationUploader";
import { ForestPlot } from "@/components/bioinformatics/ForestPlot";
import { StratumResultsTable } from "@/components/bioinformatics/StratumResultsTable";
import { MultivariateResultsTable } from "@/components/bioinformatics/MultivariateResultsTable";
import { MultivariateForestPlot } from "@/components/bioinformatics/MultivariateForestPlot";
import { CovariateSelector } from "@/components/bioinformatics/CovariateSelector";
import { ModelComparisonPanel } from "@/components/bioinformatics/ModelComparisonPanel";
import { BackwardEliminationPanel } from "@/components/bioinformatics/BackwardEliminationPanel";
import { ForwardSelectionPanel } from "@/components/bioinformatics/ForwardSelectionPanel";
import { StepwiseSelectionPanel } from "@/components/bioinformatics/StepwiseSelectionPanel";
import { CrossValidationPanel } from "@/components/bioinformatics/CrossValidationPanel";

export interface SurvivalTimePoint {
  time: number;
  survival: number;
  censored?: number;
  events?: number;
  atRisk?: number;
  stdErr?: number;
  lowerCI?: number;
  upperCI?: number;
}

export interface SurvivalData {
  subtype: string;
  nTotal?: number;
  nEvents?: number;
  nCensored?: number;
  timePoints: SurvivalTimePoint[];
}

interface SurvivalCurveProps {
  data: SurvivalData[];
  rawSurvivalData?: SurvivalObservation[];
  subtypeColors: Record<string, string>;
  subtypeCounts?: Record<string, number>;
  // Pre-computed values from R (optional - will estimate if not provided)
  survivalPValue?: number;
  coxPHResults?: CoxPHResultFromJSON;
  // User annotations for custom grouping
  userAnnotations?: AnnotationData;
  // Sample to subtype mapping for annotation-based analysis
  sampleSubtypes?: Record<string, string>;
}

// Generate colors for annotation groups
const generateAnnotationColors = (groups: string[]): Record<string, string> => {
  const colorPalette = [
    "hsl(210, 70%, 50%)", // Blue
    "hsl(0, 70%, 50%)",   // Red
    "hsl(120, 60%, 40%)", // Green
    "hsl(45, 80%, 50%)",  // Orange
    "hsl(280, 60%, 50%)", // Purple
    "hsl(180, 60%, 45%)", // Teal
    "hsl(330, 70%, 50%)", // Pink
    "hsl(60, 70%, 45%)",  // Yellow
  ];
  
  const colors: Record<string, string> = {};
  groups.forEach((group, i) => {
    colors[group] = colorPalette[i % colorPalette.length];
  });
  return colors;
};

export const SurvivalCurve = ({ 
  data, 
  subtypeColors, 
  subtypeCounts,
  survivalPValue,
  coxPHResults,
  userAnnotations,
  sampleSubtypes,
  rawSurvivalData = []
}: SurvivalCurveProps) => {
  const [groupBy, setGroupBy] = useState<string>("nmf_subtype");
  const [stratifyBy, setStratifyBy] = useState<string>("none");
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = () => {
    downloadChartAsPNG(chartRef.current, "survival-curve");
  };

  const handleDownloadSVG = () => {
    downloadRechartsAsSVG(chartRef.current, "survival-curve");
  };

  // Get available annotation columns for grouping
  const annotationColumns = useMemo(() => {
    if (!userAnnotations) return [];
    return userAnnotations.columns.filter(col => 
      col !== 'sample_id' && col !== 'Sample_ID' && col !== 'SampleID'
    );
  }, [userAnnotations]);

  const groupAssignments = useMemo(() => {
    if(groupBy === "nmf_subtype") return sampleSubtypes ?? {};
    return Object.fromEntries(Object.entries(userAnnotations?.annotations ?? {}).flatMap(([id,cols])=>cols[groupBy]?[[id,String(cols[groupBy])]]:[]));
  },[groupBy,sampleSubtypes,userAnnotations]);
  const { effectiveData, effectiveColors, effectiveCounts, isAnnotationGrouping } = useMemo(() => {
    const isAnnotationGrouping=groupBy!=="nmf_subtype";
    const curves=isAnnotationGrouping || !data.length ? kaplanMeier(rawSurvivalData,groupAssignments) : data;
    const counts=isAnnotationGrouping?Object.fromEntries(curves.map(g=>[g.subtype,g.nTotal ?? 0])):subtypeCounts;
    return {effectiveData:curves,effectiveColors:isAnnotationGrouping?generateAnnotationColors(curves.map(g=>g.subtype)):subtypeColors,effectiveCounts:counts,isAnnotationGrouping};
  },[data,rawSurvivalData,groupAssignments,groupBy,subtypeCounts,subtypeColors]);
  const isPrecomputedPValue=survivalPValue!==undefined && !isAnnotationGrouping;
  const isPrecomputedCoxPH=!!coxPHResults && !isAnnotationGrouping && stratifyBy==="none";
  const logRankResult=useMemo(()=>isPrecomputedPValue?{pValue:survivalPValue ?? 1,chiSquare:0,degreesOfFreedom:0}:logRankTest(rawSurvivalData,groupAssignments),[isPrecomputedPValue,survivalPValue,rawSurvivalData,groupAssignments]);
  const {coxPHResult,isStratified}=useMemo(()=>{
    if(isPrecomputedCoxPH)return {coxPHResult:coxPHResults,isStratified:false};
    const strata=stratifyBy === "none" ? undefined : Object.fromEntries(Object.entries(userAnnotations?.annotations ?? {}).flatMap(([id,cols])=>cols[stratifyBy]?[[id,cols[stratifyBy]]]:[]));
    return {coxPHResult:observedGroupCox(rawSurvivalData,groupAssignments,strata),isStratified:stratifyBy!=="none"};
  },[isPrecomputedCoxPH,coxPHResults,rawSurvivalData,groupAssignments,stratifyBy,userAnnotations]);

  // Multivariate Cox PH analysis when covariates are selected
  const multivariateResult = useMemo((): MultivariateCoxPHResult | null => {
    if (selectedCovariates.length === 0 || !userAnnotations || !sampleSubtypes) {
      return null;
    }

    // Build covariate data structure
    const covariateData: Record<string, Record<string, string | number>> = {};
    
    selectedCovariates.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    return multivariateCoxPH(rawSurvivalData, covariateData, sampleSubtypes, subtypeCounts);
  }, [selectedCovariates, userAnnotations, sampleSubtypes, rawSurvivalData, subtypeCounts]);

  // Stepwise model comparison using likelihood ratio tests
  const modelComparisons = useMemo((): ModelComparisonResult[] => {
    if (selectedCovariates.length < 2 || !userAnnotations || !sampleSubtypes) {
      return [];
    }

    const covariateData: Record<string, Record<string, string | number>> = {};
    
    selectedCovariates.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    return stepwiseModelComparison(rawSurvivalData, covariateData, sampleSubtypes, selectedCovariates, subtypeCounts);
  }, [selectedCovariates, userAnnotations, sampleSubtypes, rawSurvivalData, subtypeCounts]);

  // Backward elimination result
  const [backwardEliminationResult, setBackwardEliminationResult] = useState<BackwardEliminationResult | null>(null);
  
  // Forward selection result
  const [forwardSelectionResult, setForwardSelectionResult] = useState<ForwardSelectionResult | null>(null);

  // Stepwise selection result
  const [stepwiseSelectionResult, setStepwiseSelectionResult] = useState<StepwiseSelectionResult | null>(null);

  // Cross-validation result
  const [crossValidationResult, setCrossValidationResult] = useState<CrossValidationResult | null>(null);

  const runBackwardElimination = () => {
    if (selectedCovariates.length < 1 || !userAnnotations || !sampleSubtypes) {
      return;
    }

    const covariateData: Record<string, Record<string, string | number>> = {};
    
    selectedCovariates.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    const result = backwardElimination(rawSurvivalData, covariateData, sampleSubtypes, selectedCovariates, subtypeCounts, 0.05);
    if(!result.steps.length) { toast.error("Model unavailable: check events, missing values and redundant predictors"); return; }
    setBackwardEliminationResult(result);
    setForwardSelectionResult(null);
    setStepwiseSelectionResult(null);
  };

  const runForwardSelection = () => {
    if (annotationColumns.length < 1 || !userAnnotations || !sampleSubtypes) {
      return;
    }

    const covariateData: Record<string, Record<string, string | number>> = {};
    
    annotationColumns.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    const result = forwardSelection(rawSurvivalData, covariateData, sampleSubtypes, annotationColumns, subtypeCounts, 0.05);
    if(!result.steps.length) { toast.error("Model unavailable: check individual outcomes and predictors"); return; }
    setForwardSelectionResult(result);
    setBackwardEliminationResult(null);
    setStepwiseSelectionResult(null);
  };

  const runStepwiseSelection = () => {
    if (annotationColumns.length < 1 || !userAnnotations || !sampleSubtypes) {
      return;
    }

    const covariateData: Record<string, Record<string, string | number>> = {};
    
    annotationColumns.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    const result = stepwiseSelection(rawSurvivalData, covariateData, sampleSubtypes, annotationColumns, subtypeCounts, 0.05, 0.10);
    setStepwiseSelectionResult(result);
    setForwardSelectionResult(null);
    setBackwardEliminationResult(null);
  };

  const runCrossValidation = () => {
    if (selectedCovariates.length < 1 || !userAnnotations || !sampleSubtypes) {
      return;
    }

    const covariateData: Record<string, Record<string, string | number>> = {};
    
    selectedCovariates.forEach(covariate => {
      covariateData[covariate] = {};
      Object.entries(userAnnotations.annotations).forEach(([sampleId, cols]) => {
        const value = cols[covariate];
        if (value !== undefined && value !== null && value !== '') {
          covariateData[covariate][sampleId] = value;
        }
      });
    });

    const result = crossValidateConcordance(rawSurvivalData, covariateData, sampleSubtypes, selectedCovariates, subtypeCounts, 5);
    if(!result.concordanceScores.length)toast.error("Cross-validation unavailable: insufficient comparable outcomes or a fold could not be fitted");
    setCrossValidationResult(result);
  };

  const applyBackwardEliminationResult = (covariates: string[]) => {
    setSelectedCovariates(covariates);
    setBackwardEliminationResult(null);
    setCrossValidationResult(null);
  };

  const applyForwardSelectionResult = (covariates: string[]) => {
    setSelectedCovariates(covariates);
    setForwardSelectionResult(null);
    setCrossValidationResult(null);
  };

  const applyStepwiseSelectionResult = (covariates: string[]) => {
    setSelectedCovariates(covariates);
    setStepwiseSelectionResult(null);
    setCrossValidationResult(null);
  };

  const toggleCovariate = (covariate: string) => {
    setSelectedCovariates(prev => 
      prev.includes(covariate) 
        ? prev.filter(c => c !== covariate)
        : [...prev, covariate]
    );
    setBackwardEliminationResult(null);
    setForwardSelectionResult(null);
    setStepwiseSelectionResult(null);
    setCrossValidationResult(null);
  };

  const selectAllCovariates = () => {
    setSelectedCovariates([...annotationColumns]);
    setBackwardEliminationResult(null);
    setForwardSelectionResult(null);
    setStepwiseSelectionResult(null);
    setCrossValidationResult(null);
  };

  const clearAllCovariates = () => {
    setSelectedCovariates([]);
    setBackwardEliminationResult(null);
    setForwardSelectionResult(null);
    setStepwiseSelectionResult(null);
    setCrossValidationResult(null);
  };

  const reorderCovariates = (newOrder: string[]) => {
    setSelectedCovariates(newOrder);
    setBackwardEliminationResult(null);
    setForwardSelectionResult(null);
    setStepwiseSelectionResult(null);
    setCrossValidationResult(null);
  };

  // Export survival statistics as CSV/TSV
  const exportSurvivalStats = (format: 'csv' | 'tsv') => {
    const separator = format === 'csv' ? ',' : '\t';
    const lines: string[] = [];
    
    // Header
    lines.push(['Statistic', 'Subtype', 'Value', 'Lower CI', 'Upper CI', 'P-value', 'Source'].join(separator));
    
    // Log-rank test
    if (logRankResult) {
      lines.push([
        'Log-rank Test',
        'All groups',
        logRankResult.chiSquare ? logRankResult.chiSquare.toFixed(4) : 'N/A',
        'N/A',
        'N/A',
        logRankResult.pValue.toExponential(4),
        isPrecomputedPValue ? 'R (pre-computed)' : 'Individual outcomes'
      ].join(separator));
    }
    
    // Median survival for each subtype
    subtypes.forEach(subtype => {
      const median = medianSurvival[subtype];
      lines.push([
        'Median Survival (months)',
        subtype,
        median !== null ? median.toFixed(2) : 'Not Reached',
        'N/A',
        'N/A',
        'N/A',
        'Calculated from curve'
      ].join(separator));
    });
    
    // Cox PH results
    if (coxPHResult) {
      lines.push([
        'Cox PH Reference Group',
        coxPHResult.referenceGroup,
        '1.00',
        'N/A',
        'N/A',
        'N/A',
        isPrecomputedCoxPH ? 'R (pre-computed)' : 'Individual outcomes'
      ].join(separator));
      
      coxPHResult.groups.forEach(g => {
        lines.push([
          'Cox PH Hazard Ratio',
          g.subtype,
          g.hazardRatio.toFixed(4),
          g.lowerCI.toFixed(4),
          g.upperCI.toFixed(4),
          g.pValue.toExponential(4),
          isPrecomputedCoxPH ? 'R (pre-computed)' : 'Individual outcomes'
        ].join(separator));
      });
      
      lines.push([
        'Wald Test',
        'All groups',
        coxPHResult.waldTest.chiSquare.toFixed(4),
        'N/A',
        'N/A',
        coxPHResult.waldTest.pValue.toExponential(4),
        isPrecomputedCoxPH ? 'R (pre-computed)' : 'Individual outcomes'
      ].join(separator));
    }
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survival-analysis-results.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate median survival for each subtype
  const medianSurvival = useMemo(() => {
    const result: Record<string, number | null> = {};
    
    effectiveData.forEach(group => {
      // Sort time points
      const sorted = [...group.timePoints].sort((a, b) => a.time - b.time);
      
      // Ensure monotonic decreasing survival
      let lastSurvival = 1;
      const monotonic = sorted.map(tp => {
        const survival = Math.min(lastSurvival, tp.survival);
        lastSurvival = survival;
        return { ...tp, survival };
      });
      
      const median = monotonic.find(p=>p.survival<=0.5)?.time ?? null;

      result[group.subtype] = median;
    });
    
    return result;
  }, [effectiveData]);

  // Transform data for chart - ensure monotonic survival and proper step function
  const { chartData, eventPoints, censorPoints, subtypes, maxTime, riskTableData } = useMemo(() => {
    if (!effectiveData || effectiveData.length === 0) {
      return { chartData: [], eventPoints: [], censorPoints: [], subtypes: [], maxTime: 100, riskTableData: [] };
    }
    
    const subtypeNames = effectiveData.map(d => d.subtype);
    
    // Process each subtype - ensure monotonic decreasing survival
    const processedData = effectiveData.map(group => {
      const subtype = group.subtype;
      const n = group.nTotal || effectiveCounts?.[subtype] || 100;
      
      // Add initial point at time 0 with survival 1 if not present
      const points = [...group.timePoints];
      if (points.length === 0 || points[0].time > 0) {
        points.unshift({
          time: 0,
          survival: 1,
          atRisk: n,
          events: 0,
          censored: 0
        });
      }
      
      // Sort by time
      points.sort((a, b) => a.time - b.time);
      
      // Ensure monotonically decreasing survival
      let lastSurvival = 1;
      const sortedPoints = points.map(tp => {
        const survival = Math.min(lastSurvival, tp.survival);
        lastSurvival = survival;
        
        // Calculate CI if not provided
        const stdErr = tp.stdErr;

        return { 
          time: tp.time, 
          survival, 
          stdErr,
          lowerCI: tp.lowerCI ?? (stdErr !== undefined ? Math.max(0, survival - 1.96 * stdErr) : undefined),
          upperCI: tp.upperCI ?? (stdErr !== undefined ? Math.min(1, survival + 1.96 * stdErr) : undefined),
          atRisk: tp.atRisk,
          events: tp.events,
          censored: tp.censored
        };
      });
      
      // Find the max time for this subtype (where curve should end)
      const maxTimeForSubtype = Math.max(...sortedPoints.map(p => p.time));
      
      return { subtype, points: sortedPoints, n, maxTime: maxTimeForSubtype };
    });
    
    // Find max time across all subtypes
    const maxT = Math.max(...processedData.flatMap(g => g.points.map(p => p.time)));
    
    // Get all unique time points
    const allTimes = new Set<number>();
    processedData.forEach(group => {
      group.points.forEach(p => allTimes.add(p.time));
    });
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Build step-function chart data
    const chartPoints: Record<string, number>[] = [];
    const lastKnown: Record<string, { survival: number; lowerCI?: number; upperCI?: number; atRisk?: number }> = {};
    
    processedData.forEach(g => {
      lastKnown[g.subtype] = { survival: 1.0, lowerCI: 1.0, upperCI: 1.0, atRisk: g.n };
    });
    
    // Track max time per subtype to know when to stop each curve
    const subtypeMaxTimes: Record<string, number> = {};
    processedData.forEach(g => {
      subtypeMaxTimes[g.subtype] = g.maxTime;
    });
    
    for (let i = 0; i < sortedTimes.length; i++) {
      const time = sortedTimes[i];
      const point: Record<string, number | undefined> = { time };
      
      processedData.forEach(group => {
        // Only include data for this subtype if time is within its follow-up range
        if (time > subtypeMaxTimes[group.subtype]) {
          // Beyond the last data point for this subtype - don't extend the curve
          point[group.subtype] = undefined;
          point[`${group.subtype}_upper`] = undefined;
          point[`${group.subtype}_lower`] = undefined;
          return;
        }
        
        const tp = group.points.find(p => p.time === time);
        if (tp) {
          lastKnown[group.subtype] = { 
            survival: tp.survival, 
            lowerCI: tp.lowerCI,
            upperCI: tp.upperCI,
            atRisk: tp.atRisk
          };
        }
        const { survival, lowerCI, upperCI } = lastKnown[group.subtype];
        point[group.subtype] = survival;
        point[`${group.subtype}_upper`] = upperCI;
        point[`${group.subtype}_lower`] = lowerCI;
      });
      
      chartPoints.push(point as Record<string, number>);
    }
    
    // Collect event markers (where survival drops)
    const markers: { time: number; survival: number; subtype: string }[] = [];
    processedData.forEach(group => {
      for (let i = 0; i < group.points.length; i++) {
        const curr = group.points[i];
        // Add event marker if there are events at this time
        if ((curr.events && curr.events > 0) || (i > 0 && curr.survival < group.points[i - 1].survival - 0.001)) {
          markers.push({
            time: curr.time,
            survival: curr.survival,
            subtype: group.subtype
          });
        }
      }
    });
    
    // Collect censoring markers (including end-of-follow-up without event)
    const censors: { time: number; survival: number; subtype: string; isEndOfFollowUp?: boolean }[] = [];
    processedData.forEach(group => {
      const maxTimeForSubtype = Math.max(...group.points.map(p => p.time));
      
      for (let i = 0; i < group.points.length; i++) {
        const curr = group.points[i];
        const isLastPoint = i === group.points.length - 1 || curr.time === maxTimeForSubtype;
        
        // Check if explicitly marked as censored
        if (curr.censored && curr.censored > 0) {
          censors.push({
            time: curr.time,
            survival: curr.survival,
            subtype: group.subtype,
            isEndOfFollowUp: isLastPoint && curr.survival > 0
          });
        }
        
      }
    });
    
    // Generate risk table data at regular intervals
    const riskIntervals = generateRiskIntervals(maxT);
    const riskTable = riskIntervals.map(t => {
      const row: Record<string, number | string> = { time: t };
      processedData.forEach(group => {
        if(rawSurvivalData.length) {
          row[group.subtype]=rawSurvivalData.filter(o=>groupAssignments[o.sample_id]===group.subtype && o.time>=t).length;
        } else {
          const next=group.points.find(p=>p.time>=t);
          if(next?.atRisk!==undefined)row[group.subtype]=next.atRisk;
        }
      });
      return row;
    });
    
    return { 
      chartData: chartPoints, 
      eventPoints: markers, 
      censorPoints: censors, 
      subtypes: subtypeNames, 
      maxTime: maxT,
      riskTableData: riskTable
    };
  }, [effectiveData, effectiveCounts, rawSurvivalData, groupAssignments]);

  if (effectiveData.length === 0) {
    return (
      <Card className="border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Survival Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            No survival data available. Include survivalData in your JSON.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row flex-wrap gap-3 items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-lg">Kaplan-Meier Survival Curves</CardTitle>
            
            {/* Group selector */}
            {rawSurvivalData.length > 0 && annotationColumns.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Group by:</span>
                <Select value={groupBy} onValueChange={(v) => { setGroupBy(v); if (v !== "nmf_subtype") setStratifyBy("none"); }}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nmf_subtype">NMF Subtype</SelectItem>
                    {annotationColumns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Stratification selector - only available when grouping by NMF subtype */}
            {rawSurvivalData.length > 0 && annotationColumns.length > 0 && groupBy === "nmf_subtype" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Stratify by:</span>
                <Select value={stratifyBy} onValueChange={setStratifyBy}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {annotationColumns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stratifyBy !== "none" && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs cursor-help">
                          Stratified
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cox PH analysis controls for {stratifyBy} as a confounder</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            {/* Multivariate Covariates Selector */}
            {rawSurvivalData.length > 0 && annotationColumns.length > 0 && groupBy === "nmf_subtype" && (
              <div className="flex items-center gap-2 flex-wrap">
                <CovariateSelector
                  columns={annotationColumns}
                  selectedCovariates={selectedCovariates}
                  onToggle={toggleCovariate}
                  onSelectAll={selectAllCovariates}
                  onClearAll={clearAllCovariates}
                  onReorder={reorderCovariates}
                />
                
                {/* Forward Selection - works on all candidates */}
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={runForwardSelection}
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                        Forward
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Build model by adding significant covariates (p &lt; 0.05) one at a time</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>

                {/* Backward Elimination - requires selection */}
                {selectedCovariates.length >= 1 && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={runBackwardElimination}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Backward
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Remove non-significant covariates (p &gt; 0.05) iteratively</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}

                {/* Stepwise Selection */}
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={runStepwiseSelection}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                        Stepwise
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Combine forward and backward steps for optimal model</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>

                {/* Cross-Validation */}
                {selectedCovariates.length >= 1 && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={runCrossValidation}
                        >
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          5-fold CV
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimate out-of-sample concordance with 5-fold cross-validation</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
            
            {logRankResult && (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant={logRankResult.pValue < 0.05 ? "default" : "secondary"}
                      className={`cursor-help ${logRankResult.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {isPrecomputedPValue ? <Database className="h-3 w-3 mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                      Log-rank: {formatPValue(logRankResult.pValue)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isPrecomputedPValue ? 'Pre-computed from R analysis' : 'Calculated from individual outcomes'}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSurvivalStats('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSurvivalStats('tsv')}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              TSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
              <Download className="h-4 w-4 mr-1" />
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadSVG}>
              <Download className="h-4 w-4 mr-1" />
              SVG
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[420px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, 'dataMax']}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Time (months)", position: "insideBottom", offset: -15, fontSize: 12 }}
                tickFormatter={(value) => value.toFixed(0)}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: "Survival Probability", angle: -90, position: "insideLeft", fontSize: 12, dx: -5 }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  if (name.includes('_upper') || name.includes('_lower')) {
                    return null;
                  }
                  return [`${(value * 100).toFixed(1)}%`, name];
                }}
                labelFormatter={(time) => `Time: ${Number(time).toFixed(1)} months`}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                iconType="plainline"
                payload={subtypes.map(subtype => ({
                  value: `${subtype}${medianSurvival[subtype] !== null ? ` (median: ${medianSurvival[subtype]?.toFixed(1)}mo)` : ' (median: NR)'}`,
                  type: 'line' as const,
                  color: effectiveColors[subtype] || "hsl(var(--primary))"
                }))}
              />
              
              {/* Reference line at 50% survival (median) */}
              <ReferenceLine 
                y={0.5} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
              />
              
              {/* Median survival vertical lines for each subtype */}
              {subtypes.map(subtype => {
                const median = medianSurvival[subtype];
                if (median === null) return null;
                return (
                  <ReferenceLine
                    key={`median-line-${subtype}`}
                    x={median}
                    stroke={effectiveColors[subtype] || "hsl(var(--primary))"}
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                );
              })}
              
              {/* Confidence interval areas */}
              {subtypes.map((subtype) => {
                const color = effectiveColors[subtype] || "hsl(var(--primary))";
                return (
                  <Area
                    key={`${subtype}-ci`}
                    type="stepAfter"
                    dataKey={`${subtype}_upper`}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeWidth={0.5}
                    strokeDasharray="2 2"
                    strokeOpacity={0.3}
                    connectNulls={false}
                    isAnimationActive={false}
                    legendType="none"
                  />
                );
              })}
              
              {/* Lower CI bounds */}
              {subtypes.map((subtype) => {
                const color = effectiveColors[subtype] || "hsl(var(--primary))";
                return (
                  <Line
                    key={`${subtype}-lower`}
                    type="stepAfter"
                    dataKey={`${subtype}_lower`}
                    stroke={color}
                    strokeWidth={0.5}
                    strokeDasharray="2 2"
                    strokeOpacity={0.3}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    legendType="none"
                  />
                );
              })}
              
              {/* Survival lines with event dots and censoring marks */}
              {subtypes.map((subtype) => (
                <Line
                  key={subtype}
                  type="stepAfter"
                  dataKey={subtype}
                  stroke={effectiveColors[subtype] || "hsl(var(--primary))"}
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload || cx === undefined || cy === undefined) return null;
                    
                    const time = payload.time;
                    const color = effectiveColors[subtype] || "hsl(var(--primary))";
                    
                    // Check if this is an event point
                    const isEvent = eventPoints.some(
                      e => e.subtype === subtype && Math.abs(e.time - time) < 0.01
                    );
                    
                    // Check if this is a censoring point
                    const isCensor = censorPoints.some(
                      c => c.subtype === subtype && Math.abs(c.time - time) < 0.01
                    );
                    
                    if (isEvent) {
                      return (
                        <circle
                          key={`event-${subtype}-${time}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={color}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                        />
                      );
                    }
                    
                    if (isCensor) {
                      const censorInfo = censorPoints.find(
                        c => c.subtype === subtype && Math.abs(c.time - time) < 0.01
                      );
                      const isEndOfFollowUp = censorInfo?.isEndOfFollowUp;
                      
                      // End of follow-up uses a different marker (cross/plus)
                      if (isEndOfFollowUp) {
                        return (
                          <g key={`end-followup-${subtype}-${time}`}>
                            {/* Vertical line */}
                            <line
                              x1={cx}
                              y1={cy - 6}
                              x2={cx}
                              y2={cy + 6}
                              stroke={color}
                              strokeWidth={2.5}
                            />
                            {/* Horizontal line to form a cross */}
                            <line
                              x1={cx - 5}
                              y1={cy}
                              x2={cx + 5}
                              y2={cy}
                              stroke={color}
                              strokeWidth={2.5}
                            />
                          </g>
                        );
                      }
                      
                      // Regular censoring marker (vertical tick)
                      return (
                        <g key={`censor-${subtype}-${time}`}>
                          <line
                            x1={cx}
                            y1={cy - 6}
                            x2={cx}
                            y2={cy + 6}
                            stroke={color}
                            strokeWidth={2}
                          />
                        </g>
                      );
                    }
                    
                    return null;
                  }}
                  connectNulls={false}
                  name={subtype}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Risk Table */}
        {riskTableData.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <h4 className="text-sm font-semibold mb-2">Number at Risk</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 font-medium">Time</th>
                  {riskTableData.map((row, i) => (
                    <th key={i} className="text-center py-1 px-2 font-normal text-muted-foreground">
                      {Number(row.time).toFixed(0)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subtypes.map(subtype => (
                  <tr key={subtype} className="border-b border-border/50">
                    <td className="py-1 pr-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: effectiveColors[subtype] }}
                        />
                        <span className="font-medium">{subtype}</span>
                      </div>
                    </td>
                    {riskTableData.map((row, i) => (
                      <td key={i} className="text-center py-1 px-2">
                        {row[subtype] !== undefined ? Math.round(Number(row[subtype])) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Summary statistics */}
        <div className="mt-4 space-y-3">
          {/* Median survival times */}
          <div className="flex flex-wrap gap-4 justify-center">
            {subtypes.map(subtype => (
              <div 
                key={subtype}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: effectiveColors[subtype] }}
                />
                <span className="text-sm font-medium">{subtype}:</span>
                <span className="text-sm text-muted-foreground">
                  Median = {medianSurvival[subtype] !== null 
                    ? `${medianSurvival[subtype]?.toFixed(1)} mo` 
                    : 'Not Reached'}
                </span>
              </div>
            ))}
          </div>
          
          {/* Cox PH results */}
          {coxPHResult && (
            <div className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Cox Proportional Hazards Analysis</h4>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help text-xs">
                        {isPrecomputedCoxPH ? <Database className="h-3 w-3 mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                        {isPrecomputedCoxPH ? 'R' : 'Cox fit'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isPrecomputedCoxPH ? 'Pre-computed from R analysis' : 'Calculated from individual outcomes'}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Reference: {coxPHResult.referenceGroup}
              </div>
              <div className="space-y-1">
                {coxPHResult.groups.map(g => (
                  <div key={g.subtype} className="flex flex-wrap items-center gap-2 text-sm">
                    <span 
                      className="font-medium"
                      style={{ color: effectiveColors[g.subtype] }}
                    >
                      {g.subtype}:
                    </span>
                    <span>HR = {formatHR(g.hazardRatio, g.lowerCI, g.upperCI)}</span>
                    <Badge 
                      variant={g.pValue < 0.05 ? "default" : "secondary"}
                      className={`text-xs ${g.pValue < 0.05 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {formatPValue(g.pValue)}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Wald test: χ² = {coxPHResult.waldTest.chiSquare.toFixed(2)}, 
                df = {coxPHResult.waldTest.df}, 
                {formatPValue(coxPHResult.waldTest.pValue)}
              </div>
            </div>
          )}
        </div>
        
        {/* Data source legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            <span>= Pre-computed (R)</span>
          </div>
          <div className="flex items-center gap-1">
            <Calculator className="h-3 w-3" />
            <span>= Individual outcomes</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-current" />
            <span>| = Censored</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold">+</span>
            <span>= End of follow-up</span>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Shaded regions show 95% confidence intervals. Dots indicate events (deaths). 
          Vertical ticks (|) indicate censored observations. Plus signs (+) indicate end of follow-up without event.
          Dashed line at 50% indicates median survival.
        </p>
      </CardContent>
    </Card>
    
    {/* Forest Plot */}
    {coxPHResult && coxPHResult.groups.length > 0 && (
      <ForestPlot
        referenceGroup={coxPHResult.referenceGroup}
        groups={coxPHResult.groups}
        subtypeColors={effectiveColors}
        isPrecomputed={isPrecomputedCoxPH && !isStratified}
        title={
          isStratified 
            ? `Forest Plot: NMF Subtypes (stratified by ${stratifyBy})`
            : isAnnotationGrouping 
              ? `Forest Plot: ${groupBy}` 
              : "Forest Plot: NMF Subtypes"
        }
      />
    )}
    
    {/* Stratum-Specific Results Table */}
    {isStratified && coxPHResult && 'strataResults' in coxPHResult && (coxPHResult as StratifiedCoxPHResult).strataResults.length > 0 && (
      <StratumResultsTable
        result={coxPHResult as StratifiedCoxPHResult}
        subtypeColors={effectiveColors}
        stratifyBy={stratifyBy}
      />
    )}

    {/* Selection Results - BEFORE Forest Plots */}
    {forwardSelectionResult && (
      <ForwardSelectionPanel 
        result={forwardSelectionResult} 
        onApplyFinal={applyForwardSelectionResult}
      />
    )}

    {backwardEliminationResult && (
      <BackwardEliminationPanel 
        result={backwardEliminationResult} 
        onApplyFinal={applyBackwardEliminationResult}
      />
    )}

    {stepwiseSelectionResult && (
      <StepwiseSelectionPanel 
        result={stepwiseSelectionResult} 
        onApplyFinal={applyStepwiseSelectionResult}
      />
    )}

    {/* Nested Model Comparison */}
    {modelComparisons.length > 0 && (
      <ModelComparisonPanel comparisons={modelComparisons} />
    )}

    {/* Cross-Validation Results */}
    {crossValidationResult && crossValidationResult.concordanceScores.length > 0 && (
      <CrossValidationPanel result={crossValidationResult} selectedCovariates={selectedCovariates} />
    )}

    {/* Multivariate Cox Regression Results */}
    {selectedCovariates.length > 0 && !multivariateResult && <p className="text-destructive">Model unavailable: missing outcomes, constant or redundant predictors, or nonconvergence.</p>}
    {multivariateResult && (
      <>
        <MultivariateForestPlot result={multivariateResult} />
        <MultivariateResultsTable result={multivariateResult} />
      </>
    )}
  </div>
  );
};

// Helper function to generate risk table time intervals
function generateRiskIntervals(maxTime: number): number[] {
  const intervals: number[] = [0];
  
  // Determine appropriate interval based on max time
  let step: number;
  if (maxTime <= 24) {
    step = 6;
  } else if (maxTime <= 60) {
    step = 12;
  } else if (maxTime <= 120) {
    step = 24;
  } else {
    step = Math.ceil(maxTime / 6);
  }
  
  for (let t = step; t <= maxTime; t += step) {
    intervals.push(t);
  }
  
  return intervals;
}

