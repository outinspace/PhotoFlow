"""Write the catalog the gallery reads.

Shards are keyed by upload month and only rewritten when that month changed, so
past months are byte-identical run after run and stay in the browser's cache. The
manifest is the one small file the app must always revalidate.
"""

from datetime import datetime, timezone

from .. import keys, progress
from ..models import (
    Counts,
    EmbeddingsInfo,
    ManifestDocument,
    ShardDocument,
    ShardEntry,
)
from ..steps.derive import PREVIEW_VERSION, TILE_VERSION
from ..steps.embed import EMBEDDING_DIM, EMBEDDING_VERSION
from ..steps.extract import METADATA_VERSION, month_of

MANIFEST_VERSION = 1

# A month is split once it holds more than this. Importing a back catalogue puts
# a whole library into whichever month it was imported in, and a single shard of
# that size is a large download that every client repeats whenever one photo in
# the month changes.
MAX_ITEMS_PER_SHARD = 2000


def split_into_parts(items: list) -> list[list]:
    """Chunk a month's items, ordered by an id that never changes.

    Ordering by item id rather than capture time is what keeps the split stable:
    editing a photo leaves every boundary where it was, so only the one part that
    actually changed is rewritten and re-downloaded.
    """
    ordered = sorted(items, key=lambda item: item.itemId)

    return [
        ordered[start:start + MAX_ITEMS_PER_SHARD]
        for start in range(0, max(len(ordered), 1), MAX_ITEMS_PER_SHARD)
    ] or [[]]


def run(context) -> None:
    previous = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    previous_entries = {
        (entry.month, entry.part): entry
        for entry in (previous.shards if previous else [])
    }
    now = datetime.now(timezone.utc).isoformat()

    by_month: dict[str, list] = {}
    for item in context.items.values():
        by_month.setdefault(month_for(item), []).append(item)

    entries: dict[tuple[str, int], ShardEntry] = dict(previous_entries)
    written = 0

    for month in progress.track(sorted(by_month), "publishing"):
        if month not in context.dirty_months:
            # Nothing in it changed, so its parts are exactly as they were.
            continue

        for stale in [key for key in entries if key[0] == month]:
            del entries[stale]

        for index, part_items in enumerate(split_into_parts(by_month[month]), start=1):
            document = ShardDocument(month=month, part=index, items=part_items)
            key = keys.shard(month, index)

            existing = previous_entries.get((month, index))
            unchanged = existing is not None and _already_stored(context, key, document)

            if not unchanged:
                context.storage.put_model(key, document)
                written += 1

            entries[(month, index)] = ShardEntry(
                month=month,
                part=index,
                items=len(part_items),
                # Only a part that actually changed gets a new timestamp, which is
                # what tells a browser it need not fetch the others again.
                updatedAt=now if not unchanged else existing.updatedAt,
            )

        _delete_orphaned_parts(context, month, len(split_into_parts(by_month[month])), previous_entries)

    _publish_embeddings(context, by_month)

    # updatedAt lets the gallery skip re-downloading a part it already holds. Parts
    # that did not change keep their timestamp, so they stay cacheable indefinitely.
    shards = [entries[key] for key in sorted(entries)]

    context.storage.put_model(
        keys.CATALOG_MANIFEST,
        ManifestDocument(
            manifestVersion=MANIFEST_VERSION,
            generatedAt=now,
            versions={
                "tile": TILE_VERSION,
                "preview": PREVIEW_VERSION,
                "metadata": METADATA_VERSION,
                "embedding": EMBEDDING_VERSION,
            },
            # The migrations step fills this in; falling back to what was already
            # there means calling publish without that step cannot blank the log.
            migrations=context.applied_migrations or (previous.migrations if previous else []),
            shards=shards,
            embeddings=EmbeddingsInfo(
                dim=EMBEDDING_DIM,
                dtype="int8",
                modelRepo=context.config.clip_model_repo,
                months=sorted(_embedding_months(context, by_month)),
            ),
            counts=Counts(
                items=len(context.items),
                files=sum(len(item.files) for item in context.items.values()),
            ),
        ),
    )

    context.note(f"published {written} shard parts, {len(shards)} total across {len(by_month)} months")


def _already_stored(context, key: str, document: ShardDocument) -> bool:
    """Whether what is about to be written is byte for byte what is already there."""
    if not context.storage.exists(key):
        return False

    return context.storage.get(key) == document.model_dump_json(by_alias=True).encode("utf-8")


def _delete_orphaned_parts(context, month: str, part_count: int, previous_entries: dict) -> None:
    """Remove parts left behind when a month shrinks into fewer of them."""
    for (previous_month, part) in previous_entries:
        if previous_month == month and part > part_count:
            context.storage.delete(keys.shard(month, part))


def _publish_embeddings(context, by_month: dict) -> None:
    """Embeddings ride alongside their shard so search downloads only what it needs."""
    if not context.new_embeddings:
        return

    for month in sorted(context.dirty_months):
        existing = _read_embeddings(context, month)
        existing.update(
            {
                item.itemId: context.new_embeddings[item.itemId]
                for item in by_month.get(month, [])
                if item.itemId in context.new_embeddings
            }
        )

        if not existing:
            continue

        body = bytearray()
        for item_id in sorted(existing):
            body += item_id.to_bytes(8, "big")
            body += existing[item_id]

        context.storage.put(keys.embeddings(month), bytes(body), "application/octet-stream")


def _read_embeddings(context, month: str) -> dict[int, bytes]:
    key = keys.embeddings(month)
    if not context.storage.exists(key):
        return {}

    raw = context.storage.get(key)
    record_size = 8 + 4 + EMBEDDING_DIM
    return {
        int.from_bytes(raw[offset : offset + 8], "big"): raw[offset + 8 : offset + record_size]
        for offset in range(0, len(raw), record_size)
    }


def _embedding_months(context, by_month: dict) -> list[str]:
    return [month for month in by_month if context.storage.exists(keys.embeddings(month))]


def month_for(item) -> str:
    # Upload month, not capture month: an old photo imported today belongs in this
    # month's shard, which is what keeps finished months from ever being rewritten.
    return month_of(min(file.uploadTimeUtc for file in item.files))

