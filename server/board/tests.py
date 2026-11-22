from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from .models import Board, Column, Project, Role, Task, Workspace, WorkspaceInvitation, WorkspaceMember
from .services import sync_assignees

User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="workspace@example.test",
    FRONTEND_URL="https://app.example.test",
)
class WorkspaceInvitationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.test", full_name="Workspace Owner", password="password"
        )
        self.invited = User.objects.create_user(
            email="member@example.test", full_name="New Member", password="password"
        )
        self.workspace = Workspace.objects.create(name="Team Space")
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=Role.OWNER
        )
        self.client = APIClient()

    def invite(self, email="member@example.test"):
        self.client.force_authenticate(self.owner)
        return self.client.post(
            reverse("workspace-members", args=[self.workspace.pk]),
            {"email": email},
            format="json",
        )

    def test_sends_invitation_email_and_adds_member_after_acceptance(self):
        response = self.invite()

        self.assertEqual(response.status_code, 201)
        invitation = WorkspaceInvitation.objects.get(workspace=self.workspace)
        self.assertEqual(response.data["email"], self.invited.email)
        self.assertIn(str(invitation.token), response.data["invitation_url"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.invited.email])
        self.assertIn(response.data["invitation_url"], mail.outbox[0].body)
        self.assertFalse(
            WorkspaceMember.objects.filter(
                workspace=self.workspace, user=self.invited
            ).exists()
        )

        self.client.force_authenticate(self.invited)
        accepted = self.client.post(
            reverse("workspace-invitation-accept", args=[invitation.token]),
            format="json",
        )

        self.assertEqual(accepted.status_code, 200)
        self.assertTrue(
            WorkspaceMember.objects.filter(
                workspace=self.workspace, user=self.invited, role=Role.MEMBER
            ).exists()
        )
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.accepted_at)

    def test_invitation_can_be_accepted_only_by_the_invited_email(self):
        response = self.invite()
        invitation = WorkspaceInvitation.objects.get(workspace=self.workspace)
        self.client.force_authenticate(self.owner)

        accepted = self.client.post(
            reverse("workspace-invitation-accept", args=[invitation.token]),
            format="json",
        )

        self.assertEqual(accepted.status_code, 403)
        self.assertIsNone(invitation.accepted_at)
        self.assertEqual(response.status_code, 201)

    def test_expired_invitation_cannot_be_accepted(self):
        invitation = WorkspaceInvitation.objects.create(
            workspace=self.workspace,
            email=self.invited.email,
            invited_by=self.owner,
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        self.client.force_authenticate(self.invited)

        response = self.client.post(
            reverse("workspace-invitation-accept", args=[invitation.token]),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            WorkspaceMember.objects.filter(
                workspace=self.workspace, user=self.invited
            ).exists()
        )


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="workspace@example.test",
)
class TaskAssignmentEmailTests(TestCase):
    def test_new_assignee_receives_assignment_email(self):
        actor = User.objects.create_user(
            email="actor@example.test", full_name="Task Owner", password="password"
        )
        assignee = User.objects.create_user(
            email="assignee@example.test", full_name="Task Assignee", password="password"
        )
        workspace = Workspace.objects.create(name="Team Space")
        WorkspaceMember.objects.create(workspace=workspace, user=actor, role=Role.OWNER)
        WorkspaceMember.objects.create(workspace=workspace, user=assignee)
        project = Project.objects.create(workspace=workspace, name="Launch")
        board = Board.objects.create(project=project, name="Roadmap")
        column = Column.objects.create(board=board, name="To Do")
        task = Task.objects.create(column=column, title="Prepare release")

        sync_assignees(task, [assignee.pk], actor)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [assignee.email])
        self.assertIn("Prepare release", mail.outbox[0].subject)
        self.assertIn("Team Space", mail.outbox[0].body)
        self.assertIn("/workspace/team-space/project/", mail.outbox[0].body)
