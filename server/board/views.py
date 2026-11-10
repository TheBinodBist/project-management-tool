from django.contrib.auth import get_user_model
from django.db.models import Count, OuterRef, Prefetch, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Activity,
    ActivityAction,
    Board,
    Column,
    Comment,
    Label,
    Notification,
    NotificationKind,
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

def int_param(request, name):
    raw = request.query_params.get(name)

    if raw in (None, ""):
        return None

    try:
        return int(raw)
    except ValueError:
        raise ValidationError({name: "Must be an integer"})


def task_queryset():
    return (
        Task.objects.select_related("column__board__project__workspace", "created_by")
        .prefetch_related("assignees", "labels")
        .annotate(comment_count=Count("comments", distinct=True))
    )

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def workspace_list_create(request):

    if request.method == "GET":
        user = request.user

        my_role = WorkspaceMember.objects.filter(
            workspace=OuterRef("pk"),
            user=user
        ).values("role")[:1]

        workspaces = (
            Workspace.objects.filter(
                pk__in=WorkspaceMember.objects.filter(
                    user=user
                ).values("workspace_id")
            )
            .annotate(
                my_role=Subquery(my_role),
                member_count=Count("members")
            )
            .order_by("name")
        )

        serializer = WorkspaceSerializer(
            workspaces,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)

    serializer = WorkspaceSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    workspace = serializer.save()

    WorkspaceMember.objects.create(
        workspace=workspace,
        user=request.user,
        role=OWNER
    )

    return Response(
        WorkspaceSerializer(workspace, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )



@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def workspace_detail(request, pk):

    workspace = get_object_or_404(
        Workspace.objects.filter(
            members__user=request.user
        ).distinct(),
        pk=pk
    )

    if request.method == "GET":
        return Response(
            WorkspaceSerializer(workspace, context={"request": request}).data
        )

    if request.method in ["PUT", "PATCH"]:

        require_role(request.user, workspace, ADMIN)

        serializer = WorkspaceSerializer(
            workspace,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    if request.method == "DELETE":

        require_role(request.user, workspace, OWNER)

        workspace.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def workspace_members(request, pk):

    workspace = get_object_or_404(
        Workspace.objects.filter(members__user=request.user),
        pk=pk
    )

    if request.method == "GET":

        members = workspace.members.select_related(
            "user"
        ).order_by("joined_date", "id")

        serializer = WorkspaceMemberSerializer(
            members,
            many=True
        )

        return Response(serializer.data)

    my_role = require_role(request.user, workspace, ADMIN)

    serializer = AddMemberSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    role = serializer.validated_data["role"]

    if role == OWNER and my_role != OWNER:
        raise PermissionDenied(
            "Only an owner can grant the owner role."
        )

    user = User.objects.filter(email__iexact=email).first()

    if user is None:
        raise ValidationError({
            "email": "No registered user with this email."
        })

    member, created = WorkspaceMember.objects.get_or_create(
        workspace=workspace,
        user=user,
        defaults={"role": role}
    )

    if not created:
        raise ValidationError(
            {"email": "This user is already a member."}
        )

    return Response(
        WorkspaceMemberSerializer(member).data,
        status=status.HTTP_201_CREATED
    )



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def project_list_create(request):

    if request.method == "GET":

        projects = Project.objects.filter(
            workspace__members__user=request.user
        ).select_related("workspace", "created_by")

        workspace = int_param(request, "workspace")

        if workspace is not None:
            projects = projects.filter(workspace_id=workspace)

        archived = request.query_params.get("archived")

        if archived is not None:
            projects = projects.filter(
                is_archived=archived.lower() in ("1", "true", "yes")
            )

        return Response(
            ProjectSerializer(projects, many=True).data
        )

    serializer = ProjectSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    project = serializer.save(created_by=request.user)

    return Response(
        ProjectSerializer(project).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def board_list_create(request):

    if request.method == "GET":

        boards = Board.objects.filter(
            project__workspace__members__user=request.user
        ).select_related("project__workspace")

        project = int_param(request, "project")

        if project is not None:
            boards = boards.filter(project_id=project)

        return Response(
            BoardSerializer(boards, many=True).data
        )

    serializer = BoardSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    board = serializer.save()

    return Response(
        BoardSerializer(board).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def board_detail(request, pk):

    board = get_object_or_404(
        Board.objects.filter(
            project__workspace__members__user=request.user
        ),
        pk=pk
    )

    if request.method == "GET":

        board = Board.objects.prefetch_related(
            Prefetch(
                "columns",
                queryset=Column.objects.prefetch_related(
                    Prefetch(
                        "tasks",
                        queryset=task_queryset().select_related(None)
                    )
                )
            )
        ).get(pk=board.pk)

        return Response(
            BoardDetailSerializer(board).data
        )

    if request.method in ["PUT", "PATCH"]:

        serializer = BoardSerializer(
            board,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    board.delete()

    return Response(status=status.HTTP_204_NO_CONTENT)



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def column_list_create(request):

    if request.method == "GET":

        columns = Column.objects.filter(
            board__project__workspace__members__user=request.user
        ).select_related("board__project__workspace")

        board = int_param(request, "board")

        if board is not None:
            columns = columns.filter(board_id=board)

        return Response(
            ColumnSerializer(columns, many=True).data
        )

    serializer = ColumnSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    column = serializer.save()

    return Response(
        ColumnSerializer(column).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def column_detail(request, pk):

    column = get_object_or_404(
        Column.objects.filter(
            board__project__workspace__members__user=request.user
        ),
        pk=pk
    )

    if request.method in ["GET", "PUT", "PATCH"]:

        if request.method == "GET":
            return Response(ColumnSerializer(column).data)

        serializer = ColumnSerializer(
            column,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    force = request.query_params.get(
        "force", ""
    ).lower() in ("1", "true", "yes")

    if column.tasks.exists() and not force:
        raise ValidationError(
            "This column still has tasks. Move them first, "
            "or pass ?force=true to delete them too."
        )

    board = column.board
    column.delete()

    write_positions(
        Column,
        list(board.columns.values_list("pk", flat=True))
    )

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def label_list_create(request):

    if request.method == "GET":

        labels = Label.objects.filter(
            workspace__members__user=request.user
        ).select_related("workspace")

        workspace = int_param(request, "workspace")

        if workspace is not None:
            labels = labels.filter(workspace_id=workspace)

        return Response(
            LabelSerializer(labels, many=True).data
        )

    serializer = LabelSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    label = serializer.save()

    return Response(
        LabelSerializer(label).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, WorkspacePermission])
def label_detail(request, pk):

    label = get_object_or_404(
        Label.objects.filter(
            workspace__members__user=request.user
        ),
        pk=pk
    )

    if request.method == "GET":
        return Response(LabelSerializer(label).data)

    if request.method in ["PUT", "PATCH"]:

        serializer = LabelSerializer(
            label,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    label.delete()

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):
    project = get_object_or_404(
        Project.objects.filter(workspace__members__user=request.user),
        pk=pk,
    )

    if request.method == "GET":
        return Response(ProjectSerializer(project).data)

    require_role(request.user, project.workspace, ADMIN)

    if request.method in ["PUT", "PATCH"]:
        serializer = ProjectSerializer(
            project,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    project.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def board_reorder_columns(request, pk):
    board = get_object_or_404(
        Board.objects.filter(project__workspace__members__user=request.user),
        pk=pk,
    )
    column_ids = request.data.get("column_ids")
    if not isinstance(column_ids, list) or any(
        not isinstance(column_id, int) or isinstance(column_id, bool)
        for column_id in column_ids
    ):
        raise ValidationError({"column_ids": "Provide a list of column IDs."})

    current_ids = set(board.columns.values_list("pk", flat=True))
    if len(column_ids) != len(set(column_ids)) or set(column_ids) != current_ids:
        raise ValidationError(
            {"column_ids": "Provide each column on this board exactly once."}
        )

    write_positions(Column, column_ids)
    return Response(
        ColumnSerializer(
            board.columns.order_by("position", "id"),
            many=True,
        ).data
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_list_create(request):
    if request.method == "GET":
        tasks = task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        )
        for name, field in (
            ("workspace", "column__board__project__workspace_id"),
            ("project", "column__board__project_id"),
            ("board", "column__board_id"),
            ("column", "column_id"),
        ):
            value = int_param(request, name)
            if value is not None:
                tasks = tasks.filter(**{field: value})

        assignee = int_param(request, "assignee")
        if assignee is not None:
            tasks = tasks.filter(assignees__id=assignee)

        label = int_param(request, "label")
        if label is not None:
            tasks = tasks.filter(labels__id=label)

        priority = request.query_params.get("priority")
        if priority:
            tasks = tasks.filter(priority=priority)

        return Response(TaskSerializer(tasks.distinct(), many=True).data)

    serializer = TaskSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    task = serializer.save()
    return Response(
        TaskSerializer(task, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def task_detail(request, pk):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )

    if request.method == "GET":
        return Response(TaskSerializer(task, context={"request": request}).data)

    require_role(request.user, task.get_workspace(), ADMIN)

    if request.method in ["PUT", "PATCH"]:
        serializer = TaskSerializer(
            task,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(TaskSerializer(task, context={"request": request}).data)

    task.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def task_move(request, pk):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )
    serializer = TaskMoveSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    target_column = serializer.validated_data["column"]
    if target_column.get_workspace().pk != task.get_workspace().pk:
        raise ValidationError({"column": "The target column must be in the same workspace."})
    task = move_task(
        task,
        target_column,
        serializer.validated_data.get("position"),
        request.user,
    )
    return Response(TaskSerializer(task, context={"request": request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_assignees(request, pk):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )

    if request.method == "GET":
        return Response(
            TaskSerializer(task, context={"request": request}).data["assignees"]
        )

    serializer = UserIdSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user_id = serializer.validated_data["user_id"]
    current_ids = set(task.task_assignees.values_list("user_id", flat=True))
    current_ids.add(user_id)
    sync_assignees(task, current_ids, request.user)
    task.refresh_from_db()
    return Response(
        TaskSerializer(task, context={"request": request}).data["assignees"]
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def task_assignee_detail(request, pk, user_id):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )
    if not task.task_assignees.filter(user_id=user_id).exists():
        raise ValidationError({"user_id": "This user is not assigned to the task."})

    current_ids = set(task.task_assignees.values_list("user_id", flat=True))
    current_ids.remove(user_id)
    sync_assignees(task, current_ids, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_labels(request, pk):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )

    if request.method == "GET":
        return Response(TaskSerializer(task, context={"request": request}).data["labels"])

    serializer = LabelIdSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    label_ids = set(task.task_labels.values_list("label_id", flat=True))
    label_ids.add(serializer.validated_data["label_id"])
    sync_labels(task, label_ids, request.user)
    task.refresh_from_db()
    return Response(TaskSerializer(task, context={"request": request}).data["labels"])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def task_label_detail(request, pk, label_id):
    task = get_object_or_404(
        task_queryset().filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )
    if not task.task_labels.filter(label_id=label_id).exists():
        raise ValidationError({"label_id": "This label is not on the task."})

    label_ids = set(task.task_labels.values_list("label_id", flat=True))
    label_ids.remove(label_id)
    sync_labels(task, label_ids, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_comments(request, pk):
    task = get_object_or_404(
        Task.objects.filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )

    if request.method == "GET":
        comments = task.comments.select_related("author")
        return Response(CommentSerializer(comments, many=True).data)

    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    comment = serializer.save(task=task, author=request.user)
    activity = log_activity(task, request.user, ActivityAction.COMMENTED.value)
    notify(
        task.task_assignees.values_list("user_id", flat=True),
        request.user,
        task,
        NotificationKind.COMMENT.value,
        f'{request.user.full_name or request.user.email} commented on "{task.title}"',
        activity,
    )
    return Response(
        CommentSerializer(comment).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_activity(request, pk):
    task = get_object_or_404(
        Task.objects.filter(
            column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )
    activities = task.activities.select_related("actor")
    return Response(ActivitySerializer(activities, many=True).data)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def comment_detail(request, pk):
    comment = get_object_or_404(
        Comment.objects.filter(
            task__column__board__project__workspace__members__user=request.user
        ),
        pk=pk,
    )

    if request.method == "GET":
        return Response(CommentSerializer(comment).data)

    if comment.author_id != request.user.pk:
        raise PermissionDenied("Only the comment author can change this comment.")

    if request.method in ["PUT", "PATCH"]:
        serializer = CommentSerializer(
            comment,
            data=request.data,
            partial=request.method == "PATCH",
        )
        serializer.is_valid(raise_exception=True)
        return Response(CommentSerializer(serializer.save()).data)

    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_list(request):
    activities = Activity.objects.filter(
        task__column__board__project__workspace__members__user=request.user
    ).select_related("actor", "task")
    task_id = int_param(request, "task")
    if task_id is not None:
        activities = activities.filter(task_id=task_id)
    return Response(ActivitySerializer(activities, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    notifications = Notification.objects.filter(user=request.user).select_related(
        "actor", "task"
    )
    unread = request.query_params.get("unread")
    if unread is not None:
        notifications = notifications.filter(
            is_read=unread.lower() not in ("1", "true", "yes")
        )
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def notification_detail(request, pk):
    notification = get_object_or_404(Notification, pk=pk, user=request.user)

    if request.method == "GET":
        return Response(NotificationSerializer(notification).data)

    if request.method == "PATCH":
        is_read = request.data.get("is_read")
        if not isinstance(is_read, bool):
            raise ValidationError({"is_read": "Must be a boolean."})
        notification.is_read = is_read
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)

    notification.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notification_read(request, pk):
    notification = get_object_or_404(Notification, pk=pk, user=request.user)
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notification_read_all(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({"count": count})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def workspace_member_detail(request, pk, user_id):
    workspace = get_object_or_404(
        Workspace.objects.filter(members__user=request.user),
        pk=pk,
    )

    require_role(
        request.user,
        workspace,
        minimum=ADMIN,
    )

    member = get_object_or_404(
        WorkspaceMember,
        user_id=user_id,
        workspace=workspace,
    )

    # Prevent an admin from removing the workspace owner
    if member.role == OWNER:
        return Response(
            {"detail": "The workspace owner cannot be removed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member.delete()

    return Response(status=status.HTTP_204_NO_CONTENT)