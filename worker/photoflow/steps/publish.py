"""Write the catalog the gallery reads.

Shards are keyed by upload month and only rewritten when that month changed, so
past months are byte-identical run after run and stay in the browser's cache. The
manifest is the one small file the app must always revalidate.
"""

from datetime import datetime, timezone

from .. import keys
from ..models import (
    Counts,
    EmbeddingsInfo,
    ManifestDocument,
    ShardDocument,
    ShardEntry,
    UrlPrefixes,
)
from ..steps.derive import PREVIEW_VERSION, TILE_VERSION
from ..steps.embed import EMBEDDING_DIM, EMBEDDING_VERSION
from ..steps.extract import METADATA_VERSION, month_of

MANIFEST_VERSION = 1


def run(context) -> None:
    previous = context.storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    published_at = {entry.month: entry.updatedAt for entry in (previous.shards if previous else [])}
    now = datetime.now(timezone.utc).isoformat()

    by_month: dict[str, list] = {}
    for item in context.items.values():
        by_month.setdefault(_month_for(item), []).append(item)

    for month in sorted(context.dirty_months):
        items = sorted(by_month.get(month, []), key=lambda item: item.captureTime)
        context.storage.put_model(keys.shard(month), ShardDocument(month=month, items=items))
        published_at[month] = now

    _publish_embeddings(context, by_month)

    # updatedAt lets the gallery skip re-downloading a month it already holds.
    # Past months keep the timestamp they were last written with, so they stay
    # byte-identical and cacheable indefinitely.
    shards = [
        ShardEntry(month=month, items=len(items), updatedAt=published_at.get(month) or now)
        for month, items in sorted(by_month.items())
    ]

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
            urls=_url_prefixes(context.config),
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

    context.note(f"published {len(context.dirty_months)} shards of {len(shards)} total")


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


def _month_for(item) -> str:
    # Upload month, not capture month: an old photo imported today belongs in this
    # month's shard, which is what keeps finished months from ever being rewritten.
    return month_of(min(file.uploadTimeUtc for file in item.files))


def _url_prefixes(config) -> UrlPrefixes:
    base = config.public_base_url
    prefix = config.path_prefix
    return UrlPrefixes(
        originalPrefix=f"{base}original/{prefix}",
        tileImagePrefix=f"{base}tile-image/{prefix}",
        previewPrefix=f"{base}preview/{prefix}",
    )
