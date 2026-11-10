from django.db import migrations


def clean_legacy_project_descriptions(apps, schema_editor):
    Project = apps.get_model("board", "Project")
    Project.objects.filter(description__in=["False", "True", "0", "1"]).update(
        description=""
    )


class Migration(migrations.Migration):

    dependencies = [
        ("board", "0003_alter_project_description_alter_task_priority"),
    ]

    operations = [
        migrations.RunPython(
            clean_legacy_project_descriptions,
            migrations.RunPython.noop,
        ),
    ]
