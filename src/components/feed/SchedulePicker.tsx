import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SchedulePickerProps {
  scheduledAt: Date | null;
  onSchedule: (date: Date | null) => void;
}

export default function SchedulePicker({ scheduledAt, onSchedule }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(scheduledAt || undefined);
  const [hours, setHours] = useState(scheduledAt ? String(scheduledAt.getHours()).padStart(2, "0") : "12");
  const [minutes, setMinutes] = useState(scheduledAt ? String(scheduledAt.getMinutes()).padStart(2, "0") : "00");

  const handleConfirm = () => {
    if (!selectedDate) return;
    const date = new Date(selectedDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    if (date <= new Date()) return; // Must be in the future
    onSchedule(date);
    setOpen(false);
  };

  const handleClear = () => {
    onSchedule(null);
    setSelectedDate(undefined);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-2", scheduledAt ? "text-primary" : "text-primary")}
          >
            <Clock className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-card border-border" align="start" side="top">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Schedule Post</p>

            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-2 pointer-events-auto")}
            />

            {/* Time picker */}
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)).toString().padStart(2, "0"))}
                className="w-12 bg-muted rounded px-2 py-1 text-xs text-foreground text-center outline-none"
                min={0}
                max={23}
              />
              <span className="text-xs text-muted-foreground">:</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)).toString().padStart(2, "0"))}
                className="w-12 bg-muted rounded px-2 py-1 text-xs text-foreground text-center outline-none"
                min={0}
                max={59}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClear} className="flex-1 text-xs">
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!selectedDate}
                className="flex-1 text-xs bg-primary text-primary-foreground hover:bg-secondary"
              >
                Confirm
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Scheduled badge */}
      {scheduledAt && (
        <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5">
          <CalendarIcon className="h-3 w-3" />
          <span className="text-[10px] font-medium">{format(scheduledAt, "MMM d, HH:mm")}</span>
          <button onClick={handleClear} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
