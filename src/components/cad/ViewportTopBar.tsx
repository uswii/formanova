import { useState } from "react";
import { RotateCcw, Download, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TRANSFORM_MODES = [
  { id: "orbit", label: "Orbit" },
  { id: "move", label: "Move" },
  { id: "rotate", label: "Rotate" },
  { id: "scale", label: "Scale" },
] as const;

interface ViewportTopBarProps {
  onReset: () => void;
}

export default function ViewportTopBar({ onReset }: ViewportTopBarProps) {
  const [mode, setMode] = useState("orbit");

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-card/40 backdrop-blur-sm border-b border-border/20">
      {/* Transform modes */}
      <div className="flex items-center gap-1">
        {TRANSFORM_MODES.map((tm) => (
          <button
            key={tm.id}
            onClick={() => setMode(tm.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[2px] transition-all duration-200",
              mode === tm.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/20"
            )}
          >
            {tm.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] uppercase tracking-wider gap-1.5 h-7"
          onClick={onReset}
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] uppercase tracking-wider gap-1.5 h-7 text-primary border-primary/30 hover:bg-primary/10"
          onClick={() => toast.info("Download coming soon")}
        >
          <Download className="w-3 h-3" /> Download GLB
        </Button>
      </div>
    </div>
  );
}
