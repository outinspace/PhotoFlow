"""Apply whichever catalog migrations this library has not had yet.

Discover has just loaded every item into memory and publish will write back
whatever months are marked dirty, so a migration needs no storage of its own: it
edits item records in place and this step marks the months they came from.

Each migration runs once. The log in the manifest names the ones already applied,
and an applied migration is not even imported again — a library that is current
costs one read of the manifest and nothing else. It is publish that writes the log,
in the same pass that writes the shards the migration changed: a failure in
between leaves both untouched and the migration still pending, rather than a log
claiming a fix that never landed.

The migrations themselves live in photoflow/migrations/.
"""

from datetime import datetime, timezone

from .. import keys, progress
from ..migrations import load
from ..models import ManifestDocument, MigrationRecord


def run(context) -> None:
    manifest = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    log = list(manifest.migrations) if manifest else []
    applied = {record.name for record in log}

    # Carried even when nothing runs, because publish writes what it finds here.
    context.applied_migrations = log

    pending = [(name, migration) for name, migration in load() if name not in applied]

    if not pending:
        context.note(f"no catalog migrations to apply ({len(applied)} already applied)")
        return

    now = datetime.now(timezone.utc).isoformat()

    for name, migration in pending:
        changed = 0

        for item in progress.track(list(context.items.values()), name):
            if not migration(item):
                continue

            changed += 1
            # Its shard has to be rewritten or the change never reaches the
            # gallery. This deliberately dirties a settled month.
            context.dirty_months.add(min(file.uploadTimeUtc for file in item.files)[:7])

        log.append(MigrationRecord(name=name, appliedAt=now))
        context.note(f"migration {name} changed {changed} of {len(context.items)} items")
