"""Load the existing catalog and find work.

The catalog itself is the worker's state: anything already in a shard is done.
That removes the need for a database, and makes a re-run after a crash safe.

Work comes from two places: new uploads in incoming/, and reprocess requests the
app leaves in meta/reprocess/ for files already in the catalog.
"""

from .. import keys
from ..models import ManifestDocument, ShardDocument


def run(context) -> None:
    manifest = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    entries = manifest.shards if manifest else []

    for entry in entries:
        shard = context.storage.get_model(keys.shard(entry.month, entry.part), ShardDocument)
        if not shard:
            continue

        for item in shard.items:
            context.items[item.itemId] = item
            for file in item.files:
                context.known_hashes.add(file.hashSha256)

    context.note(f"loaded {len(context.items)} items from {len(entries)} shard parts")

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

    # One request object per file, named after the file, so two devices asking for
    # the same one simply write the same object.
    context.reprocess = {
        entry.key.rsplit("/", 1)[-1].removesuffix(".json"): entry.key
        for entry in context.storage.list(keys.META_REPROCESS)
        if entry.key.endswith(".json")
    }

    if context.reprocess:
        context.note(f"{len(context.reprocess)} files requested for reprocessing")
