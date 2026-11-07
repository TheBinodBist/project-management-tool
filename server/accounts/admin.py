from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):

    ordering = ["email"]

    list_display = [
        "email",
        "full_name",
        "is_staff",
        "is_active",
    ]

    list_filter = [
        "is_staff",
        "is_active",
        "is_superuser",
    ]

    search_fields = [
        "email",
        "full_name",
    ]

    fieldsets = (
        (None, {
            "fields": ("email", "password")
        }),
        ("Personal Information", {
            "fields": ("full_name", "avatar_url")
        }),
        ("Permissions", {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            )
        }),
        ("Important Dates", {
            "fields": ("last_login", "date_joined")
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email",
                "full_name",
                "password1",
                "password2",
                "is_staff",
                "is_active",
            ),
        }),
    )

    filter_horizontal = ("groups", "user_permissions")