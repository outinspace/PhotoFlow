"""Copy one tenant's media out of a shared bucket, into a new bucket's incoming/.

Backblaze copies server side, so nothing is downloaded or re-uploaded and the
bytes are untouched — which matters, because the migration matches old edits to
new photos by content hash.

Objects are renamed on the way. The old bucket keys them by a GUID with no
extension, and the worker needs the real filename: without it every file looks
like application/octet-stream, and Live Photo halves no longer share a stem. The
old database holds those names, so it drives the copy.

Each item's files land in their own folder, so two photos that happen to share a
filename cannot overwrite each other.

    uv run photoflow-copy-media OLD-BUCKET TENANT-ID photoflow.db --dry-run
    uv run photoflow-copy-media OLD-BUCKET TENANT-ID photoflow.db
"""
import argparse
import sqlite3
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from .config import Config, ConfigError
from .steps.ingest import is_media

# Server-side copies are API calls, not transfers, so this is about round trips.
DEFAULT_WORKERS = 16


@dataclass(frozen=True)
class Copy:
    source_key: str
    destination_key: str


def plan(database: str, tenant_id: str, source_prefix: str, include_deleted: bool) -> tuple[list[Copy], int, int]:
    """What to copy where, from the old database's own record of each file."""
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row

    where = "" if include_deleted else "WHERE i.DeletedTimeUtc IS NULL"
    rows = connection.execute(f"""
        SELECT f.FileId, f.OriginalFileName, f.ItemId
        FROM tb_Files f JOIN tb_Items i ON i.ItemId = f.ItemId
        {where}
    """).fetchall()

    # The same test the worker applies, so junk the old library collected is not
    # copied only to be discarded on arrival.
    media = [row for row in rows if is_media(row["OriginalFileName"])]
    non_media = len(rows) - len(media)
    rows = media

    copies = [
        Copy(
            # Lowercased: the old app wrote object keys with Guid.ToString(), which
            # is lowercase, while the database column holds the same id uppercased.
            # S3 keys are case sensitive, so the stored casing finds nothing.
            source_key=f"{source_prefix}{tenant_id}/{row['FileId'].lower()}",
            # Per item, so a filename repeated across the library cannot collide,
            # while a Live Photo's two halves stay together.
            destination_key=f"incoming/{row['ItemId']}/{row['OriginalFileName']}",
        )
        for row in rows
    ]

    total = connection.execute("SELECT COUNT(*) FROM tb_Files").fetchone()[0]
    return copies, non_media, total - len(copies) - non_media


def run_copies(client, source_bucket: str, destination_bucket: str, copies: list[Copy], workers: int) -> dict:
    counts = {"copied": 0, "already there": 0, "source missing": 0, "failed": 0}
    lock = threading.Lock()

    def record(outcome: str) -> None:
        with lock:
            counts[outcome] += 1
            done = sum(counts.values())
            if done % 500 == 0 or done == len(copies):
                print(f"  {done}/{len(copies)}  " + "  ".join(f"{k} {v}" for k, v in counts.items() if v), flush=True)

    def copy_one(item: Copy) -> None:
        try:
            client.head_object(Bucket=destination_bucket, Key=item.destination_key)
            record("already there")
            return
        except ClientError as error:
            if error.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
                record("failed")
                print(f"  {item.destination_key}: {error}", file=sys.stderr)
                return

        try:
            client.copy_object(
                Bucket=destination_bucket,
                Key=item.destination_key,
                CopySource={"Bucket": source_bucket, "Key": item.source_key},
            )
            record("copied")
        except ClientError as error:
            code = error.response["Error"]["Code"]
            if code in ("404", "NoSuchKey", "NotFound"):
                # A row whose object is already gone; nothing to copy.
                record("source missing")
            else:
                record("failed")
                print(f"  {item.source_key}: {error}", file=sys.stderr)


    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(copy_one, copies))

    return counts


def preflight(client, source_bucket: str, copies: list[Copy], sample: int = 5) -> str | None:
    """Check a handful of source objects before starting on tens of thousands.

    Getting the prefix or the id casing wrong otherwise fails identically on every
    object, and the run reports it fifty thousand times instead of once.
    """
    for item in copies[:sample]:
        try:
            client.head_object(Bucket=source_bucket, Key=item.source_key)
            return None
        except ClientError as error:
            code = error.response["Error"]["Code"]
            if code not in ("404", "NoSuchKey", "NotFound"):
                return f"{code} reading {source_bucket}. The key needs read on it and write on the destination."

    return (
        f"None of the first {sample} files were found in {source_bucket}, e.g.\n"
        f"    {copies[0].source_key}\n"
        "  Check the bucket name and --source-prefix against what is actually there."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Server-side copy one tenant's media into a new bucket's incoming/.")
    parser.add_argument("source_bucket", help="the existing bucket holding more than one tenant")
    parser.add_argument("tenant_id", help="the tenant folder to copy, e.g. 9f87f78c-cf20-4e3e-8cf4-6d9750229f99")
    parser.add_argument("database", help="that tenant's .db file, for the original filenames")
    parser.add_argument("--source-prefix", default="original/", help="media folder in the old bucket (default original/)")
    parser.add_argument("--skip-deleted", action="store_true", help="leave photos that were in the bin behind")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--dry-run", action="store_true", help="report what would be copied and stop")
    arguments = parser.parse_args()

    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    if config.bucket == arguments.source_bucket:
        print("PHOTOFLOW_S3_BUCKET is the source bucket; it has to be the new one.", file=sys.stderr)
        return 2

    copies, non_media, deleted = plan(
        arguments.database, arguments.tenant_id, arguments.source_prefix, not arguments.skip_deleted
    )

    print(f"\n{'Would copy' if arguments.dry_run else 'Copying'} {len(copies)} files")
    print(f"  from  {arguments.source_bucket}/{arguments.source_prefix}{arguments.tenant_id}/")
    print(f"  to    {config.bucket}/incoming/")
    if non_media:
        print(f"  {non_media} skipped as not media (.DS_Store and the like)")
    if deleted:
        print(f"  {deleted} skipped as deleted (drop --skip-deleted to include them)")

    if copies:
        print(f"\n  e.g. {copies[0].source_key}\n    -> {copies[0].destination_key}")

    if arguments.dry_run:
        print("\nDry run, nothing copied.")
        return 0

    client = boto3.client(
        "s3",
        endpoint_url=config.endpoint_url,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        region_name=config.region,
        config=BotoConfig(signature_version="s3v4", max_pool_connections=arguments.workers * 2),
    )

    problem = preflight(client, arguments.source_bucket, copies)
    if problem:
        print(f"\n  {problem}", file=sys.stderr)
        return 2

    print()
    counts = run_copies(client, arguments.source_bucket, config.bucket, copies, arguments.workers)

    print("\n" + "  ".join(f"{key} {value}" for key, value in counts.items()))
    print("\nRun photoflow-worker next to catalogue them, then photoflow-import-legacy-db.")

    return 1 if counts["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
