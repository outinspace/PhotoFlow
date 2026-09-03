"""Where a photo's date comes from when its metadata does not carry one.

A file with no EXIF date used to be stamped with the moment the worker ingested it,
which put it at the top of the gallery under today. Most such files do carry a date
in the filename, which is what these cover.
"""

from datetime import datetime, timezone

import pytest

from photoflow import redate
from photoflow.models import FileRecord, ItemRecord
from photoflow.steps.extract import _parse_exif_date, capture_time_from_filename


@pytest.mark.parametrize(
    "file_name,expected",
    [
        ("IMG-20240315-WA0001.jpg", "2024-03-15 00:00"),
        ("VID-20231225-WA0007.mp4", "2023-12-25 00:00"),
        ("WhatsApp Image 2024-03-15 at 14.22.05.jpeg", "2024-03-15 14:22"),
        ("IMG_20240315_142205.jpg", "2024-03-15 14:22"),
        # Pixel appends milliseconds, which must not break the time off the end.
        ("PXL_20240315_142205123.jpg", "2024-03-15 14:22"),
        ("Screenshot 2024-03-15 at 14.22.05.png", "2024-03-15 14:22"),
        # The uploader's collision-dodging suffix must not be read as a date.
        ("IMG_20240315_142205_1730928000000.jpg", "2024-03-15 14:22"),
    ],
)
def test_a_date_in_the_filename_is_recovered(file_name, expected):
    found = capture_time_from_filename(file_name)
    assert found is not None
    assert found.strftime("%Y-%m-%d %H:%M") == expected


@pytest.mark.parametrize(
    "file_name",
    [
        "IMG_4021.HEIC",       # an iPhone name carries no date
        "DSC00123.JPG",
        "IMG-20241345-WA0001.jpg",   # month 13
        "IMG-20990101-WA0001.jpg",   # has not happened yet
        "100_2024.JPG",              # digits, but not a date
    ],
)
def test_digits_that_are_not_a_date_are_refused(file_name):
    assert capture_time_from_filename(file_name) is None


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("2024:03:15 14:22:05", "2024-03-15T14:22:05+00:00"),
        # A negative offset used to fail outright, losing the date; the worker's own
        # timezone decided whether a date survived.
        ("2024:03:15 14:22:05-05:00", "2024-03-15T14:22:05-05:00"),
        # A positive offset used to be discarded and read as UTC, two hours out.
        ("2024:03:15 14:22:05+02:00", "2024-03-15T14:22:05+02:00"),
    ],
)
def test_an_offset_is_kept_rather_than_dropped(raw, expected):
    assert _parse_exif_date(raw).isoformat() == expected


def test_quicktime_says_it_has_no_date_with_zeroes():
    assert _parse_exif_date("0000:00:00 00:00:00") is None


def item_with(file_name, capture, upload):
    return ItemRecord(
        itemId=1,
        captureTime=capture,
        files=[FileRecord(
            fileId="h1", contentType="image/jpeg", originalFileName=file_name,
            sizeBytes=1, uploadTimeUtc=upload, hashSha256="h1",
        )],
    )


def test_a_photo_dated_as_of_its_upload_is_re_dated():
    stamp = "2026-09-02T21:26:51.304356+00:00"
    item = item_with("IMG-20240315-WA0001.jpg", capture=stamp, upload=stamp)

    changes, undatable = redate.plan([item])

    assert undatable == 0
    assert [date[:10] for _, date in changes] == ["2024-03-15"]


def test_a_photo_with_a_real_capture_date_is_left_alone():
    """The filename date must never overwrite one the camera actually recorded."""
    item = item_with(
        "IMG_20240315_142205.jpg",
        capture="2024-03-15T14:22:05+00:00",
        upload="2026-09-02T21:26:51.304356+00:00",
    )

    changes, undatable = redate.plan([item])

    assert changes == []
    assert undatable == 0


def test_a_photo_with_no_date_anywhere_is_counted_not_guessed():
    stamp = "2026-09-02T21:26:51.304356+00:00"
    item = item_with("DSC00123.JPG", capture=stamp, upload=stamp)

    changes, undatable = redate.plan([item])

    assert changes == []
    assert undatable == 1


def test_the_repair_rewrites_the_shard_and_leaves_good_dates_alone(tmp_path):
    """The whole repair, over a catalog written the way the old fallback wrote it."""
    from photoflow import keys
    from photoflow.models import ShardDocument
    from photoflow.pipeline import Context
    from photoflow.steps import discover, publish
    from photoflow.storage import MemoryStorage
    from tests.test_catalog import config

    stamp = "2026-09-02T21:26:51.304356+00:00"
    guessed = ItemRecord(
        itemId=11, captureTime=stamp,
        files=[FileRecord(fileId="a", contentType="image/jpeg",
                          originalFileName="IMG-20240315-WA0001.jpg", sizeBytes=1,
                          uploadTimeUtc=stamp, hashSha256="a")],
    )
    real = ItemRecord(
        itemId=22, captureTime="2025-06-01T08:00:00+00:00",
        files=[FileRecord(fileId="b", contentType="image/heic",
                          originalFileName="IMG_4021.HEIC", sizeBytes=1,
                          uploadTimeUtc=stamp, hashSha256="b")],
    )

    storage = MemoryStorage()
    month = publish.month_for(guessed)

    # Published by the real code rather than hand-built, so the catalog under repair
    # is shaped exactly as a run would leave it.
    seeding = Context(config=config(), storage=storage, work_dir=str(tmp_path))
    seeding.note = lambda message: None
    seeding.items = {11: guessed, 22: real}
    seeding.dirty_months = {month}
    publish.run(seeding)

    context = Context(config=config(), storage=storage, work_dir=str(tmp_path))
    context.note = lambda message: None
    discover.run(context)

    changes, undatable = redate.plan(context.items.values())
    assert undatable == 0
    assert len(changes) == 1

    for item, date in changes:
        item.captureTime = date
    context.dirty_months = {publish.month_for(i) for i in context.items.values()}
    publish.run(context)

    written = storage.get_model(keys.shard(month, 1), ShardDocument)
    dates = {i.files[0].originalFileName: i.captureTime[:10] for i in written.items}
    assert dates["IMG-20240315-WA0001.jpg"] == "2024-03-15"
    assert dates["IMG_4021.HEIC"] == "2025-06-01"
