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
  type Assignee,
  type ColumnId,
  type Priority,
  type Task,
  type TaskLabel,
} from "@/components/board/board-data";
import { KanbanColumn } from "@/components/board/kanban-column";
import { TaskCard } from "@/components/board/task-card";
import { useApp } from "@/lib/app-context";
import { apiRequest, type ApiTask, type Board, type BoardColumn } from "@/lib/api";

type Columns = Record<ColumnId, Task[]>;
type BoardTargets = Record<number, Partial<Record<ColumnId, number>>>;

const EMPTY_COLUMNS: Columns = { todo: [], "in-progress": [], done: [] };
const AVATAR_COLORS = ["bg-pink-500", "bg-green-500", "bg-violet-500", "bg-cyan-500"];
const PRIORITIES: Record<ApiTask["priority"], Priority> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function getColumnId(column: BoardColumn, index: number): ColumnId {
  const name = column.name.toLowerCase().replace(/[\s_-]+/g, "");
  if (name.includes("progress")) return "in-progress";
  if (name.includes("done") || name.includes("complete")) return "done";
  if (name.includes("todo") || name.includes("backlog")) return "todo";
  return index === 0 ? "todo" : index === 1 ? "in-progress" : "done";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function mapTask(task: ApiTask, boardId: number): Task {
  const assignees: Assignee[] = task.assignees.map((user) => ({
    ...user,
    initials: getInitials(user.full_name || user.email),
    color: AVATAR_COLORS[user.id % AVATAR_COLORS.length],
  }));
  const labels: TaskLabel[] = task.labels;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: PRIORITIES[task.priority],
    dueDate: task.due_date,
    columnId: task.column,
    boardId,
    assignees,
    labels,
    comments: task.comment_count,
  };
}

