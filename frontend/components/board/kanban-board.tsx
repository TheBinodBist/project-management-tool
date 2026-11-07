"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import {
  COLUMNS,
  createTask,
  INITIAL_COLUMNS,
  type ColumnId,
  type Task,
} from "@/components/board/board-data";
import { KanbanColumn } from "@/components/board/kanban-column";
import { TaskCard } from "@/components/board/task-card";

type Columns = Record<ColumnId, Task[]>;

export function KanbanBoard() {
  const [columns, setColumns] = React.useState<Columns>(INITIAL_COLUMNS);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string | number): ColumnId | undefined => {
    if (id in columns) return id as ColumnId;
    return (Object.keys(columns) as ColumnId[]).find((col) =>
      columns[col].some((t) => t.id === id),
    );
  };

  const findColumnOfActive = activeTask
    ? findContainer(activeTask.id)
    : undefined;

  function handleDragStart({ active }: DragStartEvent) {
    const col = findContainer(active.id);
    setActiveTask(
      col ? (columns[col].find((t) => t.id === active.id) ?? null) : null,
    );
  }

  // Move the card into the hovered column while dragging
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const task = fromItems.find((t) => t.id === active.id);
      if (!task) return prev;

      let newIndex: number;
      if (over.id in prev) {
        newIndex = toItems.length;
      } else {
        const overIndex = toItems.findIndex((t) => t.id === over.id);
        const translated = active.rect.current.translated;
        const isBelow =
          !!translated && translated.top > over.rect.top + over.rect.height / 2;
        newIndex =
          overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : toItems.length;
      }

      return {
        ...prev,
        [from]: fromItems.filter((t) => t.id !== active.id),
        [to]: [...toItems.slice(0, newIndex), task, ...toItems.slice(newIndex)],
      };
    });
  }

  // Reorder inside the final column
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;

    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from !== to) return;

    const oldIndex = columns[from].findIndex((t) => t.id === active.id);
    const newIndex = columns[to].findIndex((t) => t.id === over.id);
    if (newIndex >= 0 && oldIndex !== newIndex) {
      setColumns((prev) => ({
        ...prev,
        [from]: arrayMove(prev[from], oldIndex, newIndex),
      }));
    }
  }

  function addCard(columnId: ColumnId) {
    const task = createTask({
      id: `task-${Date.now()}`,
      title: "Untitled task",
      platform: "UI/UX",
      priority: "Medium",
      dueDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
    setColumns((prev) => ({ ...prev, [columnId]: [...prev[columnId], task] }));
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex h-full gap-6 overflow-x-auto p-6">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            dot={col.dot}
            tasks={columns[col.id]}
            onAddCard={addCard}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && findColumnOfActive ? (
          <TaskCard task={activeTask} columnId={findColumnOfActive} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
