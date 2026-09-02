"""Read metadata out of each new file and attach it to an item.

exiftool does the reading, including the offline reverse geocode that turns GPS
coordinates into a city and region. Files that share a stem and a capture window
join the same item, which is how a Live Photo's still and video stay together.
"""

import json
import subprocess
from datetime import datetime, timezone

from ..grouping import group_keys_for
from ..ids import item_id_from_group_key
from ..models import FileRecord, ItemRecord
from .. import progress

METADATA_VERSION = 1
EXIFTOOL_TIMEOUT_SECONDS = 120

_DATE_TAGS = ["DateTimeOriginal", "CreateDate", "MediaCreateDate", "FileModifyDate"]


def run(context) -> None:
    now = datetime.now(timezone.utc).isoformat()
    # Items are grouped within a run as well as against the catalog, so a Live
    # Photo uploaded as two files in one batch still lands on one item.
    group_index = {}
    for item in context.items.values():
        for file in item.files:
            for key in group_keys_for(file.originalFileName, _parse_iso(item.captureTime)):
                group_index[key] = item.itemId

    failures = 0

    for entry in progress.track(getattr(context, "ingested", []), "reading metadata"):
        try:
            tags = read_tags(entry.local_path)
        except Exception as error:
            failures += 1
            context.note(f"metadata failed for {entry.original_file_name}: {error}")
            tags = {}

        capture_time = _capture_time(tags) or _parse_iso(now)

        if entry.item_id is not None:
            # A rebuild of a file that is already catalogued. Its existing record is
            # kept rather than replaced, so a rebuild that fails leaves the tile it
            # already had in place instead of blanking it.
            item = context.items[entry.item_id]
            file_record = next(f for f in item.files if f.fileId == entry.file_id)
        else:
            file_record = FileRecord(
                fileId=entry.file_id,
                contentType=entry.content_type,
                originalFileName=entry.original_file_name,
                sizeBytes=entry.size_bytes,
                uploadTimeUtc=now,
                hashSha256=entry.hash_sha256,
            )

            candidates = group_keys_for(entry.original_file_name, capture_time)
            item_id = next((group_index[key] for key in candidates if key in group_index), None)

            if item_id is None:
                item_id = item_id_from_group_key(candidates[0])
                context.items[item_id] = ItemRecord(
                    itemId=item_id,
                    captureTime=capture_time.isoformat(),
                )

            item = context.items[item_id]
            item.files = [f for f in item.files if f.fileId != file_record.fileId] + [file_record]

            for key in candidates:
                group_index[key] = item_id

            entry.item_id = item_id

        _apply_tags(item, tags)

        # The upload month, not this month: a rebuilt file stays in the shard it
        # already belongs to.
        context.dirty_months.add(month_of(file_record.uploadTimeUtc))

    context.note(f"extracted metadata for {len(getattr(context, 'ingested', []))} files ({failures} failed)")


def read_tags(path: str) -> dict:
    result = subprocess.run(
        ["exiftool", "-j", "-n", "-api", "geolocation", path],
        capture_output=True,
        timeout=EXIFTOOL_TIMEOUT_SECONDS,
    )
    if result.returncode != 0 and not result.stdout:
        raise RuntimeError(result.stderr.decode("utf-8", "replace").strip())

    parsed = json.loads(result.stdout.decode("utf-8", "replace"))
    return parsed[0] if parsed else {}


def month_of(iso_timestamp: str) -> str:
    return iso_timestamp[:7]


def _apply_tags(item: ItemRecord, tags: dict) -> None:
    """Fill item fields, preferring whichever file in the group carries a value.

    On a Live Photo the still holds the camera settings and the video holds the
    duration, so neither file alone describes the item.
    """
    item.widthPixels = item.widthPixels or _as_int(tags.get("ImageWidth"))
    item.heightPixels = item.heightPixels or _as_int(tags.get("ImageHeight"))
    item.videoLength = item.videoLength or _as_float(tags.get("Duration"))
    item.latitude = item.latitude if item.latitude is not None else _as_float(tags.get("GPSLatitude"))
    item.longitude = item.longitude if item.longitude is not None else _as_float(tags.get("GPSLongitude"))
    item.altitude = item.altitude if item.altitude is not None else _as_float(tags.get("GPSAltitude"))
    item.city = item.city or tags.get("GeolocationCity")
    item.region = item.region or tags.get("GeolocationRegion")
    item.cameraMake = item.cameraMake or tags.get("Make")
    item.cameraModel = item.cameraModel or tags.get("Model")
    item.fNumber = item.fNumber if item.fNumber is not None else _as_float(tags.get("FNumber"))
    item.aperature = item.aperature if item.aperature is not None else _as_float(tags.get("ApertureValue"))
    item.iso = item.iso if item.iso is not None else _as_int(tags.get("ISO"))

    exposure = tags.get("ExposureTime")
    if item.exposureTime is None and exposure is not None:
        item.exposureTime = _format_exposure(exposure)

    if item.megapixels is None and item.widthPixels and item.heightPixels:
        item.megapixels = round(item.widthPixels * item.heightPixels / 1_000_000, 1)


def _format_exposure(value) -> str:
    """Render shutter speed the way a camera does: 1/250 rather than 0.004."""
    seconds = _as_float(value)
    if seconds is None:
        return str(value)
    if seconds >= 1:
        return f"{seconds:g}"
    return f"1/{round(1 / seconds)}"


def _capture_time(tags: dict) -> datetime | None:
    for tag in _DATE_TAGS:
        raw = tags.get(tag)
        if not raw:
            continue
        parsed = _parse_exif_date(str(raw))
        if parsed:
            return parsed
    return None


def _parse_exif_date(raw: str) -> datetime | None:
    # EXIF dates look like "2026:03:18 14:22:05" and may carry an offset.
    cleaned = raw.strip().split("+")[0].split("Z")[0].strip()
    for pattern in ("%Y:%m:%d %H:%M:%S", "%Y:%m:%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(cleaned, pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _as_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
