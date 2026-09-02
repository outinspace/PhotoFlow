"""Import a library from the old API's SQLite database.

The photos themselves never move. Their object keys are unchanged, so this reads
the old metadata and writes the catalog and mutable state that replace it:

    tb_Items + tb_Files   -> catalog/shards/<upload month>.json
    IsFavorite, Deleted   -> meta/state.json
    tb_Albums + joins     -> meta/state.json albums

Two fields are deliberately dropped rather than carried across:

  * Thumbnails are not brought over. The old API kept them in one bucket shared
    between tenants; they belong in the owner's own bucket now, so tileVersion is
    left empty and the next worker run rebuilds each one from the preview.
  * Search vectors are not brought over. They came from a different model to the
    one the browser now uses, and comparing across the two returns nonsense.
    embeddingVersion is left empty and the same run recomputes them.

Previews are kept: they already live in the owner's bucket, and re-transcoding a
library's worth of video to reproduce files that already exist would cost a day
of CPU for no change.

    uv run photoflow-migrate path/to/photoflow.db --dry-run
    uv run photoflow-migrate path/to/photoflow.db
"""

import argparse
import sqlite3
import sys
from collections import defaultdict

from . import keys
from .config import Config, ConfigError
from .models import (
    Counts,
    EmbeddingsInfo,
    FileRecord,
    ItemRecord,
    ManifestDocument,
    ShardDocument,
    ShardEntry,
    StateDocument,
    UrlPrefixes,
)
from .steps.derive import PREVIEW_VERSION, TILE_VERSION
from .steps.embed import EMBEDDING_DIM, EMBEDDING_VERSION
from .steps.extract import METADATA_VERSION
from .steps.publish import split_into_parts
from .storage import S3Storage, Storage
from .timestamps import normalize, now_iso

MANIFEST_VERSION = 1


def _video_length(raw) -> float | None:
    """Seconds, from .NET's TimeSpan text.

    The old schema stored durations as "00:00:02.8316666" rather than a number,
    so this is the one column that cannot simply be handed to the model.
    """
    if raw is None:
        return None

    if isinstance(raw, (int, float)):
        return float(raw)

    text = str(raw).strip()
    if not text:
        return None

    # A duration over a day is written "d.hh:mm:ss".
    days = 0.0
    if "." in text.split(":")[0]:
        day_part, _, text = text.partition(".")
        days = float(day_part)

    try:
        hours, minutes, seconds = text.split(":")
        return days * 86400 + int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    except ValueError:
        return None


def _exposure(numerator, denominator) -> str | None:
    """Rebuild the shutter speed string the gallery shows.

    The old schema kept it as a fraction in two columns, which is why the info
    panel could not render it; here it becomes "1/250" or "2.5".
    """
    if not numerator or not denominator:
        return None

    if numerator >= denominator:
        return f"{numerator / denominator:g}"

    return f"{numerator}/{denominator}" if numerator == 1 else f"1/{round(denominator / numerator)}"


