from django.conf import settings
from django.db import models
from django.utils.text import slugify



class Role(models.TextChoices):
    OWNER="owner","Owner"
    ADMIN="admin","Admin"
    MEMBER = "member", "Member"

class Priority(models.TextChoices):
    LOW= "low","Low"
    MEDIUM = "medium","Medium"
    HIGN="hign","High"
    URGENT = "urgent","Urgent"


class ActivityAction(models.TextChoices):
    CREATED = "created", "Created"
    UPDATED = "updated", "Updated"
    MOVED = "moved", "Moved"
    ASSIGNED = "assigned", "Assigned"
    UNASSIGNED = "unassigned", "Unassigned"
    LABEL_ADDED = "label_added", "Label added"
    LABEL_REMOVED = "label_removed", "Label removed"
    COMMENTED = "commented", "Commented"


class NotificationKind(models.TextChoices):
    ASSIGNED = "assigned", "Assigned"
    COMMENT = "comment", "Comment"
    MOVED = "moved", "Moved"

class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True




