from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .models import Role, WorkspaceMember

ROLE_RANK = {Role.MEMBER.value:1, Role.ADMIN.value:2, Role.OWNER.value:3}

def get_role(user,workspace):
    """Return the user's role string in the workspace if not a member -> Null"""
    return (
        WorkspaceMember.objects.filter(workspace=workspace,user=user)
        .values_list("role",flat=True)
        .first()
    )



def required_role(user,workspace,minimum = Role.MEMBER.value):
    role = get_role(user,workspace)
    if role is None or ROLE_RANK[role]< ROLE_RANK[minimum]:
        raise PermissionDenied("You do not have permission to perform this action.")
    return role


class WorkspacePermission(BasePermission):
    """
    Object-level check: the user must belong to the object's workspace.
    Views can raise the bar per action via `admin_actions` / `owner_actions`.
    """

    def has_object_permission(self, request, view, obj):
        action = getattr(view, "action", None)
        if action in getattr(view, "owner_actions", ()):
            minimum = Role.OWNER.value
        elif action in getattr(view, "admin_actions", ()):
            minimum = Role.ADMIN.value
        else:
            minimum = Role.MEMBER.value
        role = get_role(request.user, obj.get_workspace())
        return role is not None and ROLE_RANK[role] >= ROLE_RANK[minimum]