def read_catalog(connection: sqlite3.Connection) -> tuple[dict[int, ItemRecord], list[str]]:
    """Build item records from the old tables, reporting anything left behind."""
    connection.row_factory = sqlite3.Row
    warnings: list[str] = []

    files_by_item: dict[int, list[FileRecord]] = defaultdict(list)
    for row in connection.execute("SELECT * FROM tb_Files"):
        upload_time = normalize(row["UploadTimeUtc"])
        if not upload_time:
            warnings.append(f"file {row['FileId']} has no upload time, skipped")
            continue

        files_by_item[row["ItemId"]].append(
            FileRecord(
                # Kept exactly as it is: the id is half of an object key, and the
                # objects are not being rewritten.
                fileId=row["FileId"],
                contentType=row["ContentType"],
                originalFileName=row["OriginalFileName"],
                sizeBytes=row["SizeBytes"],
                uploadTimeUtc=upload_time,
                hashSha256=row["HashSha256"],
                lastProcessedTimeUtc=normalize(row["LastProcessedTimeUtc"]),
                failedProcessingTimeUtc=normalize(row["FailedProcessingTimeUtc"]),
                # Left empty on purpose; see the note at the top of this file.
                tileVersion=None,
                previewVersion=PREVIEW_VERSION if row["PreviewVersion"] else None,
                thumbHash=row["ThumbHash"],
                # The old API always wrote a separate preview file.
                previewIsOriginal=False,
            )
        )

    items: dict[int, ItemRecord] = {}
    for row in connection.execute("SELECT * FROM tb_Items"):
        files = files_by_item.get(row["ItemId"])
        if not files:
            warnings.append(f"item {row['ItemId']} has no files, skipped")
            continue

        # The old schema stored .NET's DateTime.MinValue for an unknown capture
        # time; the gallery sorts on this, so fall back to when it was uploaded.
        capture_time = normalize(row["CaptureTimeUtc"]) or min(f.uploadTimeUtc for f in files)

        items[row["ItemId"]] = ItemRecord(
            itemId=row["ItemId"],
            captureTime=capture_time,
            files=sorted(files, key=lambda f: f.originalFileName),
            videoLength=_video_length(row["VideoLength"]),
            widthPixels=row["WidthPixels"],
            heightPixels=row["HeightPixels"],
            longitude=row["Longitude"],
            latitude=row["Latitude"],
            altitude=row["Altitude"],
            city=row["City"],
            region=row["Region"],
            megapixels=row["Megapixels"],
            exposureTime=_exposure(row["ExposureTimeNumerator"], row["ExposureTimeDenominator"]),
            # The new model carries the old spelling of this field.
            aperature=row["Aperture"],
            fNumber=row["FNumber"],
            iso=row["ISO"],
            cameraMake=row["CameraMake"],
            cameraModel=row["CameraModel"],
            embeddingVersion=None,
        )

    return items, warnings


def read_state(connection: sqlite3.Connection, items: dict[int, ItemRecord]) -> StateDocument:
    """Favourites, deletions and albums, in the shape the merge expects.

    Every value carries the timestamp it was last changed, because that is what
    later edits from a device are compared against. Using the row's own modified
    time rather than now means a device's pending change still wins if it is newer.
    """
    connection.row_factory = sqlite3.Row
    fallback = now_iso()

    item_state: dict[str, dict] = {}
    for row in connection.execute("SELECT * FROM tb_Items"):
        if row["ItemId"] not in items:
            continue

        changed = normalize(row["ModifiedTimeUtc"]) or fallback
        fields = {}

        if row["IsFavorite"]:
            fields["favorite"] = {"value": True, "ts": changed}

        deleted = normalize(row["DeletedTimeUtc"])
        if deleted:
            fields["deleted"] = {"value": deleted, "ts": changed}

        if fields:
            item_state[str(row["ItemId"])] = fields

    members: dict[int, dict] = defaultdict(dict)
    for row in connection.execute("SELECT * FROM tb_ItemAlbum"):
        if row["ItemId"] in items:
            members[row["AlbumId"]][str(row["ItemId"])] = {}

    albums: dict[str, dict] = {}
    for row in connection.execute("SELECT * FROM tb_Albums"):
        created = normalize(row["CreatedTimeUtc"]) or fallback
        updated = normalize(row["UpdatedTimeUtc"]) or created

        album: dict = {
            "albumId": row["AlbumId"],
            "createdTimeUtc": created,
            "name": {"value": row["Name"], "ts": updated},
        }

        if row["ShareSecret"]:
            album["shareSecret"] = {"value": row["ShareSecret"], "ts": updated}

        # Membership is per photo rather than one list, so a later addition from
        # another device merges instead of replacing the whole album.
        album["members"] = {
            item_id: {"in": {"value": True, "ts": updated}}
            for item_id in members.get(row["AlbumId"], {})
        }

        albums[str(row["AlbumId"])] = album

    return StateDocument(compactedAt=fallback, cursors={}, items=item_state, albums=albums)


