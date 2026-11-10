"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flag, MessageCircle, MoreHorizontal, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ColumnId, Priority, Task } from "@/components/board/board-data";

const PRIORITY_STYLES: Record<Priority, string> = {
  Low: "bg-green-500/10 text-green-600",
  Medium: "bg-orange-500/10 text-orange-600",
  High: "bg-red-500/10 text-red-600",
  Urgent: "bg-red-500/10 text-red-700",
};

interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  task: Task;
  isDragging?: boolean;
  overlay?: boolean;
}

export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps>(
  ({ task, isDragging, overlay, className, ...props }, ref) => {
    const label = task.labels[0];
    const dueDate = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "No due date";

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
          {label ? (
            <span
              className="rounded-md border px-2 py-0.5 text-xs font-medium"
              style={{
                borderColor: label.color,
                backgroundColor: `${label.color}1a`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ) : (
            <span className="rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Task
            </span>
          )}
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

        {task.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {task.description}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Flag className="size-4" />
            {dueDate}
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
              <Avatar key={a.id} className="size-8 border-2 border-background">
                <AvatarImage src={a.avatar_url || undefined} alt={a.full_name} />
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
            <Tags className="size-4" />
            {task.labels.length} Labels
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
      isDragging={isDragging}
      {...attributes}
      {...listeners}
    />
  );
}