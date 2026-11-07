export type ColumnId = "todo" | "in-progress" | "done";
export type Priority = "Low" | "Medium" | "High";
export type Platform = "UI/UX" | "ANDROID" | "IOS";

export interface Assignee {
  initials: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  platform: Platform;
  priority: Priority;
  dueDate: string;
  subtasks: { done: number; total: number };
  assignees: Assignee[];
  comments: number;
  links: number;
  files: { done: number; total: number };
}

export const COLUMNS: { id: ColumnId; title: string; dot: string }[] = [
  { id: "todo", title: "TODO", dot: "bg-orange-500" },
  { id: "in-progress", title: "IN PROGRESS", dot: "bg-blue-500" },
  { id: "done", title: "DONE", dot: "bg-green-500" },
];

export const ASSIGNEES: Assignee[] = [
  { initials: "J", color: "bg-pink-500" },
  { initials: "R", color: "bg-green-500" },
  { initials: "A", color: "bg-rose-500" },
  { initials: "O", color: "bg-cyan-400" },
];

export function createTask(
  partial: Partial<Task> & Pick<Task, "id" | "title" | "platform" | "priority">,
): Task {
  return {
    dueDate: "Jun 4, 2026",
    subtasks: { done: 0, total: 5 },
    assignees: ASSIGNEES,
    comments: 4,
    links: 4,
    files: { done: 0, total: 4 },
    ...partial,
  };
}

export const INITIAL_COLUMNS: Record<ColumnId, Task[]> = {
  todo: [
    createTask({
      id: "t1",
      title: "Verify Timely Payment of Property Taxes for All Properties",
      platform: "UI/UX",
      priority: "Medium",
    }),
    createTask({
      id: "t2",
      title: "Verify All Income Tax Payments Are Current",
      platform: "UI/UX",
      priority: "High",
    }),
    createTask({
      id: "t3",
      title: "Collect Recent Bank Statements for All Team Members (Last 90 Days)",
      platform: "UI/UX",
      priority: "Low",
      subtasks: { done: 1, total: 5 },
    }),
  ],
  "in-progress": [
    createTask({
      id: "t4",
      title: "Authenticate Employment Status for All Team Members",
      platform: "ANDROID",
      priority: "High",
      subtasks: { done: 1, total: 5 },
    }),
    createTask({
      id: "t5",
      title: "Check for Timely Income Tax Payments for All Employees",
      platform: "ANDROID",
      priority: "Medium",
      subtasks: { done: 3, total: 5 },
    }),
    createTask({
      id: "t6",
      title: "Mobile Development Phase: Task Overview and Requirements",
      platform: "IOS",
      priority: "Low",
      subtasks: { done: 2, total: 5 },
    }),
  ],
  done: [
    createTask({
      id: "t7",
      title: "Confirm Timely Payment of Property Taxes for All Properties",
      platform: "IOS",
      priority: "Low",
      subtasks: { done: 5, total: 5 },
    }),
    createTask({
      id: "t8",
      title: "Authenticate Employment Status for All Team Members",
      platform: "ANDROID",
      priority: "High",
      subtasks: { done: 5, total: 5 },
    }),
    createTask({
      id: "t9",
      title: "Ensure All Property Tax Payments Are Up to Date",
      platform: "IOS",
      priority: "Medium",
      subtasks: { done: 5, total: 5 },
    }),
  ],
};