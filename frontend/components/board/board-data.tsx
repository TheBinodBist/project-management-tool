import type { ApiUser } from "@/lib/api";

export type ColumnId = "todo" | "in-progress" | "done";
export type Priority = "Low" | "Medium" | "High" | "Urgent";

export interface Assignee extends ApiUser {
  initials: string;
  color: string;
}

export interface TaskLabel {
  id: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  columnId: number;
  boardId: number;
  assignees: Assignee[];
  labels: TaskLabel[];
  comments: number;
}

export const COLUMNS: { id: ColumnId; title: string; dot: string }[] = [
  { id: "todo", title: "TODO", dot: "bg-orange-500" },
  { id: "in-progress", title: "IN PROGRESS", dot: "bg-blue-500" },
  { id: "done", title: "DONE", dot: "bg-green-500" },
];
