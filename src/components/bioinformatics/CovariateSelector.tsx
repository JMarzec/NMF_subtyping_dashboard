import { useState, useMemo, useCallback } from "react";
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
import { ChevronDown, Search, X, CheckSquare, Square, GripVertical } from "lucide-react";

interface CovariateSelectorProps {
  columns: string[];
  selectedCovariates: string[];
  onToggle: (covariate: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onReorder?: (newOrder: string[]) => void;
}

export const CovariateSelector = ({
  columns,
  selectedCovariates,
  onToggle,
  onSelectAll,
  onClearAll,
  onReorder,
}: CovariateSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return columns;
    const lower = searchTerm.toLowerCase();
    return columns.filter(col => col.toLowerCase().includes(lower));
  }, [columns, searchTerm]);

  const hasSelection = selectedCovariates.length > 0;

  // Drag and drop handlers for reordering selected covariates
  const handleDragStart = useCallback((e: React.DragEvent, covariate: string) => {
    setDraggedItem(covariate);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', covariate);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, covariate: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (covariate !== draggedItem) {
      setDragOverItem(covariate);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetCovariate: string) => {
    e.preventDefault();
    
    if (draggedItem && draggedItem !== targetCovariate && onReorder) {
      const newOrder = [...selectedCovariates];
      const draggedIndex = newOrder.indexOf(draggedItem);
      const targetIndex = newOrder.indexOf(targetCovariate);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Remove dragged item and insert at target position
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);
        onReorder(newOrder);
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, selectedCovariates, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

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
      <PopoverContent className="w-80 p-0" align="start">
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
                      #{selectedCovariates.indexOf(col) + 1}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {hasSelection && (
          <div className="p-2 border-t bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <GripVertical className="h-3 w-3" />
              Drag to reorder model entry
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCovariates.map((cov, index) => (
                <Badge
                  key={cov}
                  variant={dragOverItem === cov ? "default" : "secondary"}
                  className={`text-[10px] px-1.5 py-0.5 cursor-grab active:cursor-grabbing transition-all ${
                    draggedItem === cov ? 'opacity-50' : ''
                  } ${dragOverItem === cov ? 'ring-2 ring-primary' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cov)}
                  onDragOver={(e) => handleDragOver(e, cov)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, cov)}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="h-2.5 w-2.5 mr-0.5 opacity-50" />
                  <span className="font-medium mr-0.5">{index + 1}.</span>
                  {cov.length > 12 ? `${cov.slice(0, 12)}...` : cov}
                  <X 
                    className="h-2.5 w-2.5 ml-1 hover:text-destructive" 
                    onClick={(e) => { e.stopPropagation(); onToggle(cov); }}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
