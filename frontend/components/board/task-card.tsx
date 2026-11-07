"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, Flag, MessageCircle, MoreHorizontal, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ColumnId, Platform, Priority, Task } from "@/components/board/board-data";

const PLATFORM_STYLES: Record<Platform, string> = {
  "UI/UX": "border-blue-300 bg-blue-500/10 text-blue-600",
  ANDROID: "border-amber-300 bg-amber-500/10 text-amber-600",
  IOS: "border-border bg-muted text-muted-foreground",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  Low: "bg-green-500/10 text-green-600",
  Medium: "bg-orange-500/10 text-orange-600",
  High: "bg-red-500/10 text-red-600",
};

interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  task: Task;
  columnId: ColumnId;
  isDragging?: boolean;
  overlay?: boolean;
}

export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps>(
  ({ task, columnId, isDragging, overlay, className, ...props }, ref) => {
    const { done, total } = task.subtasks;
    const pct = total ? (done / total) * 100 : 0;

    return (
      <div
        ref={ref}
        className={cn(
          "touch-none cursor-grab rounded-xl border bg-background p-4 shadow-sm outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          isDragging && "opacity-40",
          overlay && "rotate-2 cursor-grabbing shadow-xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium",
              PLATFORM_STYLES[task.platform],
            )}
          >
            {task.platform}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Task options"
            className="-mr-2 -mt-1 size-8 text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>

        <h4 className="mt-3 text-[15px] font-semibold leading-snug">{task.title}</h4>

        <p className="mt-5 text-sm text-muted-foreground">
          {done}/{total}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              columnId === "done" ? "bg-green-500" : "bg-orange-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Flag className="size-4" />
            {task.dueDate}
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              PRIORITY_STYLES[task.priority],
            )}
          >
            {task.priority}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Assignees:</span>
          <div className="flex -space-x-2">
            {task.assignees.map((a) => (
              <Avatar key={a.initials} className="size-8 border-2 border-background">
                <AvatarFallback
                  className={cn("text-xs font-semibold text-white", a.color)}
                >
                  {a.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t pt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            {task.comments} Comments
          </span>
          <span className="flex items-center gap-1.5">
            <Paperclip className="size-4" />
            {task.links} Links
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="size-4" />
            {task.files.done}/{task.files.total}
          </span>
        </div>
      </div>
    );
  },
);
TaskCard.displayName = "TaskCard";

export function SortableTaskCard({
  task,
  columnId,
}: {
  task: Task;
  columnId: ColumnId;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", columnId } });

  return (
    <TaskCard
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      task={task}
      columnId={columnId}
      isDragging={isDragging}
      {...attributes}
      {...listeners}
    />
  );
}