"""Business logic shared by serializers and views: ordering, activity log, notifications."""

from django.db import transaction
from django.db.models import Case, IntegerField, Max, Value, When
from rest_framework.exceptions import ValidationError

from .models import (
    Activity,
    ActivityAction,
    Label,
    Notification,
    NotificationKind,
    Task,
    TaskAssignee,
    TaskLabel,
    WorkspaceMember,
)


def display_name(user):
    return (user.full_name or user.email) if user else "Someone"


#  ordering


def next_position(queryset):
    top = queryset.aggregate(top=Max("position"))["top"]
    return 0 if top is None else top + 1


def write_positions(model, ids):
    """Rewrite `position` as 0..n-1 following the order of `ids` (single UPDATE)."""
    if not ids:
        return
    model.objects.filter(pk__in=ids).update(
        position=Case(
            *[When(pk=pk, then=Value(i)) for i, pk in enumerate(ids)],
            output_field=IntegerField(),
        )
    )


# activity / notifications


def log_activity(task, actor, action, **metadata):
    return Activity.objects.create(task=task, actor=actor, action=action, metadata=metadata)


def notify(recipient_ids, actor, task, kind, message, activity=None):
    ids = {i for i in recipient_ids if i and (actor is None or i != actor.pk)}
    if not ids:
        return
    Notification.objects.bulk_create(
        [
            Notification(
                user_id=i, actor=actor, task=task, activity=activity, kind=kind, message=message[:500]
            )
            for i in ids
        ]
    )


# validation


def validate_member_ids(workspace, user_ids, field="assignee_ids"):
    ids = set(user_ids)
    valid = set(
        WorkspaceMember.objects.filter(workspace=workspace, user_id__in=ids).values_list(
            "user_id", flat=True
        )
    )
    missing = ids - valid
    if missing:
        raise ValidationError({field: f"Not members of this workspace: {sorted(missing)}"})


def validate_label_ids(workspace, label_ids, field="label_ids"):
    ids = set(label_ids)
    valid = set(Label.objects.filter(workspace=workspace, pk__in=ids).values_list("pk", flat=True))
    missing = ids - valid
    if missing:
        raise ValidationError({field: f"Labels not found in this workspace: {sorted(missing)}"})


# syncing


@transaction.atomic
def sync_assignees(task, user_ids, actor):
    """Make the task's assignees exactly `user_ids`, logging + notifying the changes."""
    new = set(user_ids)
    validate_member_ids(task.get_workspace(), new)
    current = set(task.task_assignees.values_list("user_id", flat=True))
    to_add, to_remove = new - current, current - new

    if to_remove:
        task.task_assignees.filter(user_id__in=to_remove).delete()
    if to_add:
        TaskAssignee.objects.bulk_create(
            [TaskAssignee(task=task, user_id=u, assigned_by=actor) for u in to_add]
        )

    for user_id in sorted(to_add):
        activity = log_activity(task, actor, ActivityAction.ASSIGNED.value, user_id=user_id)
        notify(
            [user_id],
            actor,
            task,
            NotificationKind.ASSIGNED.value,
            f'{display_name(actor)} assigned you to "{task.title}"',
            activity,
        )
    for user_id in sorted(to_remove):
        log_activity(task, actor, ActivityAction.UNASSIGNED.value, user_id=user_id)


@transaction.atomic
def sync_labels(task, label_ids, actor):
    new = set(label_ids)
    validate_label_ids(task.get_workspace(), new)
    current = set(task.task_labels.values_list("label_id", flat=True))
    to_add, to_remove = new - current, current - new

    if to_remove:
        task.task_labels.filter(label_id__in=to_remove).delete()
    if to_add:
        TaskLabel.objects.bulk_create([TaskLabel(task=task, label_id=l) for l in to_add])

    names = dict(Label.objects.filter(pk__in=to_add | to_remove).values_list("pk", "name"))
    for label_id in sorted(to_add):
        log_activity(task, actor, ActivityAction.LABEL_ADDED.value, label=names.get(label_id))
    for label_id in sorted(to_remove):
        log_activity(task, actor, ActivityAction.LABEL_REMOVED.value, label=names.get(label_id))


# oving


@transaction.atomic
def move_task(task, target_column, position, actor):
    """
    Move `task` into `target_column` at index `position` (None = end), re-numbering
    positions in both the source and target columns so they stay contiguous.
    """
    source_column = task.column
    changed = source_column.pk != target_column.pk

    def ids_in(column):
        return list(
            Task.objects.filter(column=column)
            .exclude(pk=task.pk)
            .order_by("position", "id")
            .values_list("pk", flat=True)
        )

    target_ids = ids_in(target_column)
    if changed:
        write_positions(Task, ids_in(source_column))
        task.column = target_column
        task.save(update_fields=["column", "updated_at"])

    index = len(target_ids) if position is None else max(0, min(position, len(target_ids)))
    target_ids.insert(index, task.pk)
    write_positions(Task, target_ids)
    task.refresh_from_db()

    if changed:
        activity = log_activity(
            task,
            actor,
            ActivityAction.MOVED.value,
            from_column=source_column.name,
            to_column=target_column.name,
        )
        notify(
            task.task_assignees.values_list("user_id", flat=True),
            actor,
            task,
            NotificationKind.MOVED.value,
            f'{display_name(actor)} moved "{task.title}" to {target_column.name}',
            activity,
        )
    return task