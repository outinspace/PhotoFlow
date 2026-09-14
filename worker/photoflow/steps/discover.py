"""Load the existing catalog and find work.

The catalog itself is the worker's state: anything already in a shard is done.
That removes the need for a database, and makes a re-run after a crash safe.

Work comes from two places: new uploads in incoming/, and reprocess requests the
app leaves in meta/reprocess/ for files already in the catalog.
"""

from .. import keys, progress
from ..models import ManifestDocument, ShardDocument


def run(context) -> None:
    manifest = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    entries = manifest.shards if manifest else []

    for entry in progress.track(entries, "loading shards"):
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

    context.pending = _batch(incoming, context.config.batch_size, context.byte_budget)
    deferred = len(incoming) - len(context.pending)

    if deferred:
        context.more_waiting = True
        context.note(
            f"{len(incoming)} files waiting, processing {len(context.pending)} this batch "
            f"({deferred} deferred to the next)"
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


def _batch(incoming, batch_size: int, byte_budget: int):
    """Take what fits this batch, by count and by size.

    A single file larger than the whole budget is still taken, since deferring it
    would defer it every batch.
    """
    taken = []
    total = 0

    for entry in incoming[:batch_size]:
        if taken and total + entry.size > byte_budget:
            break
        taken.append(entry)
        total += entry.size

    return taken
