"""Produce the files the gallery actually loads.

Three outputs per file: a 300px tile for the grid, a preview for the full-screen
view, and a ThumbHash for the placeholder shown while the tile loads. Originals
are only ever read here, never rewritten.
"""

import os
import subprocess

from PIL import Image, ImageOps

from .. import keys, video
from ..timestamps import now_iso
from ..thumbhash import rgba_to_thumb_hash

TILE_VERSION = 1
PREVIEW_VERSION = 1

TILE_WIDTH = 300
PREVIEW_WIDTH = 2000
THUMBHASH_MAX = 100

TRANSCODE_TIMEOUT_SECONDS = 60 * 60


def run(context) -> None:
    now = now_iso()
    passed_through = 0
    transcoded = 0
    failures = 0

    work = list(context.ingested) + list(context.backfill)

    for entry in work:
        item = context.items.get(getattr(entry, "item_id", None))
        if item is None:
            continue

        record = next((f for f in item.files if f.fileId == entry.file_id), None)
        if record is None:
            continue

        if not (entry.needs_tile or entry.needs_preview):
            continue

        try:
            if entry.content_type.startswith("image/"):
                _derive_image(context, entry, record)
            elif _derive_video(context, entry, record):
                passed_through += 1
            else:
                transcoded += 1

            record.lastProcessedTimeUtc = now
            record.failedProcessingTimeUtc = None
        except Exception as error:
            failures += 1
            record.failedProcessingTimeUtc = now
            context.note(f"derive failed for {entry.original_file_name}: {error}")

    context.note(
        f"derived {len(work)} files "
        f"({passed_through} videos passed through, {transcoded} transcoded, {failures} failed)"
    )


def _derive_image(context, entry, record) -> None:
    _register_heif()

    with Image.open(entry.local_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")

        if entry.needs_tile:
            record.thumbHash = _thumb_hash(image)

            tile_path = os.path.join(context.work_dir, f"{entry.file_id}.tile.jpeg")
            _save_resized(image, tile_path, TILE_WIDTH)
            _upload(context, tile_path, keys.tile(context.config.path_prefix, entry.file_id), "image/jpeg")
            record.tileVersion = TILE_VERSION

        if entry.needs_preview:
            preview_path = os.path.join(context.work_dir, f"{entry.file_id}.preview.jpeg")
            _save_resized(image, preview_path, PREVIEW_WIDTH)
            _upload(
                context,
                preview_path,
                keys.preview(context.config.path_prefix, entry.file_id, ".jpeg"),
                "image/jpeg",
            )
            record.previewVersion = PREVIEW_VERSION


def _derive_video(context, entry, record) -> bool:
    """Returns True when the original was good enough to serve as its own preview."""
    if entry.needs_tile:
        poster_path = os.path.join(context.work_dir, f"{entry.file_id}.poster.jpeg")
        _extract_poster(entry.local_path, poster_path)

        with Image.open(poster_path) as poster:
            frame = poster.convert("RGB")
            record.thumbHash = _thumb_hash(frame)

            tile_path = os.path.join(context.work_dir, f"{entry.file_id}.tile.jpeg")
            _save_resized(frame, tile_path, TILE_WIDTH)
            _upload(context, tile_path, keys.tile(context.config.path_prefix, entry.file_id), "image/jpeg")
            record.tileVersion = TILE_VERSION

    if not entry.needs_preview:
        return record.previewIsOriginal

    info = video.probe(entry.local_path)

    if video.can_pass_through(info, context.config.passthrough_max_height):
        record.previewIsOriginal = True
        record.previewVersion = PREVIEW_VERSION
        return True

    preview_path = os.path.join(context.work_dir, f"{entry.file_id}.preview.mp4")
    _transcode(entry.local_path, preview_path)
    _upload(
        context,
        preview_path,
        keys.preview(context.config.path_prefix, entry.file_id, ".mp4"),
        "video/mp4",
    )
    record.previewIsOriginal = False
    record.previewVersion = PREVIEW_VERSION
    return False


def _thumb_hash(image: Image.Image) -> str:
    import base64

    small = image.copy()
    small.thumbnail((THUMBHASH_MAX, THUMBHASH_MAX), Image.LANCZOS)
    rgba = small.convert("RGBA")
    encoded = rgba_to_thumb_hash(rgba.width, rgba.height, rgba.tobytes())
    return base64.b64encode(encoded).decode("ascii")


def _save_resized(image: Image.Image, path: str, target_width: int) -> None:
    resized = image.copy()
    if resized.width > target_width:
        height = round(resized.height * target_width / resized.width)
        resized = resized.resize((target_width, height), Image.LANCZOS)
    resized.save(path, "JPEG", quality=70, progressive=True, optimize=True)


def _extract_poster(source: str, destination: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", source, "-frames:v", "1", destination],
        check=True,
        timeout=TRANSCODE_TIMEOUT_SECONDS,
    )


def _transcode(source: str, destination: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", source,
            "-vf", "scale=-2:'min(1080,ih)'",
            "-c:v", "libx264", "-preset", "fast", "-crf", "28", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            destination,
        ],
        check=True,
        timeout=TRANSCODE_TIMEOUT_SECONDS,
    )


def _register_heif() -> None:
    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except ImportError:
        pass


def _upload(context, path: str, key: str, content_type: str) -> None:
    upload = getattr(context.storage, "upload", None)
    if upload:
        upload(path, key, content_type)
        return
    with open(path, "rb") as handle:
        context.storage.put(key, handle.read(), content_type)
