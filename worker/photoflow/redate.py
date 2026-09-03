"""Give a real capture date to photos that were dated as of the run that ingested them.

A file with no date in its metadata used to be dated as of the moment the worker
ingested it, which put it at the top of the gallery under today. WhatsApp downloads
are the common case: they carry no EXIF at all, but they do carry the date in the
filename, and so do Android photos and screenshots.

The worker now reads that filename date for new uploads. This repairs the ones
already catalogued. It reads and rewrites the catalog only — no originals are
touched, nothing is re-downloaded, and no thumbnail or search vector is rebuilt.

An item is only re-dated when its capture time is exactly the upload time of one of
its files. That equality is the fingerprint of the old fallback, which used a single
timestamp for both, so a photo with a real capture date of its own is never
overwritten by a guess from its filename.

    uv run photoflow-redate --dry-run
    uv run photoflow-redate
"""

import argparse
import sys

from .config import Config, ConfigError
from .pipeline import Context
from .steps import discover, publish
from .steps.extract import capture_time_from_filename
from .storage import S3Storage


def dated_from_run(item) -> bool:
    """Whether this item's capture time was invented rather than read.

    extract stamps one timestamp onto both the file's upload time and, when nothing
    else supplies one, the item's capture time. Exact equality is therefore the
    fallback's signature; a real capture always predates its upload by more than the
    microsecond that would have to coincide.
    """
    return any(file.uploadTimeUtc == item.captureTime for file in item.files)


def proposed_date(item) -> str | None:
    """The earliest date any of the item's filenames yields, if any do."""
    found = [
        capture_time_from_filename(file.originalFileName)
        for file in item.files
    ]
    dates = sorted(date for date in found if date is not None)
    return dates[0].isoformat() if dates else None


def plan(items) -> tuple[list, int]:
    """Items to re-date, and a count of those left with no date to be found."""
    changes = []
    undatable = 0

    for item in items:
        if not dated_from_run(item):
            continue

        date = proposed_date(item)
        if date is None:
            undatable += 1
        elif date != item.captureTime:
            changes.append((item, date))

    return changes, undatable


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would change without writing anything",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="how many proposed changes to list (default 20)",
    )
    arguments = parser.parse_args()

    try:
        config = Config.from_env()
    except ConfigError as error:
        print(error, file=sys.stderr)
        return 1

    context = Context(config=config, storage=S3Storage(config), work_dir="")
    discover.run(context)

    changes, undatable = plan(context.items.values())

    print()
    print(f"{len(changes)} items would be re-dated from their filename")
    print(f"{undatable} items have no date in metadata or filename, and are left as they are")

    for item, date in sorted(changes, key=lambda pair: pair[1])[: arguments.limit]:
        name = item.files[0].originalFileName if item.files else "?"
        print(f"  {name:44s} {item.captureTime[:10]} -> {date[:10]}")

    if len(changes) > arguments.limit:
        print(f"  ... and {len(changes) - arguments.limit} more")

    if arguments.dry_run:
        print("\nDry run, nothing written.")
        return 0

    if not changes:
        print("\nNothing to do.")
        return 0

    for item, date in changes:
        item.captureTime = date

    # Every month is offered to publish rather than only the ones that changed.
    # publish compares each part against what is already stored and writes only the
    # parts whose bytes differ, so this costs a read per part and cannot rewrite a
    # month that did not actually move.
    context.dirty_months = {
        publish.month_for(item) for item in context.items.values()
    }

    print()
    publish.run(context)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
