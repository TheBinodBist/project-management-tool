from django.urls import path
from . import views

urlpatterns = [

    # Workspaces
    path("workspaces/", views.workspace_list_create, name="workspace-list"),
    path("workspaces/<int:pk>/", views.workspace_detail, name="workspace-detail"),
    path("workspaces/<int:pk>/members/", views.workspace_members, name="workspace-members"),
    path(
        "workspaces/<int:pk>/members/<int:user_id>/",
        views.workspace_member_detail,
        name="workspace-member-detail"
    ),

    # Projects
    path("projects/", views.project_list_create, name="project-list"),
    path("projects/<int:pk>/", views.project_detail, name="project-detail"),

    # Boards
    path("boards/", views.board_list_create, name="board-list"),
    path("boards/<int:pk>/", views.board_detail, name="board-detail"),
    path(
        "boards/<int:pk>/reorder-columns/",
        views.board_reorder_columns,
        name="board-reorder-columns"
    ),

    # Columns
    path("columns/", views.column_list_create, name="column-list"),
    path("columns/<int:pk>/", views.column_detail, name="column-detail"),

    # Labels
    path("labels/", views.label_list_create, name="label-list"),
    path("labels/<int:pk>/", views.label_detail, name="label-detail"),

    # Tasks
    path("tasks/", views.task_list_create, name="task-list"),
    path("tasks/<int:pk>/", views.task_detail, name="task-detail"),
    path("tasks/<int:pk>/move/", views.task_move, name="task-move"),

    path("tasks/<int:pk>/assignees/", views.task_assignees, name="task-assignees"),
    path(
        "tasks/<int:pk>/assignees/<int:user_id>/",
        views.task_assignee_detail,
        name="task-assignee-detail"
    ),

    path("tasks/<int:pk>/labels/", views.task_labels, name="task-labels"),
    path(
        "tasks/<int:pk>/labels/<int:label_id>/",
        views.task_label_detail,
        name="task-label-detail"
    ),

    path("tasks/<int:pk>/comments/", views.task_comments, name="task-comments"),
    path("tasks/<int:pk>/activity/", views.task_activity, name="task-activity"),

    # Comments
    path("comments/<int:pk>/", views.comment_detail, name="comment-detail"),

    # Activity
    path("activity/", views.activity_list, name="activity-list"),

    # Notifications
    path("notifications/", views.notification_list, name="notification-list"),
    path(
        "notifications/<int:pk>/",
        views.notification_detail,
        name="notification-detail"
    ),
    path(
        "notifications/<int:pk>/read/",
        views.notification_read,
        name="notification-read"
    ),
    path(
        "notifications/read-all/",
        views.notification_read_all,
        name="notification-read-all"
    ),
    path(
        "notifications/unread-count/",
        views.notification_unread_count,
        name="notification-unread-count"
    ),
]