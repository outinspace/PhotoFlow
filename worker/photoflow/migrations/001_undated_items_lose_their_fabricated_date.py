"""Give back the null that ingest used to paper over.

A file carrying no date anywhere — not in its metadata, not in its filename — used
to be stamped with the moment the worker read it, which put it at the top of the
gallery under today. Nothing recorded which items those were.

The stamp itself is the record. It came from one `now` string per run, taken from
the clock to the microsecond, and it was written to the item's captureTime and to
its file's uploadTimeUtc alike. So an item whose capture date equals one of its
files' upload times to the character was never dated at all: a real EXIF or
filename date landing on that exact microsecond is not a thing that happens.
"""

from ..models import ItemRecord


def migrate(item: ItemRecord) -> bool:
    if item.captureTime is None:
        return False

    if not any(item.captureTime == file.uploadTimeUtc for file in item.files):
        return False

    item.captureTime = None
    return True