def shard_items(items: dict[int, ItemRecord]) -> dict[str, list[ItemRecord]]:
    """Group by upload month, matching how the worker publishes."""
    by_month: dict[str, list[ItemRecord]] = defaultdict(list)
    for item in items.values():
        by_month[min(file.uploadTimeUtc for file in item.files)[:7]].append(item)
    return by_month


def write(storage: Storage, config: Config, items: dict[int, ItemRecord], state: StateDocument) -> ManifestDocument:
    generated = now_iso()
    by_month = shard_items(items)

    entries: list[ShardEntry] = []

    for month, month_items in sorted(by_month.items()):
        # Importing a back catalogue puts a whole library into one month, which is
        # precisely the case shard parts exist for.
        for index, part_items in enumerate(split_into_parts(month_items), start=1):
            storage.put_model(
                keys.shard(month, index),
                ShardDocument(month=month, part=index, items=part_items),
            )
            entries.append(ShardEntry(month=month, part=index, items=len(part_items), updatedAt=generated))

    manifest = ManifestDocument(
        manifestVersion=MANIFEST_VERSION,
        generatedAt=generated,
        versions={
            "tile": TILE_VERSION,
            "preview": PREVIEW_VERSION,
            "metadata": METADATA_VERSION,
            "embedding": EMBEDDING_VERSION,
        },
        urls=UrlPrefixes(
            originalPrefix=f"{config.public_base_url}original/{config.path_prefix}",
            tileImagePrefix=f"{config.public_base_url}tile-image/{config.path_prefix}",
            previewPrefix=f"{config.public_base_url}preview/{config.path_prefix}",
        ),
        shards=entries,
        # None yet; the next worker run computes them.
        embeddings=EmbeddingsInfo(dim=EMBEDDING_DIM, dtype="int8", modelRepo=config.clip_model_repo, months=[]),
        counts=Counts(items=len(items), files=sum(len(item.files) for item in items.values())),
    )

    storage.put_model(keys.CATALOG_MANIFEST, manifest)
    storage.put_model(keys.META_STATE, state)

    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Import an old Photoflow SQLite database into the catalog.")
    parser.add_argument("database", help="tenant .db file, as downloaded from Export Data")
    parser.add_argument("--dry-run", action="store_true", help="report what would be written and stop")
    arguments = parser.parse_args()

    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    connection = sqlite3.connect(f"file:{arguments.database}?mode=ro", uri=True)

    items, warnings = read_catalog(connection)
    state = read_state(connection, items)
    by_month = shard_items(items)

    for warning in warnings[:20]:
        print(f"  warning: {warning}")
    if len(warnings) > 20:
        print(f"  ...and {len(warnings) - 20} more warnings")

    videos = sum(1 for item in items.values() for f in item.files if f.contentType.startswith("video/"))

    print(f"\n{'Would import' if arguments.dry_run else 'Importing'} from {arguments.database}:")
    print(f"  items            {len(items)}")
    print(f"  files            {sum(len(item.files) for item in items.values())} ({videos} video)")
    print(f"  shards           {len(by_month)} months, {min(by_month, default='-')} to {max(by_month, default='-')}")
    print(f"  favourites       {sum(1 for v in state.items.values() if 'favorite' in v)}")
    print(f"  deleted          {sum(1 for v in state.items.values() if 'deleted' in v)}")
    print(f"  albums           {len(state.albums)}")
    print(f"  album members    {sum(len(a.get('members', {})) for a in state.albums.values())}")
    print("\n  thumbnails and search vectors are rebuilt by the worker, a batch per run")

    if arguments.dry_run:
        print("\nDry run, nothing written.")
        return 0

    print(f"\nWriting to {config.bucket}...")
    manifest = write(S3Storage(config), config, items, state)
    print(f"Wrote {len(manifest.shards)} shards, the manifest, and meta/state.json.")
    print("Run photoflow-worker next to build the thumbnails.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
