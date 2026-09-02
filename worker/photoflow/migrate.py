"""Carry favourites, deletions and albums over from the old API's database.

The photos themselves are not migrated by this script. They are copied into the
new bucket's incoming/ folder and the worker catalogues them exactly as it would
any upload — new ids, fresh thumbnails, fresh search vectors. That keeps one code
path for how a file enters the library.

What that path cannot know is what you did to those photos in the old app. This
reads that from the old SQLite database and writes it as a mutation log — the
same kind of file a phone or laptop writes when you favourite something — so the
worker's ordinary compaction merges it in with no special handling.

Old and new ids differ, so the join is the content hash: the old database stored
one per file, and the new catalog stores the same hash as the file's id.

    uv run photoflow-migrate photoflow.db --dry-run
    uv run photoflow-migrate photoflow.db
"""

import argparse
import sqlite3
import sys
from collections import defaultdict
from dataclasses import dataclass, field

from . import keys
from .config import Config, ConfigError
from .models import DeviceLogDocument, ManifestDocument, ShardDocument, StateDocument
from .storage import S3Storage, Storage
from .timestamps import normalize, now_iso

# Every run writes the same log, so re-running after more photos have been
# catalogued extends it rather than leaving a trail of one-off device files.
DEVICE_ID = "migration"


@dataclass
class Report:
    favourites: int = 0
    deletions: int = 0
    albums: int = 0
    memberships: int = 0
    # Old items whose files were not found in the catalog — not re-uploaded yet,
    # or deliberately left behind.
    unmatched_items: int = 0
    # Old items whose files ended up in more than one new item, usually a Live
    # Photo the new grouping paired differently. Their edits apply to every part.
    split_items: int = 0
    shared_albums_not_carried: list[str] = field(default_factory=list)


def load_catalog_index(storage: Storage) -> dict[str, set[int]]:
    """Content hash -> the new item(s) holding a file with that hash."""
    manifest = storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    index: dict[str, set[int]] = defaultdict(set)

    for entry in manifest.shards if manifest else []:
        shard = storage.get_model(keys.shard(entry.month, entry.part), ShardDocument)
        for item in shard.items if shard else []:
            for file in item.files:
                index[file.hashSha256.lower()].add(item.itemId)

    return index


def plan_operations(connection: sqlite3.Connection, index: dict[str, set[int]], first_seq: int = 1):
    """Turn the old database's state into mutation-log operations."""
    connection.row_factory = sqlite3.Row
    report = Report()
    fallback = now_iso()

    hashes_by_old_item: dict[int, list[str]] = defaultdict(list)
    for row in connection.execute("SELECT ItemId, HashSha256 FROM tb_Files"):
        hashes_by_old_item[row["ItemId"]].append(row["HashSha256"].lower())

    def new_items_for(old_item_id: int) -> set[int]:
        found: set[int] = set()
        for content_hash in hashes_by_old_item.get(old_item_id, []):
            found |= index.get(content_hash, set())
        return found

    operations: list[dict] = []
    seq = first_seq

    def emit(ts: str, **fields) -> None:
        nonlocal seq
        operations.append({"seq": seq, "ts": ts, **fields})
        seq += 1

    for row in connection.execute("SELECT * FROM tb_Items WHERE IsFavorite = 1 OR DeletedTimeUtc IS NOT NULL"):
        targets = new_items_for(row["ItemId"])
        if not targets:
            report.unmatched_items += 1
            continue
        if len(targets) > 1:
            report.split_items += 1

        # The row's own change time, not now: an edit made in the new app before
        # this ran is newer and should still win the merge.
        changed = normalize(row["ModifiedTimeUtc"]) or fallback
        deleted = normalize(row["DeletedTimeUtc"])

        for item_id in sorted(targets):
            if row["IsFavorite"]:
                emit(changed, op="item.favorite", itemId=item_id, value=True)
            if deleted:
                emit(changed, op="item.deleted", itemId=item_id, value=deleted)

        report.favourites += bool(row["IsFavorite"])
        report.deletions += bool(deleted)

    members: dict[int, list[int]] = defaultdict(list)
    for row in connection.execute("SELECT AlbumId, ItemId FROM tb_ItemAlbum"):
        members[row["AlbumId"]].append(row["ItemId"])

    for row in connection.execute("SELECT * FROM tb_Albums"):
        created = normalize(row["CreatedTimeUtc"]) or fallback
        updated = normalize(row["UpdatedTimeUtc"]) or created

        # Old ids are kept so a second run addresses the same album, not a new one.
        emit(created, op="album.create", albumId=row["AlbumId"], name=row["Name"])
        report.albums += 1

        for old_item_id in members.get(row["AlbumId"], []):
            targets = new_items_for(old_item_id)
            if not targets:
                report.unmatched_items += 1
                continue
            for item_id in sorted(targets):
                emit(updated, op="album.member", albumId=row["AlbumId"], itemId=item_id, value=True)
            report.memberships += 1

        # A share link is a document the app writes when you share; carrying only
        # the secret would show a link that leads nowhere. Re-share from the app.
        if row["ShareSecret"]:
            report.shared_albums_not_carried.append(row["Name"])

    return operations, report


def next_seq(storage: Storage) -> int:
    """Continue after whatever the worker has already compacted from this log."""
    state = storage.get_model(keys.META_STATE, StateDocument)
    return (state.cursors.get(DEVICE_ID, 0) if state else 0) + 1


def write_log(storage: Storage, operations: list[dict]) -> None:
    storage.put_model(
        keys.device_log(DEVICE_ID),
        DeviceLogDocument.model_validate({"deviceId": DEVICE_ID, "ops": operations}),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Carry favourites, deletions and albums over from an old Photoflow database.")
    parser.add_argument("database", help="tenant .db file, as downloaded from Export Data in the old app")
    parser.add_argument("--dry-run", action="store_true", help="report what would be written and stop")
    arguments = parser.parse_args()

    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    storage = S3Storage(config)
    connection = sqlite3.connect(f"file:{arguments.database}?mode=ro", uri=True)

    index = load_catalog_index(storage)
    if not index:
        print("The catalog is empty. Copy the photos into incoming/ and run the worker first.", file=sys.stderr)
        return 1

    operations, report = plan_operations(connection, index, first_seq=next_seq(storage))

    print(f"\n{'Would carry over' if arguments.dry_run else 'Carrying over'} from {arguments.database}:")
    print(f"  favourites        {report.favourites}")
    print(f"  deletions         {report.deletions}")
    print(f"  albums            {report.albums}")
    print(f"  album members     {report.memberships}")
    print(f"  operations        {len(operations)}")

    if report.unmatched_items:
        print(f"\n  {report.unmatched_items} old items were not found in the catalog. If their photos have not")
        print("  been copied and processed yet, run this again once they have.")
    if report.split_items:
        print(f"  {report.split_items} old items now span more than one item; their edits apply to each part.")
    if report.shared_albums_not_carried:
        names = ", ".join(report.shared_albums_not_carried)
        print(f"  share links are not carried over; re-share from the app: {names}")

    if arguments.dry_run:
        print("\nDry run, nothing written.")
        return 0

    write_log(storage, operations)
    print(f"\nWrote {len(operations)} operations to meta/log/{DEVICE_ID}.json.")
    print("They take effect in the app immediately, and the next worker run compacts them.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
