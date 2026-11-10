"use client";

import * as React from "react";
import {
  ChevronRight,
  Circle,
  CircleHelp,
  Columns3,
  List,
  Search,
  Table2,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "overview", label: "Overview", icon: Circle },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "list", label: "List", icon: List },
  { value: "table", label: "Table", icon: Table2 },
] as const;

export type ViewTab = (typeof TABS)[number]["value"];

const MEMBERS = [
  { initials: "JD", color: "bg-pink-500" },
  { initials: "RK", color: "bg-green-500" },
  { initials: "AM", color: "bg-violet-500" },
  { initials: "OL", color: "bg-cyan-500" },
];

interface NavbarProps {
  breadcrumb?: string[];
  title?: string;
  heading?: string;
  description?: string;
  activeTab?: ViewTab;
  onTabChange?: (tab: ViewTab) => void;
  extraMembers?: number;
  className?: string;
}

export function Navbar({
  breadcrumb,
  title,
  heading = "Task",
  description = "Short description will be placed here",
  activeTab = "board",
  onTabChange,
  extraMembers = 11,
  className,
}: NavbarProps) {
  const pathname = usePathname();
  const { projects, selectedWorkspace } = useApp();
  const projectId = pathname.match(/^\/projects\/(\d+)$/)?.[1];
  const activeProject = projects.find(
    (project) => project.id === Number(projectId),
  );
  const activeBreadcrumb =
    breadcrumb ??
    (activeProject
      ? [selectedWorkspace?.name ?? "Projects", activeProject.name]
      : selectedWorkspace
        ? ["Projects", selectedWorkspace.name]
        : ["Projects"]);
  const activeTitle =
    title ?? activeProject?.name ?? selectedWorkspace?.name ?? "Projects";

  return (
    <header className={cn("bg-background", className)}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-6 border-b px-6 py-4">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {activeBreadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb}>
                {i > 0 && <ChevronRight className="size-3.5" />}
                <span
                  className={cn(i === activeBreadcrumb.length - 1 && "text-foreground")}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">
            {activeTitle}
          </h1>
        </div>

        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Find task..."
            className="h-12 rounded-xl pl-10 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full border bg-background py-1.5 pl-2 pr-1.5 shadow-sm">
            <div className="flex items-center -space-x-2">
              {MEMBERS.map((m) => (
                <Avatar key={m.initials} className="size-8 border-2 border-background">
                  <AvatarFallback
                    className={cn("text-[11px] font-semibold text-white", m.color)}
                  >
                    {m.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
              <Avatar className="size-8 border-2 border-background">
                <AvatarFallback className="bg-muted text-xs font-semibold text-primary">
                  +{extraMembers}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button className="h-9 rounded-full px-5 shadow-md shadow-primary/30">
              Share
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Help"
            className="size-10 rounded-full"
          >
            <CircleHelp className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;