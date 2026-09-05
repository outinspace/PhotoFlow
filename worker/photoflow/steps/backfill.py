"""Repair catalogued files that are missing a derived output.

Three things create this work. A migration from the old API leaves every file
without a thumbnail, because those used to live in a bucket shared between
tenants and now belong in the owner's own. Any run whose model was unavailable
leaves items without a search vector. And a catalog migration can clear a derived
version to ask for that output to be made again.

Sources are chosen to be as small as possible: a 300px tile is made from the
2000px preview rather than the original, and a search vector from the tile.
Re-downloading originals would mean pulling the whole library back out of storage
to rebuild files a fraction of their size. A missing preview is the exception —
only the original can produce one.
"""

import os

from .. import keys, progress
from .ingest import Ingested
from .derive import PREVIEW_VERSION, TILE_VERSION
from .embed import EMBEDDING_VERSION


def run(context) -> None:
    already_queued = {entry.file_id for entry in context.ingested}

    needs_deriving: list = []
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
            if file.failedProcessingTimeUtc:
                continue
            if file.tileVersion != TILE_VERSION or file.previewVersion != PREVIEW_VERSION:
                needs_deriving.append((item, file))

    if not needs_deriving and not needs_embedding:
        context.note("nothing to backfill")
        return

    limit = context.config.max_backfill_per_run
    queued: dict[str, Ingested] = {}

    for item, file in progress.track(needs_deriving[:limit], "fetching sources to derive"):
        entry = _fetch(
            context,
            item,
            file,
            needs_tile=file.tileVersion != TILE_VERSION,
            needs_preview=file.previewVersion != PREVIEW_VERSION,
            needs_embedding=False,
        )
        if entry:
            queued[file.fileId] = entry

    # Embedding is per item, and the tile it reads is produced above, so an item
    # already queued for deriving only needs its flag set rather than a second fetch.
    remaining = limit - len(queued)
    for item in progress.track(list(needs_embedding.values()), "fetching sources for embeddings"):
        if remaining <= 0:
            break

        primary = _primary_file(item)
        if primary is None:
            continue

        if primary.fileId in queued:
            queued[primary.fileId].needs_embedding = True
            continue

        entry = _fetch(
            context, item, primary, needs_tile=False, needs_preview=False, needs_embedding=True
        )
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
        f"({len(needs_deriving)} missing a tile or preview, "
        f"{len(needs_embedding)} missing embeddings outstanding)"
    )


def _primary_file(item):
    """The still, if there is one — a Live Photo's video makes a poorer thumbnail."""
    readable = [f for f in item.files if not f.failedProcessingTimeUtc]

    return next(
        (f for f in readable if f.contentType.startswith("image/")),
        readable[0] if readable else None,
    )


def _fetch(
    context, item, file, needs_tile: bool, needs_preview: bool, needs_embedding: bool
) -> Ingested | None:
    source_key, extension = _smallest_source(context, file)
    local_path = os.path.join(context.work_dir, f"backfill-{file.fileId}{extension}")

    try:
        context.storage.download(source_key, local_path)
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
        needs_preview=needs_preview,
        needs_embedding=needs_embedding,
    )


def _smallest_source(context, file) -> tuple[str, str]:
    # A file that needs a preview made has none to read, so it falls through to the
    # original — which is the only thing a preview can be derived from anyway.
    if file.previewVersion:
        if file.contentType.startswith("image/"):
            return keys.preview(file.fileId, ".jpeg"), ".jpeg"
        return keys.preview(file.fileId, ".mp4"), ".mp4"

    return keys.original(file.fileId), os.path.splitext(file.originalFileName)[1] or ""
