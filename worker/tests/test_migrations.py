"""Catalog migrations: what they change, and that each one runs exactly once."""

import json

from photoflow import keys
from photoflow.migrations import load
from photoflow.models import FileRecord, ItemRecord
from photoflow.steps import discover, migrations, publish
from photoflow.storage import MemoryStorage
from tests.test_catalog import context, item

FIRST_MIGRATION = "001_undated_items_lose_their_fabricated_date"


def undated(item_id: int) -> ItemRecord:
    """An item as ingest used to leave one that carried no date anywhere."""
    record = item(item_id, "2026-08")
    record.captureTime = record.files[0].uploadTimeUtc
    return record


def clip(item_id: int, preview_is_original: bool) -> ItemRecord:
    """A video item as derive used to leave one that was served as its own preview."""
    record = item(item_id, "2026-08")
    record.files = [
        FileRecord(
            fileId=f"clip{item_id}",
            contentType="video/mp4",
            originalFileName=f"CLIP_{item_id}.MP4",
            sizeBytes=8_000_000,
            uploadTimeUtc="2026-08-05T10:00:00+00:00",
            hashSha256=f"clip{item_id}",
            tileVersion=1,
            previewVersion=1,
            previewIsOriginal=preview_is_original,
        )
    ]
    return record


def test_migrations_load_in_numeric_order_under_their_filenames():
    names = [name for name, _ in load()]

    assert names == sorted(names)
    assert FIRST_MIGRATION in names


def test_a_fabricated_capture_date_becomes_none_and_dirties_its_month():
    ctx = context(MemoryStorage())
    ctx.items = {1: undated(1), 2: item(2, "2026-07")}

    migrations.run(ctx)

    assert ctx.items[1].captureTime is None
    assert ctx.dirty_months == {"2026-08"}


def test_a_real_capture_date_is_left_alone():
    ctx = context(MemoryStorage())
    ctx.items = {1: item(1, "2026-08", capture="2026-03-18T10:00:00+00:00")}

    migrations.run(ctx)

    assert ctx.items[1].captureTime == "2026-03-18T10:00:00+00:00"
    assert not ctx.dirty_months


def test_a_video_served_as_its_own_preview_is_asked_for_a_real_one():
    ctx = context(MemoryStorage())
    ctx.items = {1: clip(1, preview_is_original=True)}

    migrations.run(ctx)

    # Clearing the version is what puts it in front of backfill, which fetches the
    # original and has derive transcode a preview from it.
    assert ctx.items[1].files[0].previewVersion is None
    assert ctx.dirty_months == {"2026-08"}


def test_a_video_that_already_has_a_transcoded_preview_is_left_alone():
    ctx = context(MemoryStorage())
    ctx.items = {1: clip(1, preview_is_original=False)}

    migrations.run(ctx)

    assert ctx.items[1].files[0].previewVersion == 1
    assert not ctx.dirty_months


def test_the_log_records_what_ran_and_when():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: undated(1)}

    migrations.run(ctx)
    publish.run(ctx)

    log = json.loads(storage.get(keys.CATALOG_MANIFEST))["migrations"]

    # Every migration in the package runs on a first pass, whether or not it had
    # anything to change, and the log names them all.
    assert [record["name"] for record in log] == [name for name, _ in load()]
    assert log[0]["appliedAt"]


def test_an_applied_migration_does_not_run_again():
    storage = MemoryStorage()
    first = context(storage)
    first.items = {1: undated(1)}
    migrations.run(first)
    publish.run(first)

    shard_before = storage.get(keys.shard("2026-08"))

    # A second night: the catalog is loaded back from what the first run wrote.
    second = context(storage)
    discover.run(second)

    migrations.run(second)

    assert not second.dirty_months
    assert any("no catalog migrations to apply" in note for note in second.notes)

    publish.run(second)

    assert storage.get(keys.shard("2026-08")) == shard_before
    assert len(json.loads(storage.get(keys.CATALOG_MANIFEST))["migrations"]) == len(load())