export function KanbanBoard({ projectId }: { projectId?: number }) {
  const {
    projects,
    projectsWorkspaceId,
    selectedWorkspaceId,
  } = useApp();
  const activeProjectId = projectId ?? null;
  const [columns, setColumns] = React.useState<Columns>(EMPTY_COLUMNS);
  const [targets, setTargets] = React.useState<BoardTargets>({});
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  React.useEffect(() => {
    let active = true;

    async function loadBoard() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      if (
        !selectedWorkspaceId ||
        projectsWorkspaceId !== selectedWorkspaceId ||
        activeProjectId === null
      ) {
        setColumns(EMPTY_COLUMNS);
        setTargets({});
        setLoading(false);
        return;
      }

      const activeProject = projects.find(
        (project) => project.id === activeProjectId,
      );
      if (!activeProject) {
        setColumns(EMPTY_COLUMNS);
        setTargets({});
        setLoading(false);
        return;
      }

      try {
        const boards = await apiRequest<Board[]>(
          `/boards/?project=${activeProject.id}`,
        );
        const boardDetails = await Promise.all(
          boards.map((board) => apiRequest<Board>(`/boards/${board.id}/`)),
        );
        if (!active) return;

        const nextColumns: Columns = { todo: [], "in-progress": [], done: [] };
        const nextTargets: BoardTargets = {};

        for (const board of boardDetails) {
          const boardTargets: Partial<Record<ColumnId, number>> = {};
          for (const [index, column] of (board.columns ?? []).entries()) {
            const columnId = getColumnId(column, index);
            boardTargets[columnId] ??= column.id;
            for (const apiTask of column.tasks ?? []) {
              nextColumns[columnId].push(mapTask(apiTask, board.id));
            }
          }
          nextTargets[board.id] = boardTargets;
        }

        setColumns(nextColumns);
        setTargets(nextTargets);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load tasks.");
          setColumns(EMPTY_COLUMNS);
          setTargets({});
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBoard();
    return () => {
      active = false;
    };
  }, [
    activeProjectId,
    projects,
    projectsWorkspaceId,
    reloadKey,
    selectedWorkspaceId,
  ]);

  const findContainer = (id: string | number): ColumnId | undefined => {
    if (id in columns) return id as ColumnId;
    return COLUMNS.find((column) =>
      columns[column.id].some((task) => task.id === id),
    )?.id;
  };

  const activeColumn = activeTask ? findContainer(activeTask.id) : undefined;

  function handleDragStart({ active }: DragStartEvent) {
    setError(null);
    const columnId = findContainer(active.id);
    setActiveTask(
      columnId
        ? columns[columnId].find((task) => task.id === active.id) ?? null
        : null,
    );
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;

    setColumns((previous) => {
      const fromItems = previous[from];
      const toItems = previous[to];
      const task = fromItems.find((item) => item.id === active.id);
      if (!task) return previous;

      let newIndex = toItems.length;
      if (over.id in previous) {
        newIndex = toItems.length;
      } else {
        const overIndex = toItems.findIndex((item) => item.id === over.id);
        const translated = active.rect.current.translated;
        const isBelow =
          !!translated && translated.top > over.rect.top + over.rect.height / 2;
        newIndex = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : toItems.length;
      }

      return {
        ...previous,
        [from]: fromItems.filter((item) => item.id !== active.id),
        [to]: [...toItems.slice(0, newIndex), task, ...toItems.slice(newIndex)],
      };
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    const task = activeTask;
    setActiveTask(null);
    setError(null);
    if (!task || !over) {
      setReloadKey((key) => key + 1);
      return;
    }

    const destination = findContainer(over.id);
    if (!destination) return;

    const targetColumnId = targets[task.boardId]?.[destination];
    if (!targetColumnId) {
      setError("This board does not have a column for that status.");
      setReloadKey((key) => key + 1);
      return;
    }

    let reordered = columns[destination];
    const oldIndex = reordered.findIndex((item) => item.id === active.id);
    const overIndex = reordered.findIndex((item) => item.id === over.id);
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      reordered = arrayMove(reordered, oldIndex, overIndex);
      setColumns((previous) => ({ ...previous, [destination]: reordered }));
    }
    const taskIndex = reordered.findIndex((item) => item.id === active.id);
    const position = reordered
      .slice(0, taskIndex)
      .filter((item) => item.boardId === task.boardId).length;

    try {
      await apiRequest<ApiTask>(`/tasks/${task.id}/move/`, {
        method: "POST",
        body: JSON.stringify({ column: targetColumnId, position }),
      });
      setColumns((previous) => ({
        ...previous,
        [destination]: previous[destination].map((item) =>
          item.id === task.id ? { ...item, columnId: targetColumnId } : item,
        ),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not move task.");
      setReloadKey((key) => key + 1);
    }
  }

  async function addCard(columnId: ColumnId) {
    setError(null);
    const target = Object.entries(targets).find(
      ([, boardTargets]) => boardTargets[columnId] !== undefined,
    );
    if (!target) {
      setError("Create a project board before adding a card.");
      return;
    }

    const [boardId, boardTargets] = target;
    const column = boardTargets[columnId];
    if (!column) return;

    try {
      const created = await apiRequest<ApiTask>("/tasks/", {
        method: "POST",
        body: JSON.stringify({
          column,
          title: "Untitled task",
          description: "",
          priority: "medium",
        }),
      });
      setColumns((previous) => ({
        ...previous,
        [columnId]: [...previous[columnId], mapTask(created, Number(boardId))],
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create task.");
    }
  }

  const hasBoard = Object.values(targets).some(
    (boardTargets) => Object.keys(boardTargets).length > 0,
  );

  return (
    <div className="flex h-full flex-col">
      {error && (
        <p role="alert" className="border-b px-6 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && !hasBoard && (
        <p className="border-b px-6 py-2 text-sm text-muted-foreground">
          No boards are available in this workspace yet.
        </p>
      )}
      {loading ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">Loading tasks…</p>
      ) : (
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(event) => void handleDragEnd(event)}
          onDragCancel={() => {
            setActiveTask(null);
            setReloadKey((key) => key + 1);
          }}
        >
          <div className="flex min-h-0 flex-1 gap-6 overflow-x-auto p-6">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                dot={column.dot}
                tasks={columns[column.id]}
                canAddCard={Object.values(targets).some(
                  (boardTargets) => boardTargets[column.id] !== undefined,
                )}
                onAddCard={(id) => void addCard(id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && activeColumn ? (
              <TaskCard task={activeTask} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
