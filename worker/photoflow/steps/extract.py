"""Read metadata out of each new file and attach it to an item.

exiftool does the reading, including the offline reverse geocode that turns GPS
coordinates into a city and region. Files that share a stem and a capture window
join the same item, which is how a Live Photo's still and video stay together.

Every file is read in one exiftool call. exiftool is a Perl script, so starting it
costs about 60ms against roughly 2ms of actual reading; a process per file spent
97% of this step on startup.
"""

import json
import os
import re
import subprocess
from datetime import datetime, timezone

from ..grouping import group_keys_for
from ..ids import item_id_from_group_key
from ..models import FileRecord, ItemRecord
from .. import progress

METADATA_VERSION = 1
EXIFTOOL_TIMEOUT_SECONDS = 120

# FileModifyDate is deliberately absent. Every file is read from a fresh download in
# the work directory, so its filesystem timestamp is the moment the worker fetched
# it — never when the photo was taken.
_DATE_TAGS = ["DateTimeOriginal", "CreateDate", "MediaCreateDate"]

# A file with no EXIF date usually still carries one in its name. WhatsApp writes
# IMG-20240315-WA0001.jpg, its desktop app writes "WhatsApp Image 2024-03-15 at
# 14.22.05.jpeg", Android and Pixel write IMG_20240315_142205.jpg, and screenshots
# write their own variants. Trailing digits are consumed because Pixel appends
# milliseconds, and a leading digit is refused so a longer run of numbers cannot be
# sliced into a date that was never there.
_FILENAME_DATE = re.compile(
    r"(?<!\d)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})"
    r"(?:[-_ T]?(?:at )?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})\d*)?(?!\d)"
)


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
    from_name = 0
    undated = 0

    entries = list(getattr(context, "ingested", []))
    tags_by_path = read_tags_many([e.local_path for e in entries], context.work_dir)

    for entry in progress.track(entries, "reading metadata"):
        tags = tags_by_path.get(entry.local_path)
        if tags is None:
            # exiftool returns a record per readable file, so a missing one could not
            # be read at all. The item is still created, just without metadata.
            failures += 1
            context.note(f"metadata failed for {entry.original_file_name}")
            tags = {}

        capture_time = _capture_time(tags)
        if capture_time is None:
            capture_time = capture_time_from_filename(entry.original_file_name)
            if capture_time is not None:
                from_name += 1
            else:
                # Nothing anywhere says when this was taken, so it sorts as if it
                # were taken now. The count below is how that gets noticed.
                undated += 1
                capture_time = _parse_iso(now)

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

    context.note(f"extracted metadata for {len(entries)} files ({failures} failed)")

    if from_name:
        context.note(f"took the capture date from the filename for {from_name} files")
    if undated:
        context.note(
            f"{undated} files carry no capture date at all, in metadata or filename, "
            "so they are dated as of this run"
        )


def read_tags_many(paths: list[str], work_dir: str) -> dict[str, dict]:
    """Read every file in one exiftool call, keyed by the path asked for.

    Paths go through an argument file rather than argv, which a few thousand of
    them would overflow. A file exiftool cannot read is simply absent from the
    result, which is how the caller counts failures.
    """
    if not paths:
        return {}

    argument_file = os.path.join(work_dir, "exiftool-args.txt")
    with open(argument_file, "w", encoding="utf-8") as handle:
        handle.write("\n".join(paths) + "\n")

    result = subprocess.run(
        ["exiftool", "-j", "-n", "-api", "geolocation", "-@", argument_file],
        capture_output=True,
        # One call over the whole batch, so the per-file budget has to scale with it.
        timeout=EXIFTOOL_TIMEOUT_SECONDS * max(1, len(paths)),
    )
    if not result.stdout:
        # Nothing came back at all, so every file counts as failed rather than
        # silently losing metadata for the batch.
        return {}

    parsed = json.loads(result.stdout.decode("utf-8", "replace"))

    by_path = {record.get("SourceFile"): record for record in parsed if record.get("SourceFile")}
    # exiftool echoes the path it was given, but normalises separators on the way,
    # so entries are matched back by basename when the string differs.
    by_name = {os.path.basename(key): record for key, record in by_path.items()}

    found = {}
    for path in paths:
        record = by_path.get(path) or by_name.get(os.path.basename(path))
        if record is not None:
            found[path] = record
    return found


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


def capture_time_from_filename(file_name: str) -> datetime | None:
    """Recover a capture date from the filename, for files whose metadata has none.

    This is the date the file was written by whatever app produced it, which for a
    WhatsApp download is the day it was sent rather than the day it was taken. That
    is an approximation, but it puts the photo in roughly the right year and month
    instead of at the top of the gallery under today's date.

    A date that does not exist, or has not happened yet, is refused rather than
    trusted, since either means the digits were not a date to begin with.
    """
    now = datetime.now(timezone.utc)

    for match in _FILENAME_DATE.finditer(file_name):
        year, month, day, hour, minute, second = match.groups()
        try:
            found = datetime(
                int(year), int(month), int(day),
                int(hour or 0), int(minute or 0), int(second or 0),
                tzinfo=timezone.utc,
            )
        except ValueError:
            continue
        if found <= now:
            return found

    return None


def _parse_exif_date(raw: str) -> datetime | None:
    """Parse an exiftool date, keeping any UTC offset it carries.

    exiftool writes "2024:03:15 14:22:05", optionally with a fraction and an offset.
    Only the date part uses colons, so swapping those for dashes leaves something
    fromisoformat accepts whole — offset included. Doing it by hand is what dropped
    negative offsets entirely and silently read positive ones as UTC.
    """
    text = raw.strip().replace("Z", "+00:00")
    date_part, separator, time_part = text.partition(" ")
    candidate = f"{date_part.replace(':', '-')}{separator}{time_part}"

    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        # Includes QuickTime's "0000:00:00 00:00:00", which is how a video with no
        # recorded date announces itself.
        return None

    # EXIF has no timezone of its own, so a bare date is read as UTC. That is the
    # existing convention for every date in the catalog.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


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
