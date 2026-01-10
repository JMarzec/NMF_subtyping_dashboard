import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";

interface AnnotationSelectorProps {
  columns: string[];
  selectedColumn: string | null;
  onColumnChange: (column: string | null) => void;
  label?: string;
}

export const AnnotationSelector = ({
  columns,
  selectedColumn,
  onColumnChange,
  label = "Overlay annotation",
}: AnnotationSelectorProps) => {
  if (columns.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Layers className="h-4 w-4 text-muted-foreground" />
      <Label className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      <Select
        value={selectedColumn || "_none_"}
        onValueChange={(val) => onColumnChange(val === "_none_" ? null : val)}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border">
          <SelectItem value="_none_" className="text-xs">None</SelectItem>
          {columns.map((col) => (
            <SelectItem key={col} value={col} className="text-xs">
              {col}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
