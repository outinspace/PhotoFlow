"""Produce the files the gallery actually loads.

Three outputs per file: a 300px tile for the grid, a preview for the full-screen
view, and a ThumbHash for the placeholder shown while the tile loads. Originals
are only ever read here, never rewritten.
"""

import functools
import json
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
PREVIEW_VIDEO_HEIGHT = 1080
THUMBHASH_MAX = 100

TRANSCODE_TIMEOUT_SECONDS = 60 * 60
PROBE_TIMEOUT_SECONDS = 60


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

    # Every video gets a preview of its own, including one already in a browser-safe
    # codec: what a camera writes is meant for a file, not for a network, and a clip
    # that plays in the browser is not the same thing as one that starts playing
    # promptly. Making that preview is a re-encode only when the clip needs one.
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
    return ["-c:v", "libx264", "-preset", "fast", "-crf", str(config.video_quality_software)]


def _transcode(source: str, destination: str, config) -> None:
    """Make the mp4 the gallery streams, re-encoding only when there is a reason to.

    A clip that already is what the encoder would emit needs nothing but its moov
    atom moved to the front, and that is a copy of the same bytes rather than a
    second pass through x264: about a second instead of ten, with no generation
    loss. The faststart flag is on both paths because it is the whole point of the
    cheap one.
    """
    if _is_already_preview_ready(source):
        encoding = ["-c", "copy"]
    else:
        encoding = [
            "-vf", f"scale=-2:'min({PREVIEW_VIDEO_HEIGHT},ih)'",
            *_encoder_arguments(config),
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
        ]

    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", source,
            *encoding,
            "-movflags", "+faststart",
            destination,
        ],
        check=True,
        timeout=TRANSCODE_TIMEOUT_SECONDS,
    )


def _is_already_preview_ready(source: str) -> bool:
    """Whether copying this clip's streams gives what the encoder would have made.

    Each test below matches something the encode forces: H.264, 8-bit 4:2:0, no
    taller than the cap, and AAC audio if there is any. Anything else — HEVC from a
    recent iPhone, 10-bit, a 4K source, the PCM a camera writes — is re-encoded, and
    so is a clip ffprobe cannot read, because the cheap path has to be the certain
    one.

    ponytail: bitrate is not checked, so a 20Mbps clip from a camera is copied at
    its full size rather than shrunk to the ~3Mbps the encode would have produced.
    Add a ceiling on bit_rate here if preview downloads matter more than CI minutes.
    """
    try:
        streams = _probe(source)
    except Exception:
        return False

    video = [stream for stream in streams if stream.get("codec_type") == "video"]
    audio = [stream for stream in streams if stream.get("codec_type") == "audio"]

    if len(video) != 1 or len(audio) > 1:
        return False
    if audio and audio[0].get("codec_name") != "aac":
        return False
    if video[0].get("codec_name") != "h264" or video[0].get("pix_fmt") != "yuv420p":
        return False

    height = _display_height(video[0])

    return height is not None and height <= PREVIEW_VIDEO_HEIGHT


def _probe(source: str) -> list[dict]:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-of", "json", source],
        capture_output=True,
        check=True,
        timeout=PROBE_TIMEOUT_SECONDS,
    )
    return json.loads(result.stdout).get("streams", [])


def _display_height(stream) -> int | None:
    """The height a browser shows, which is not the stored one for phone video.

    A phone records portrait as a landscape frame plus a rotation matrix, so a
    1920x1080 stream is displayed 1080x1920. ffmpeg applies that rotation before the
    scale filter runs, so the cap above has always meant this number; reading the
    stored height instead would wave every portrait clip through at three times the
    pixels a preview is supposed to have.
    """
    width, height = stream.get("width"), stream.get("height")
    if not width or not height:
        return None

    # Where ffmpeg 6 and later report it, falling back to the tag older files carry
    # as a string. An unreadable value returns None, which asks for the encode.
    rotation = next(
        (side["rotation"] for side in stream.get("side_data_list", []) if "rotation" in side),
        stream.get("tags", {}).get("rotate", 0),
    )
    try:
        quarter_turned = abs(int(float(rotation))) % 180 == 90
    except (TypeError, ValueError):
        return None

    return width if quarter_turned else height


def _register_heif() -> None:
    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except ImportError:
        pass
