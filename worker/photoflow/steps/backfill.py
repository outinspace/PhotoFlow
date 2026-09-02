"""Repair catalogued files that are missing a derived output.

Two things create this work. A migration from the old API leaves every file
without a thumbnail, because those used to live in a bucket shared between
tenants and now belong in the owner's own. And any run whose model was
unavailable leaves items without a search vector.

Sources are chosen to be as small as possible: a 300px tile is made from the
2000px preview rather than the original, and a search vector from the tile.
Re-downloading originals would mean pulling the whole library back out of storage
to rebuild files a fraction of their size.
"""

import os

from .. import keys
from .ingest import Ingested
from .derive import TILE_VERSION
from .embed import EMBEDDING_VERSION


def run(context) -> None:
    already_queued = {entry.file_id for entry in context.ingested}

    needs_tile: list = []
    needs_embedding: dict[int, object] = {}

    for item in context.items.values():
        # A file that failed processing is left alone, for tiles and vectors
        # alike; retrying it every night forever is what a reprocess request is
        # for. Its source cannot be read, so the attempt would fail identically.
        readable = [f for f in item.files if not f.failedProcessingTimeUtc]

        if item.embeddingVersion != EMBEDDING_VERSION and readable:
            needs_embedding[item.itemId] = item

        for file in item.files:
            if file.fileId in already_queued:
                continue
            # A file that failed processing is left alone; retrying it every night
            # forever is what the reprocess request is for.
            if file.tileVersion != TILE_VERSION and not file.failedProcessingTimeUtc:
                needs_tile.append((item, file))

    if not needs_tile and not needs_embedding:
        context.note("nothing to backfill")
        return

    limit = context.config.max_backfill_per_run
    queued: dict[str, Ingested] = {}

    for item, file in needs_tile[:limit]:
        entry = _fetch(context, item, file, needs_tile=True, needs_embedding=False)
        if entry:
            queued[file.fileId] = entry

    # Embedding is per item, and the tile it reads is produced above, so an item
    # already queued for a tile only needs its flag set rather than a second fetch.
    remaining = limit - len(queued)
    for item in list(needs_embedding.values()):
        if remaining <= 0:
            break

        primary = _primary_file(item)
        if primary is None:
            continue

        if primary.fileId in queued:
            queued[primary.fileId].needs_embedding = True
            continue

        entry = _fetch(context, item, primary, needs_tile=False, needs_embedding=True)
        if entry:
            queued[primary.fileId] = entry
            remaining -= 1

    context.backfill = list(queued.values())

    # Their shards have to be rewritten, or the repaired versions never reach the
    # gallery. This is the one thing that deliberately rewrites a settled month.
    for entry in context.backfill:
        item = context.items[entry.item_id]
        context.dirty_months.add(min(file.uploadTimeUtc for file in item.files)[:7])

    context.note(
        f"backfilling {len(context.backfill)} files "
        f"({len(needs_tile)} missing tiles, {len(needs_embedding)} missing embeddings outstanding)"
    )


def _primary_file(item):
    """The still, if there is one — a Live Photo's video makes a poorer thumbnail."""
    readable = [f for f in item.files if not f.failedProcessingTimeUtc]

    return next(
        (f for f in readable if f.contentType.startswith("image/")),
        readable[0] if readable else None,
    )


def _fetch(context, item, file, needs_tile: bool, needs_embedding: bool) -> Ingested | None:
    source_key, extension = _smallest_source(context, file)
    local_path = os.path.join(context.work_dir, f"backfill-{file.fileId}{extension}")

    try:
        _download(context, source_key, local_path)
    except Exception as error:
        context.note(f"could not fetch {file.originalFileName} to repair: {error}")
        return None

    return Ingested(
        file_id=file.fileId,
        hash_sha256=file.hashSha256,
        original_file_name=file.originalFileName,
        # The preview of a video is an mp4 and of a photo a jpeg, so what is read
        # here is not always the original's own type.
        content_type="image/jpeg" if extension == ".jpeg" else file.contentType,
        size_bytes=file.sizeBytes,
        local_path=local_path,
        item_id=item.itemId,
        upload_time_utc=file.uploadTimeUtc,
        needs_tile=needs_tile,
        needs_preview=False,
        needs_embedding=needs_embedding,
    )


def _smallest_source(context, file) -> tuple[str, str]:
    prefix = context.config.path_prefix

    if file.previewVersion and not file.previewIsOriginal:
        if file.contentType.startswith("image/"):
            return keys.preview(prefix, file.fileId, ".jpeg"), ".jpeg"
        return keys.preview(prefix, file.fileId, ".mp4"), ".mp4"

    return keys.original(prefix, file.fileId), os.path.splitext(file.originalFileName)[1] or ""


def _download(context, key: str, destination: str) -> None:
    download = getattr(context.storage, "download", None)
    if download:
        download(key, destination)
        return
    with open(destination, "wb") as handle:
        handle.write(context.storage.get(key))
