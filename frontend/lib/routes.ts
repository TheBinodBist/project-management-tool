export function workspaceProjectPath(workspaceSlug: string, projectId: number) {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/project/${projectId}`;
}
