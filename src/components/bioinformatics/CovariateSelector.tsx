import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Search, X, CheckSquare, Square } from "lucide-react";

interface CovariateSelectorProps {
  columns: string[];
  selectedCovariates: string[];
  onToggle: (covariate: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export const CovariateSelector = ({
  columns,
  selectedCovariates,
  onToggle,
  onSelectAll,
  onClearAll,
}: CovariateSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return columns;
    const lower = searchTerm.toLowerCase();
    return columns.filter(col => col.toLowerCase().includes(lower));
  }, [columns, searchTerm]);

  const hasSelection = selectedCovariates.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs font-normal"
        >
          <span className="text-muted-foreground">Covariates:</span>
          {hasSelection ? (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {selectedCovariates.length} selected
            </Badge>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search covariates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredColumns.length} covariate{filteredColumns.length !== 1 ? 's' : ''} available
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={onSelectAll}
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={onClearAll}
                disabled={!hasSelection}
              >
                <Square className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </div>
        
        <ScrollArea className="h-[240px]">
          <div className="p-2 space-y-0.5">
            {filteredColumns.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                No covariates match your search
              </div>
            ) : (
              filteredColumns.map(col => (
                <div
                  key={col}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onToggle(col)}
                >
                  <Checkbox
                    id={`cov-${col}`}
                    checked={selectedCovariates.includes(col)}
                    onCheckedChange={() => onToggle(col)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={`cov-${col}`}
                    className="text-sm cursor-pointer flex-1 truncate"
                    title={col}
                  >
                    {col}
                  </label>
                  {selectedCovariates.includes(col) && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      ✓
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {hasSelection && (
          <div className="p-2 border-t bg-muted/30">
            <div className="flex flex-wrap gap-1">
              {selectedCovariates.slice(0, 5).map(cov => (
                <Badge
                  key={cov}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0.5 cursor-pointer hover:bg-destructive/20"
                  onClick={() => onToggle(cov)}
                >
                  {cov.length > 15 ? `${cov.slice(0, 15)}...` : cov}
                  <X className="h-2.5 w-2.5 ml-0.5" />
                </Badge>
              ))}
              {selectedCovariates.length > 5 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  +{selectedCovariates.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
