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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  apiRequest,
  type ApiTask,
  type Board,
  type BoardColumn,
  type Project,
  type WorkspaceMember,
} from "@/lib/api";

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
const API_PRIORITIES: Record<Priority, ApiTask["priority"]> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
};
const PRIORITY_OPTIONS: Priority[] = ["Low", "Medium", "High", "Urgent"];

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

async function ensureProjectColumns(
  project: Project,
): Promise<{ boardId: number; columns: Record<ColumnId, number> }> {
  let boards = await apiRequest<Board[]>(`/boards/?project=${project.id}`);
  if (boards.length === 0) {
    const board = await apiRequest<Board>("/boards/", {
      method: "POST",
      body: JSON.stringify({
        project: project.id,
        name: project.name,
        create_default_columns: true,
      }),
    });
    boards = [board];
  }

  const firstBoard = boards[0];
  if (!firstBoard) {
    throw new Error("Could not create or find a board for this project.");
  }
  const board = await apiRequest<Board>(`/boards/${firstBoard.id}/`);
  const columns: Partial<Record<ColumnId, number>> = {};
  for (const [index, column] of (board.columns ?? []).entries()) {
    const columnId = getColumnId(column, index);
    columns[columnId] ??= column.id;
  }

  const defaultColumnNames: Record<ColumnId, string> = {
    todo: "To Do",
    "in-progress": "In Progress",
    done: "Done",
  };
  for (const { id } of COLUMNS) {
    if (columns[id] !== undefined) continue;
    const column = await apiRequest<BoardColumn>("/columns/", {
      method: "POST",
      body: JSON.stringify({
        board: board.id,
        name: defaultColumnNames[id],
      }),
    });
    columns[id] = column.id;
  }

  if (
    columns.todo === undefined ||
    columns["in-progress"] === undefined ||
    columns.done === undefined
  ) {
    throw new Error("Could not create the required project board columns.");
  }

  return {
    boardId: board.id,
    columns: {
      todo: columns.todo,
      "in-progress": columns["in-progress"],
      done: columns.done,
    },
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
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [editDraft, setEditDraft] = React.useState<{
    title: string;
    description: string;
    priority: Priority;
    dueDate: string;
    assigneeIds: number[];
  } | null>(null);
  const [savingTask, setSavingTask] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = React.useState<WorkspaceMember[]>([]);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [membersLoading, setMembersLoading] = React.useState(false);
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
    async function loadWorkspaceMembers() {
      setWorkspaceMembers([]);
      setMembersError(null);
      if (!selectedWorkspaceId) {
        setMembersLoading(false);
        return;
      }
      setMembersLoading(true);
      try {
        const members = await apiRequest<WorkspaceMember[]>(
          `/workspaces/${selectedWorkspaceId}/members/`,
        );
        if (active) setWorkspaceMembers(members);
      } catch (reason) {
        if (active) {
          setMembersError(
            reason instanceof Error ? reason.message : "Could not load workspace members.",
          );
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    }
    void loadWorkspaceMembers();
    return () => {
      active = false;
    };
  }, [selectedWorkspaceId]);

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
    try {
      let boardId: number;
      let column = target?.[1][columnId];
      if (target && column !== undefined) {
        boardId = Number(target[0]);
      } else {
        const project = projects.find((item) => item.id === activeProjectId);
        if (!project) {
          throw new Error("Select a project before adding a card.");
        }
        const ensured = await ensureProjectColumns(project);
        boardId = ensured.boardId;
        column = ensured.columns[columnId];
        setTargets((previous) => ({
          ...previous,
          [ensured.boardId]: ensured.columns,
        }));
      }

      if (column === undefined) {
        throw new Error("Could not find a board column for this card.");
      }

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
        [columnId]: [...previous[columnId], mapTask(created, boardId)],
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create task.");
    }
  }

  function editCard(task: Task) {
    setEditingTask(task);
    setEditDraft({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      assigneeIds: task.assignees.map((assignee) => assignee.id),
    });
    setEditError(null);
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask || !editDraft) return;

    setSavingTask(true);
    setEditError(null);
    try {
      const saved = await apiRequest<ApiTask>(`/tasks/${editingTask.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editDraft.title.trim(),
          description: editDraft.description.trim(),
          priority: API_PRIORITIES[editDraft.priority],
          due_date: editDraft.dueDate || null,
          assignee_ids: editDraft.assigneeIds,
        }),
      });
      const updatedTask = mapTask(saved, editingTask.boardId);
      setColumns((previous) => ({
        todo: previous.todo.map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        ),
        "in-progress": previous["in-progress"].map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        ),
        done: previous.done.map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        ),
      }));
      setEditingTask(null);
      setEditDraft(null);
    } catch (reason) {
      setEditError(
        reason instanceof Error ? reason.message : "Could not save task.",
      );
    } finally {
      setSavingTask(false);
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
          No board is available for this project yet. Add a card to create one.
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
                onAddCard={(id) => void addCard(id)}
                onEditCard={editCard}
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
      <Dialog
        open={editingTask !== null}
        onOpenChange={(open) => {
          if (!open && !savingTask) {
            setEditingTask(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update the task details. Changes are saved to the project board.
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <form className="space-y-4" onSubmit={(event) => void saveTask(event)}>
              <label className="block space-y-2 text-sm font-medium">
                Title
                <Input
                  required
                  maxLength={255}
                  autoFocus
                  value={editDraft.title}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, title: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Description
                <Textarea
                  rows={4}
                  value={editDraft.description}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Priority
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={editDraft.priority}
                  onChange={(event) => {
                    const priority = PRIORITY_OPTIONS.find(
                      (option) => option === event.target.value,
                    );
                    if (priority) setEditDraft({ ...editDraft, priority });
                  }}
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Due date
                <Input
                  type="date"
                  value={editDraft.dueDate}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, dueDate: event.target.value })
                  }
                />
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Assign to</legend>
                {membersLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading workspace members…
                  </p>
                ) : membersError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {membersError}
                  </p>
                ) : workspaceMembers.length ? (
                  <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {workspaceMembers.map(({ user }) => (
                      <label key={user.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editDraft.assigneeIds.includes(user.id)}
                          onChange={(event) => {
                            const assigneeIds = event.target.checked
                              ? [...editDraft.assigneeIds, user.id]
                              : editDraft.assigneeIds.filter((id) => id !== user.id);
                            setEditDraft({ ...editDraft, assigneeIds });
                          }}
                        />
                        <span className="truncate">
                          {user.full_name || user.email}
                          <span className="ml-2 text-muted-foreground">
                            {user.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No workspace members are available.
                  </p>
                )}
              </fieldset>
              {editError && (
                <p role="alert" className="text-sm text-destructive">
                  {editError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingTask}
                  onClick={() => {
                    setEditingTask(null);
                    setEditDraft(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingTask || !editDraft.title.trim()}
                >
                  {savingTask ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
