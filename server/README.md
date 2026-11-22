# Backend email setup

The backend writes invitation and task-assignment emails to the development
console by default. Configure SMTP through environment variables to deliver
emails:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-smtp-user
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=Project Workspace <noreply@example.com>
FRONTEND_URL=http://localhost:3000
```

Set `FRONTEND_URL` to the deployed frontend origin so invitation links point to
the correct application. Invitations expire after seven days and become
workspace memberships only after the invitee accepts while signed in with the
invited email. Newly assigned users receive an email notification.
