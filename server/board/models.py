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
    HIGH="high","High"
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


class Workspace(TimeStamped):
    name = models.CharField(max_length=120)
    slug=models.SlugField(max_length=180,unique=True,blank=True)
    description= models.TextField(blank=True)

    class Meta:
        ordering= ["name"]

    def __str__(self):
        return self.name

    def save(self,*args,**kwargs):
        if not self.slug:
            base = slugify(self.name)[:120] or "workspace"
            slug ,n = base,2
            while Workspace.objects.filter(slug=slug).exists():
                slug= f"{base}-{n}"
                n+=1

            self.slug = slug
        super().save(*args,**kwargs)

    def get_workspace(self):
        return self



class WorkspaceMember(models.Model):
    workspace = models.ForeignKey(Workspace,on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workspace_memberships")
    role = models.CharField(max_length=100,choices=Role.choices, default=Role.MEMBER)
    joined_date = models.DateTimeField(auto_now_add=True)


    class Meta: 
        constraints = [
            models.UniqueConstraint( fields=["workspace","user"],name="unique_workspace_member")
        ]
    def __str__(self):
        return f"{self.user} @{self.workspace} ({self.role})"

    def get_workspace(self):
        return self.workspace



class Project(TimeStamped):
    workspace= models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="projects")
    name = models.TextField()
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_projects",
    )
    
    class Meta:
        ordering=["name"]

    def __str__(self):
        return self.name
    
    def get_workspace(self):
        return self.workspace

class Board(TimeStamped):
    project = models.ForeignKey(Project,on_delete=models.CASCADE, related_name="boards")
    name = models.CharField(max_length=120)
    position = models.PositiveIntegerField(default=0)


    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.name

    def get_workspace(self):
        return self.project.workspace


class Column(TimeStamped):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=120)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.name

    def get_workspace(self):
        return self.board.project.workspace



class Label(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="labels")
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#6366f1")

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["workspace", "name"], name="unique_label_per_workspace")
        ]

    def __str__(self):
        return self.name

    def get_workspace(self):
        return self.workspace





class Task(TimeStamped):
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    due_date = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_tasks",
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="TaskAssignee",
        through_fields=("task", "user"),
        related_name="assigned_tasks",
    )
    labels = models.ManyToManyField(Label, through="TaskLabel", related_name="tasks")

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.title

    def get_workspace(self):
        return self.column.board.project.workspace


class TaskAssignee(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="task_assignees")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "user"], name="unique_task_assignee")]


class TaskLabel(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="task_labels")
    label = models.ForeignKey(Label, on_delete=models.CASCADE, related_name="task_labels")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "label"], name="unique_task_label")]


class Comment(TimeStamped):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    body = models.TextField()

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Comment {self.pk} on task {self.task_id}"

    def get_workspace(self):
        return self.task.get_workspace()


class Activity(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="activities",
    )
    action = models.CharField(max_length=20, choices=ActivityAction.choices)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "activities"

    def __str__(self):
        return f"{self.action} on task {self.task_id}"

    def get_workspace(self):
        return self.task.get_workspace()


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    task = models.ForeignKey(
        Task, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications"
    )
    activity = models.ForeignKey(
        Activity, null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications"
    )
    kind = models.CharField(max_length=20, choices=NotificationKind.choices)
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.kind} for {self.user_id}"