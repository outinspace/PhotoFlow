"""Produce the files the gallery actually loads.

Three outputs per file: a 300px tile for the grid, a preview for the full-screen
view, and a ThumbHash for the placeholder shown while the tile loads. Originals
are only ever read here, never rewritten.
"""

import functools
import os
import subprocess
import threading

from PIL import Image, ImageOps

from .. import keys, progress
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
    failures = 0

    work = list(context.ingested) + list(context.backfill)
    counts = threading.Lock()

    def derive_one(entry) -> None:
        nonlocal failures

        item = context.items.get(getattr(entry, "item_id", None))
        if item is None:
            return

        record = next((f for f in item.files if f.fileId == entry.file_id), None)
        if record is None:
            return

        if not (entry.needs_tile or entry.needs_preview):
            return

        try:
            if entry.content_type.startswith("image/"):
                _derive_image(context, entry, record)
            else:
                _derive_video(context, entry, record)

            record.lastProcessedTimeUtc = now
            record.failedProcessingTimeUtc = None
        except Exception as error:
            with counts:
                failures += 1
            record.failedProcessingTimeUtc = now
            context.note(f"derive failed for {entry.original_file_name}: {error}")

    # Each file writes only its own record, and the heavy work is ffmpeg and
    # exiftool in their own processes, so this scales past one core.
    progress.track_map(derive_one, work, "deriving", context.workers)

    context.note(f"derived {len(work)} files ({failures} failed)")


def _derive_image(context, entry, record) -> None:
    _register_heif()

    with Image.open(entry.local_path) as source:
        _draft_to_preview(source)
        image = ImageOps.exif_transpose(source).convert("RGB")

        if entry.needs_tile:
            record.thumbHash = _thumb_hash(image)

            tile_path = os.path.join(context.work_dir, f"{entry.file_id}.tile.jpeg")
            _save_resized(image, tile_path, TILE_WIDTH)
            context.storage.upload(tile_path, keys.tile(entry.file_id), "image/jpeg")
            record.tileVersion = TILE_VERSION

        if entry.needs_preview:
            preview_path = os.path.join(context.work_dir, f"{entry.file_id}.preview.jpeg")
            _save_resized(image, preview_path, PREVIEW_WIDTH)
            context.storage.upload(preview_path, keys.preview(entry.file_id, ".jpeg"), "image/jpeg")
            record.previewVersion = PREVIEW_VERSION


def _derive_video(context, entry, record) -> None:
    if entry.needs_tile:
        poster_path = os.path.join(context.work_dir, f"{entry.file_id}.poster.jpeg")
        _extract_poster(entry.local_path, poster_path)

        with Image.open(poster_path) as poster:
            frame = poster.convert("RGB")
            record.thumbHash = _thumb_hash(frame)

            tile_path = os.path.join(context.work_dir, f"{entry.file_id}.tile.jpeg")
            _save_resized(frame, tile_path, TILE_WIDTH)
            context.storage.upload(tile_path, keys.tile(entry.file_id), "image/jpeg")
            record.tileVersion = TILE_VERSION

    if not entry.needs_preview:
        return

    # Every video is transcoded, including one already in a browser-safe codec: what
    # a camera writes is meant for a file, not for a network, and a clip that plays
    # in the browser is not the same thing as one that starts playing promptly.
    preview_path = os.path.join(context.work_dir, f"{entry.file_id}.preview.mp4")
    _transcode(entry.local_path, preview_path, context.config)
    context.storage.upload(preview_path, keys.preview(entry.file_id, ".mp4"), "video/mp4")
    record.previewVersion = PREVIEW_VERSION


def _draft_to_preview(source: Image.Image) -> None:
    """Decode a JPEG at the smallest scale that still covers the preview width.

    The resizes below then work on a quarter of the pixels, which is most of the
    cost of this step. Pillow only does this for JPEG, and only in halves, so it is
    a no-op for HEIC and for anything already small enough.

    The size is asked for along whichever stored dimension becomes the width after
    the EXIF rotation is applied. Asking along the wrong one would silently hand
    back a 1512px preview for every portrait photo, since draft refuses to go below
    either dimension it is given.
    """
    rotated = source.getexif().get(0x0112, 1) in (5, 6, 7, 8)
    source.draft("RGB", (1, PREVIEW_WIDTH) if rotated else (PREVIEW_WIDTH, 1))


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


@functools.cache
def _has_hardware_encoder() -> bool:
    """Whether this machine can encode H.264 on a dedicated video block.

    Every Apple Silicon Mac can; a Linux CI runner cannot, so the software encoder
    has to stay. Asked once, since it means starting ffmpeg to find out.
    """
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"],
            capture_output=True,
            timeout=30,
        )
    except Exception:
        return False
    return b"h264_videotoolbox" in result.stdout


def _encoder_arguments(config) -> list[str]:
    if _has_hardware_encoder():
        # VideoToolbox has no CRF; -q:v is its own scale, where higher is better.
        return ["-c:v", "h264_videotoolbox", "-q:v", str(config.video_quality_hardware)]
    # veryfast rather than fast: it encodes in two thirds of the time for a file of
    # about the same size, since CRF holds quality and the preset only trades speed
    # against compression. The next two steps down are a false economy — superfast
    # is barely quicker again and more than doubles the file, and ultrafast trebles
    # it, both having dropped CABAC.
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", str(config.video_quality_software)]


def _transcode(source: str, destination: str, config) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", source,
            "-vf", "scale=-2:'min(1080,ih)'",
            *_encoder_arguments(config),
            "-pix_fmt", "yuv420p",
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
