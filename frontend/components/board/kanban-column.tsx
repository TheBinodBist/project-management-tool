"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ColumnId, Task } from "@/components/board/board-data";
import { SortableTaskCard } from "@/components/board/task-card";

interface KanbanColumnProps {
  id: ColumnId;
  title: string;
  dot: string;
  tasks: Task[];
  onAddCard: (columnId: ColumnId) => void;
}

export function KanbanColumn({ id, title, dot, tasks, onAddCard }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column" } });

  return (
    <section className="flex h-full min-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dot)} />
          <h3 className="text-sm font-bold tracking-wide">{title}</h3>
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${title} options`}
          className="size-8 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 space-y-3 overflow-y-auto p-3 transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} columnId={id} />
          ))}
        </SortableContext>
      </div>

      <div className="border-t bg-background/60 p-3">
        <Button
          variant="outline"
          onClick={() => onAddCard(id)}
          className="h-10 w-full border-dashed text-muted-foreground"
        >
          <Plus className="size-4" />
          Add Card
        </Button>
      </div>
    </section>
  );
}