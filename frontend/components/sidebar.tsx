"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronsUpDown,
  Command,
  FolderClosed,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
  MoreHorizontal,
  PanelLeftClose,
  CircleHelp,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
};

type Project = {
  name: string;
  href: string;
  color: string;
  badge?: number;
};

type ProjectGroup = {
  name: string;
  children: Project[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Inbox", icon: Inbox, href: "/inbox", badge: 5 },
  { label: "Team", icon: Users, href: "/team" },
];

const PROJECT_GROUPS: ProjectGroup[] = [
  {
    name: "Mobile App",
    children: [
      {
        name: "Finance App",
        href: "/projects/finance-app",
        color: "bg-blue-500",
        badge: 2,
      },
      {
        name: "Real Estate App",
        href: "/projects/real-estate-app",
        color: "bg-violet-500",
        badge: 8,
      },
      {
        name: "Fitness App",
        href: "/projects/fitness-app",
        color: "bg-emerald-500",
        badge: 2,
      },
    ],
  },
  {
    name: "Website Development",
    children: [
      {
        name: "Company Website",
        href: "/projects/company-website",
        color: "bg-orange-500",
      },
    ],
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <Badge
      variant="secondary"
      className="ml-auto h-5 min-w-5 justify-center rounded-md px-1.5 text-[10px] font-semibold"
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

  const Icon = item.icon;

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "h-10 w-full justify-start gap-3 rounded-lg px-3 text-sm font-medium",
        active
          ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Link href={item.href}>
        <Icon className="size-[18px]" />
        <span>{item.label}</span>
        {item.badge !== undefined && <CountBadge count={item.badge} />}
      </Link>
    </Button>
  );
}

function WorkspaceSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between rounded-xl p-2 hover:bg-muted"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Command className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                Project Workspace
              </p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Command className="mr-2 size-4" />
          Project Workspace
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Plus className="mr-2 size-4" />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="mr-2 size-4" />
          Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectFolder({
  group,
  pathname,
  search,
}: {
  group: ProjectGroup;
  pathname: string;
  search: string;
}) {
  const hasActiveProject = group.children.some(
    (project) =>
      pathname === project.href || pathname.startsWith(`${project.href}/`),
  );

  const filteredProjects = group.children.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase()),
  );

  const [open, setOpen] = React.useState(hasActiveProject);

  React.useEffect(() => {
    if (hasActiveProject) setOpen(true);
  }, [hasActiveProject]);

  if (search && filteredProjects.length === 0) return null;

  const FolderIcon = open ? FolderOpen : FolderClosed;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group h-9 w-full justify-start gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <FolderIcon className="size-4" />
          <span className="truncate">{group.name}</span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 transition-transform",
              !open && "-rotate-90",
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-3 space-y-1 border-l pl-3 pt-1">
          {filteredProjects.map((project) => {
            const active =
              pathname === project.href ||
              pathname.startsWith(`${project.href}/`);

            return (
              <Button
                key={project.href}
                asChild
                variant="ghost"
                className={cn(
                  "h-9 w-full justify-start gap-2 rounded-lg px-2 text-sm",
                  active
                    ? "bg-primary/10 text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Link href={project.href}>
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      project.color,
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                  {project.badge !== undefined && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {project.badge}
                    </span>
                  )}
                </Link>
              </Button>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [search, setSearch] = React.useState("");

  return (
    <aside
      className={cn(
        "flex h-screen w-[270px] shrink-0 flex-col border-r bg-background",
        className,
      )}
    >
      {/* Workspace */}
      <div className="px-4 pb-4 pt-5">
        <WorkspaceSwitcher />

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-9 rounded-lg border-muted bg-muted/40 pl-9 text-sm focus-visible:bg-background"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            /
          </kbd>
        </div>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1 px-3">
        {/* Navigation */}
        <SectionLabel>Workspace</SectionLabel>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Projects */}
        <div className="flex items-center justify-between px-3 pb-2 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your Projects
          </p>

          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
          >
            <Link href="/projects/new" aria-label="Create project">
              <Plus className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-1">
          {PROJECT_GROUPS.map((group) => (
            <ProjectFolder
              key={group.name}
              group={group}
              pathname={pathname}
              search={search}
            />
          ))}
        </div>

        {/* Create project */}
        <Button
          asChild
          variant="outline"
          className="mt-4 h-9 w-full justify-start gap-2 rounded-lg border-dashed text-sm text-muted-foreground"
        >
          <Link href="/projects/new">
            <Plus className="size-4" />
            Create new project
          </Link>
        </Button>

        {search && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Search results for "{search}"
          </p>
        )}
      </ScrollArea>

      <Separator />

      {/* Bottom navigation */}
      <div className="space-y-1 px-3 py-3">
        <Button
          asChild
          variant="ghost"
          className="h-9 w-full justify-start gap-3 rounded-lg px-3 text-sm text-muted-foreground"
        >
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className="h-9 w-full justify-start gap-3 rounded-lg px-3 text-sm text-muted-foreground"
        >
          <Link href="/help">
            <CircleHelp className="size-4" />
            Help & Support
          </Link>
        </Button>
      </div>

      <Separator />

      {/* User profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-none px-4 py-4"
          >
            <Avatar className="size-9">
              <AvatarImage src="/avatars/michael.png" />
              <AvatarFallback>MS</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold">Michael Smith</p>
              <p className="truncate text-xs text-muted-foreground">
                michaelsmith12@gmail.com
              </p>
            </div>

            <MoreHorizontal className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <Users className="mr-2 size-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}

export default Sidebar;
