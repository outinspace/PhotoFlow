"""Documents are validated in both directions.

The catalog is read back by the next run and read directly by the gallery, and
device logs are written by browsers. Validation is what stops a shape mismatch in
any of those from being discovered as a blank screen.
"""

import pytest

from photoflow import keys
from photoflow.models import DeviceLogDocument, ItemRecord, ManifestDocument, ShardDocument
from photoflow.pipeline import Context
from photoflow.steps import compact
from photoflow.storage import DocumentError, MemoryStorage
from tests.test_catalog import config, context, item


def test_reading_a_corrupt_shard_raises_rather_than_silently_dropping_photos():
    storage = MemoryStorage({keys.shard("2026-08"): b'{"month": "2026-08", "items": [{"itemId": "not-a-number"}]}'})

    with pytest.raises(DocumentError):
        storage.get_model(keys.shard("2026-08"), ShardDocument)


def test_reading_a_missing_document_returns_none():
    assert MemoryStorage().get_model(keys.CATALOG_MANIFEST, ManifestDocument) is None


def test_an_unexpected_field_is_rejected():
    # Catches a field that was renamed on one side only, which would otherwise
    # just stop being written and never be noticed.
    storage = MemoryStorage({
        keys.shard("2026-08"): b'{"month": "2026-08", "items": [], "totalBytes": 5}'
    })

    with pytest.raises(DocumentError):
        storage.get_model(keys.shard("2026-08"), ShardDocument)


def test_writing_validates_before_the_object_is_stored():
    storage = MemoryStorage()

    with pytest.raises(Exception):
        storage.put_model(keys.shard("2026-08"), ShardDocument(month="2026-08", items=[{"itemId": "nope"}]))

    assert not storage.exists(keys.shard("2026-08"))


def test_a_device_log_with_an_unknown_operation_is_rejected():
    with pytest.raises(Exception):
        DeviceLogDocument.model_validate({
            "deviceId": "phone",
            "ops": [{"op": "item.explode", "seq": 1, "ts": "2026-08-01T00:00:00Z", "itemId": 1}]
        })


def test_one_unreadable_device_log_does_not_stop_the_run():
    # A browser interrupted mid-write should cost that device its pending edits,
    # not the whole night's compaction.
    storage = MemoryStorage({
        keys.META_LOGS + "phone.json": b'{"deviceId": "phone", "ops": [{"op": "item.favorite", "seq": 1, "ts": "2026-08-01T10:00:00Z", "itemId": 7, "value": true}]}',
        keys.META_LOGS + "laptop.json": b'{"deviceId": "laptop", "ops": [{"op": "garbage"',
    })
    ctx = context(storage)

    compact.run(ctx)

    state = storage.get_json(keys.META_STATE)
    assert state["items"]["7"]["favorite"]["value"] is True
    assert any("skipping unreadable log" in note for note in ctx.notes)


def test_a_published_catalog_reads_back_as_valid_documents():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-08")}
    ctx.dirty_months = {"2026-08"}

    from photoflow.steps import publish
    publish.run(ctx)

    manifest = storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    shard = storage.get_model(keys.shard("2026-08"), ShardDocument)

    assert manifest.counts.items == 1
    assert isinstance(shard.items[0], ItemRecord)
