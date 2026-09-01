"""Move uploads out of incoming/ and into the catalog.

Everything downstream works on local temp files, so this step is also what pulls
each upload down once. A file is only removed from incoming/ after its original
is safely stored under its content hash.
"""

import mimetypes
import os
from dataclasses import dataclass

from .. import keys
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
    incoming_key: str


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

    for entry in context.pending:
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
            # duplicate. Drop it from incoming/ and move on.
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

    context.ingested = ingested
    context.note(f"ingested {len(ingested)}, skipped {skipped} duplicates, ignored {ignored} non-media")


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
