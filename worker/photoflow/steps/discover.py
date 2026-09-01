"""Load the existing catalog and find work.

The catalog itself is the worker's state: anything already in a shard is done.
That removes the need for a database, and makes a re-run after a crash safe.
"""

from .. import keys
from ..models import ManifestDocument, ShardDocument


def run(context) -> None:
    manifest = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    entries = manifest.shards if manifest else []

    for entry in entries:
        shard = context.storage.get_model(keys.shard(entry.month), ShardDocument)
        if not shard:
            continue

        for item in shard.items:
            context.items[item.itemId] = item
            for file in item.files:
                context.known_hashes.add(file.hashSha256)

    context.note(f"loaded {len(context.items)} items from {len(entries)} shards")

    incoming = [
        entry
        for entry in context.storage.list(keys.INCOMING)
        # Some S3 tools create a zero-byte object to represent the folder itself.
        if entry.size > 0 and not entry.key.endswith("/")
    ]

    limit = context.config.max_files_per_run
    context.pending = incoming[:limit]

    if len(incoming) > limit:
        context.note(
            f"{len(incoming)} files waiting, processing {limit} this run "
            f"({len(incoming) - limit} deferred to the next run)"
        )
    else:
        context.note(f"{len(incoming)} files waiting")
