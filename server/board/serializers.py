from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    Activity,
    ActivityAction,
    Board,
    Column,
    Comment,
    Label,
    Notification,
    Project,
    Role,
    Task,
    Workspace,
    WorkspaceMember,
)
from .permissions import get_role
from .services import log_activity, next_position, sync_assignees, sync_labels

User = get_user_model()

DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"]


def scoped(lookup):
    """Build a queryset filter limiting rows to workspaces the user belongs to."""
    key = f"{lookup}__members__user" if lookup else "members__user"
    return lambda queryset, user: queryset.filter(**{key: user})



class ScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """
    PK field that only accepts objects from workspaces the requesting user belongs to,
    so outsiders get a plain "invalid pk" error and can't probe for existence.
    """

    def __init__(self, scope=None, **kwargs):
        self.scope = scope
        super().__init__(**kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return queryset.none()
        return self.scope(queryset, request.user) if self.scope else queryset


class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "avatar_url")



class WorkspaceSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "description", "my_role", "member_count", "created_at")
        read_only_fields = ("slug", "created_at")

    def get_my_role(self, obj):
        role = getattr(obj, "my_role", None)
        return role if role is not None else get_role(self.context["request"].user, obj)

    def get_member_count(self, obj):
        count = getattr(obj, "member_count", None)
        return count if count is not None else obj.members.count()



class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)
    joined_at = serializers.DateTimeField(source="joined_date", read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ("id", "user", "role", "joined_at")

class AddMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Role.choices, default=Role.MEMBER.value)


class MemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)


# projects -> boards -> columns


class ProjectSerializer(serializers.ModelSerializer):
    workspace = ScopedPrimaryKeyRelatedField(scope=scoped(""), queryset=Workspace.objects.all())
    created_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "workspace",
            "name",
            "description",
            "is_archived",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def update(self, instance, validated_data):
        validated_data.pop("workspace", None)  # a project can't move between workspaces
        return super().update(instance, validated_data)


class ColumnSerializer(serializers.ModelSerializer):
    board = ScopedPrimaryKeyRelatedField(
        scope=scoped("project__workspace"), queryset=Board.objects.all()
    )

    class Meta:
        model = Column
        fields = ("id", "board", "name", "position", "created_at")
        read_only_fields = ("position", "created_at")

    def create(self, validated_data):
        validated_data["position"] = next_position(validated_data["board"].columns.all())
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("board", None)
        return super().update(instance, validated_data)


class BoardSerializer(serializers.ModelSerializer):
    project = ScopedPrimaryKeyRelatedField(
        scope=scoped("workspace"), queryset=Project.objects.all()
    )
    create_default_columns = serializers.BooleanField(write_only=True, default=True)

    class Meta:
        model = Board
        fields = ("id", "project", "name", "position", "create_default_columns", "created_at")
        read_only_fields = ("position", "created_at")

    @transaction.atomic
    def create(self, validated_data):
        with_defaults = validated_data.pop("create_default_columns", True)
        validated_data["position"] = next_position(validated_data["project"].boards.all())
        board = super().create(validated_data)
        if with_defaults:
            Column.objects.bulk_create(
                [Column(board=board, name=n, position=i) for i, n in enumerate(DEFAULT_COLUMNS)]
            )
        return board

    def update(self, instance, validated_data):
        validated_data.pop("project", None)
        validated_data.pop("create_default_columns", None)
        return super().update(instance, validated_data)



# labels



class LabelMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ("id", "name", "color")


class LabelSerializer(serializers.ModelSerializer):
    workspace = ScopedPrimaryKeyRelatedField(scope=scoped(""), queryset=Workspace.objects.all())
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", required=False)

    class Meta:
        model = Label
        fields = ("id", "workspace", "name", "color")

    def validate(self, attrs):
        workspace = self.instance.workspace if self.instance else attrs["workspace"]
        name = attrs.get("name", self.instance.name if self.instance else None)
        duplicates = Label.objects.filter(workspace=workspace, name__iexact=name)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                {"name": "A label with this name already exists in this workspace."}
            )
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop("workspace", None)
        return super().update(instance, validated_data)

# tasks



class TaskSerializer(serializers.ModelSerializer):
    column = ScopedPrimaryKeyRelatedField(
        scope=scoped("board__project__workspace"), queryset=Column.objects.all()
    )
    assignees = UserMiniSerializer(many=True, read_only=True)
    labels = LabelMiniSerializer(many=True, read_only=True)
    assignee_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    label_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    created_by = UserMiniSerializer(read_only=True)
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "column",
            "title",
            "description",
            "priority",
            "due_date",
            "position",
            "assignees",
            "labels",
            "assignee_ids",
            "label_ids",
            "comment_count",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("position", "created_at", "updated_at")

    def get_comment_count(self, obj):
        count = getattr(obj, "comment_count", None)
        return count if count is not None else obj.comments.count()

    def validate(self, attrs):
        # `column` is only honoured on create; use POST /tasks/{id}/move/ to relocate.
        column = self.instance.column if self.instance else attrs.get("column")
        if column is not None:
            from .services import validate_label_ids, validate_member_ids

            workspace = column.get_workspace()
            if "assignee_ids" in attrs:
                validate_member_ids(workspace, attrs["assignee_ids"])
            if "label_ids" in attrs:
                validate_label_ids(workspace, attrs["label_ids"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        assignee_ids = validated_data.pop("assignee_ids", [])
        label_ids = validated_data.pop("label_ids", [])
        column = validated_data["column"]

        task = Task.objects.create(
            created_by=user, position=next_position(column.tasks.all()), **validated_data
        )
        log_activity(task, user, ActivityAction.CREATED.value, title=task.title)
        sync_assignees(task, assignee_ids, user)
        sync_labels(task, label_ids, user)
        return task

    @transaction.atomic
    def update(self, instance, validated_data):
        user = self.context["request"].user
        validated_data.pop("column", None)
        assignee_ids = validated_data.pop("assignee_ids", None)
        label_ids = validated_data.pop("label_ids", None)

        changed = [
            field
            for field in ("title", "description", "priority", "due_date")
            if field in validated_data and getattr(instance, field) != validated_data[field]
        ]
        instance = super().update(instance, validated_data)
        if changed:
            log_activity(instance, user, ActivityAction.UPDATED.value, fields=changed)
        if assignee_ids is not None:
            sync_assignees(instance, assignee_ids, user)
        if label_ids is not None:
            sync_labels(instance, label_ids, user)
        return instance


class ColumnWithTasksSerializer(ColumnSerializer):
    tasks = TaskSerializer(many=True, read_only=True)

    class Meta(ColumnSerializer.Meta):
        fields = ColumnSerializer.Meta.fields + ("tasks",)


class BoardDetailSerializer(BoardSerializer):
    columns = ColumnWithTasksSerializer(many=True, read_only=True)

    class Meta(BoardSerializer.Meta):
        fields = BoardSerializer.Meta.fields + ("columns",)


class TaskMoveSerializer(serializers.Serializer):
    column = ScopedPrimaryKeyRelatedField(
        scope=scoped("board__project__workspace"), queryset=Column.objects.all()
    )
    position = serializers.IntegerField(min_value=0, required=False)


class UserIdSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class LabelIdSerializer(serializers.Serializer):
    label_id = serializers.IntegerField()



# comments / activity / notifications


class CommentSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "task", "author", "body", "created_at", "updated_at")
        read_only_fields = ("task", "created_at", "updated_at")


class ActivitySerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = ("id", "task", "actor", "action", "metadata", "created_at")


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ("id", "kind", "message", "task", "actor", "is_read", "created_at")
        read_only_fields = fields