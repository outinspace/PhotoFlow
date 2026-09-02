"""Move uploads out of incoming/ and into the catalog.

Everything downstream works on local temp files, so this step is also what pulls
each upload down once. A file is only removed from incoming/ after its original
is safely stored under its content hash.
"""

import mimetypes
import os
from dataclasses import dataclass

from .. import keys, progress
from ..ids import hash_file

# Folder uploads sweep up sidecars and OS junk. This mirrors the denylist in
# src/api/uploadManager.ts: unknown extensions are kept, since a new camera format
# should not be silently discarded.
NON_MEDIA_EXTENSIONS = {
    "json", "xml", "txt", "csv", "md", "log", "ini", "plist",
    "html", "htm", "xmp", "aae", "thm",
    "pdf", "doc", "docx", "zip", "rar", "7z", "tar", "gz",
    "exe", "dmg", "app", "url", "lnk",
    "db", "ds_store",
}

EXTRA_CONTENT_TYPES = {
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".dng": "image/x-adobe-dng",
    ".mov": "video/quicktime",
}


@dataclass
class Ingested:
    file_id: str
    hash_sha256: str
    original_file_name: str
    content_type: str
    size_bytes: int
    local_path: str
    # Set for a new upload, absent when the file is already stored and is only
    # being rebuilt.
    incoming_key: str | None = None
    reprocess_key: str | None = None
    # Set when the file already belongs to an item, so extract updates that item
    # instead of grouping the file into a new one.
    item_id: int | None = None
    upload_time_utc: str | None = None

    # Which outputs this entry still needs. A new upload needs all of them; a
    # repair of an existing file usually needs only one, and doing the others
    # would mean re-transcoding video that is already fine.
    needs_tile: bool = True
    needs_preview: bool = True
    needs_embedding: bool = True


def content_type_for(file_name: str) -> str:
    extension = os.path.splitext(file_name)[1].lower()
    if extension in EXTRA_CONTENT_TYPES:
        return EXTRA_CONTENT_TYPES[extension]
    return mimetypes.guess_type(file_name)[0] or "application/octet-stream"


def is_media(file_name: str) -> bool:
    extension = os.path.splitext(file_name)[1].lower().lstrip(".")
    content_type = content_type_for(file_name)
    if content_type.startswith(("image/", "video/")):
        return True
    return extension not in NON_MEDIA_EXTENSIONS


def run(context) -> None:
    ingested: list[Ingested] = []
    skipped = 0
    ignored = 0

    for entry in progress.track(context.pending, "ingesting"):
        file_name = os.path.basename(entry.key)

        if not is_media(file_name):
            ignored += 1
            context.storage.delete(entry.key)
            continue

        local_path = os.path.join(context.work_dir, file_name)
        _download(context, entry.key, local_path)

        hash_sha256 = hash_file(local_path)

        if hash_sha256 in context.known_hashes:
            # Already in the catalog under this exact content, so the upload was a
            # duplicate.
            skipped += 1
            os.remove(local_path)
            context.storage.delete(entry.key)
            continue

        original_key = keys.original(context.config.path_prefix, hash_sha256)
        _upload(context, local_path, original_key, content_type_for(file_name))

        context.known_hashes.add(hash_sha256)
        ingested.append(
            Ingested(
                file_id=hash_sha256,
                hash_sha256=hash_sha256,
                original_file_name=file_name,
                content_type=content_type_for(file_name),
                size_bytes=entry.size,
                local_path=local_path,
                incoming_key=entry.key,
            )
        )

    context.ingested = ingested + _fetch_for_reprocessing(context)
    context.note(f"ingested {len(ingested)}, skipped {skipped} duplicates, ignored {ignored} non-media")


def _fetch_for_reprocessing(context) -> list[Ingested]:
    """Pull down originals the app asked to have rebuilt.

    These are already stored and already in the catalog, so nothing is uploaded or
    grouped again — only the derived files are made afresh.
    """
    requested = []

    for file_id, request_key in progress.track(list(context.reprocess.items()), "fetching to reprocess"):
        found = next(
            ((item, file) for item in context.items.values()
             for file in item.files if file.fileId == file_id),
            None,
        )

        if found is None:
            # The file is gone from the catalog, so the request cannot be honoured.
            context.note(f"reprocess request for unknown file {file_id}, dropping it")
            context.storage.delete(request_key)
            continue

        item, file = found
        local_path = os.path.join(context.work_dir, file.originalFileName)

        try:
            _download(context, keys.original(context.config.path_prefix, file_id), local_path)
        except Exception as error:
            context.note(f"could not fetch {file.originalFileName} to reprocess: {error}")
            continue

        requested.append(
            Ingested(
                file_id=file_id,
                hash_sha256=file.hashSha256,
                original_file_name=file.originalFileName,
                content_type=file.contentType,
                size_bytes=file.sizeBytes,
                local_path=local_path,
                reprocess_key=request_key,
                item_id=item.itemId,
                # Kept as it was, or the item would move into this month's shard
                # and the month it actually belongs to would lose it.
                upload_time_utc=file.uploadTimeUtc,
            )
        )

    if requested:
        context.note(f"fetched {len(requested)} files to reprocess")

    return requested


def _download(context, key: str, destination: str) -> None:
    download = getattr(context.storage, "download", None)
    if download:
        download(key, destination)
        return
    with open(destination, "wb") as handle:
        handle.write(context.storage.get(key))


def _upload(context, path: str, key: str, content_type: str) -> None:
    upload = getattr(context.storage, "upload", None)
    if upload:
        upload(path, key, content_type)
        return
    with open(path, "rb") as handle:
        context.storage.put(key, handle.read(), content_type)
