"use client";

import * as React from "react";
import { Circle, Columns3, List, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/board/kanban-board";

const TABS = [
  { value: "overview", label: "Overview", icon: Circle },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "list", label: "List", icon: List },
  { value: "table", label: "Table", icon: Table2 },
] as const;

export function BoardView({
  heading = "Task",
  description = "Short description will be placed here",
}: {
  heading?: string;
  description?: string;
}) {
  return (
    <Tabs defaultValue="board" className="h-full gap-0">
      <div className="border-b bg-background px-6 pt-5">
        <h2 className="text-2xl font-semibold">{heading}</h2>
        <p className="mt-1 text-base text-muted-foreground">{description}</p>

        <TabsList className="mt-6 h-auto gap-6 rounded-none bg-transparent p-0">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "-mb-px flex-none gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-lg font-medium shadow-none",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                "dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent",
              )}
            >
              <Icon className="size-5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="board" className="min-h-0 flex-1">
        <KanbanBoard />
      </TabsContent>

      {TABS.filter((t) => t.value !== "board").map((t) => (
        <TabsContent
          key={t.value}
          value={t.value}
          className="flex flex-1 items-center justify-center text-muted-foreground"
        >
          {t.label} view coming soon
        </TabsContent>
      ))}
    </Tabs>
  );
}
