from django.contrib.auth import get_user_model
from django.db.models import Count, OuterRef, Prefetch, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Activity,
    Board,
    Column,
    Comment,
    Label,
    Notification,
    Project,
    Role,
    Task,
    TaskAssignee,
    TaskLabel,
    Workspace,
    WorkspaceMember,
)
from .permissions import ROLE_RANK, WorkspacePermission, get_role, require_role
from .serializers import (
    ActivitySerializer,
    AddMemberSerializer,
    BoardDetailSerializer,
    BoardSerializer,
    ColumnSerializer,
    CommentSerializer,
    LabelIdSerializer,
    LabelSerializer,
    MemberRoleSerializer,
    NotificationSerializer,
    ProjectSerializer,
    TaskMoveSerializer,
    TaskSerializer,
    UserIdSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)
from .services import (
    log_activity,
    move_task,
    notify,
    sync_assignees,
    sync_labels,
    validate_label_ids,
    write_positions,
)

User = get_user_model()

OWNER = Role.OWNER.value
ADMIN = Role.ADMIN.value
TASK_WORKSPACE = "column__board__project__workspace"


class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def int_param(request,name):
    raw = request.query_params.get(name)

    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        raise ValidationError({name: "Must be an integer"})



def date_param(request, name):
    raw = request.query_params.get(name)
    if not raw:
        return None
    parsed = parse_date(raw)
    if parsed is None:
        raise ValidationError({name: "Use the format YYYY-MM-DD."})
    return parsed



class WorkspaceScopedMixin:
    """Restrict a viewset to rows that live in workspace the restester belongs to ."""

    permission_classes = [IsAuthenticated, WorkspacePermission]
    workspace_lookup=""


    def get_queryset(self):
        queryset= super().get_queryset()
        key = f"{self.workspace_lookup}__member__user" if self.workspace_lookup else "members__user"

        return queryset.filter(**{key: self.request.user})

def task_queryset():
    return (
        Task.objects.select_related("column__board__project__workspace", "created_by")
        .prefetch_related("assignees", "labels")
        .annotate(comment_count=Count("comments", distinct=True))
        .order_by("position", "id")  # Meta.ordering is ignored on aggregate queries
    )



