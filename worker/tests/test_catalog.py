import dataclasses
import json

from photoflow import keys
from photoflow.config import Config
from photoflow.models import FileRecord, ItemRecord
from photoflow.pipeline import Context
from photoflow.steps import backfill, discover, publish
from photoflow.steps.ingest import Ingested
from photoflow.storage import MemoryStorage


def config() -> Config:
    return Config(
        endpoint_url="https://example.invalid",
        bucket="test-bucket",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
        max_files_per_run=100,
        max_backfill_per_run=500,
        clip_model_repo="test/model",
        healthcheck_url=None,
    )


def item(item_id: int, upload_month: str, capture="2026-03-18T10:00:00+00:00") -> ItemRecord:
    return ItemRecord(
        itemId=item_id,
        captureTime=capture,
        files=[
            FileRecord(
                fileId=f"hash{item_id}",
                contentType="image/heic",
                originalFileName=f"IMG_{item_id}.HEIC",
                sizeBytes=2_000_000,
                uploadTimeUtc=f"{upload_month}-05T10:00:00+00:00",
                hashSha256=f"hash{item_id}",
                tileVersion=1,
                previewVersion=1,
            )
        ],
    )


def context(storage: MemoryStorage) -> Context:
    return Context(config=config(), storage=storage, work_dir="/tmp")


def test_items_are_sharded_by_upload_month():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-07"), 2: item(2, "2026-08"), 3: item(3, "2026-08")}
    ctx.dirty_months = {"2026-07", "2026-08"}

    publish.run(ctx)

    july = storage.get_json(keys.shard("2026-07"))
    august = storage.get_json(keys.shard("2026-08"))

    assert len(july["items"]) == 1
    assert len(august["items"]) == 2


def test_an_old_photo_uploaded_today_lands_in_this_months_shard():
    # Sharding on upload date rather than capture date is what makes a finished
    # month stop changing, which is the whole basis for caching it forever.
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-08", capture="2011-01-02T10:00:00+00:00")}
    ctx.dirty_months = {"2026-08"}

    publish.run(ctx)

    assert storage.exists(keys.shard("2026-08"))
    assert not storage.exists(keys.shard("2011-01"))


def test_untouched_months_are_not_rewritten():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-07"), 2: item(2, "2026-08")}
    ctx.dirty_months = {"2026-07", "2026-08"}
    publish.run(ctx)

    original_july = storage.get(keys.shard("2026-07"))

    # A later run that only touches August must leave July's bytes alone, or every
    # client would redownload the entire history every night.
    later = context(storage)
    later.items = dict(ctx.items)
    later.items[3] = item(3, "2026-08")
    later.dirty_months = {"2026-08"}
    publish.run(later)

    assert storage.get(keys.shard("2026-07")) == original_july
    assert len(storage.get_json(keys.shard("2026-08"))["items"]) == 2


def test_manifest_lists_every_shard():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-07"), 2: item(2, "2026-08")}
    ctx.dirty_months = {"2026-07", "2026-08"}

    publish.run(ctx)

    manifest = storage.get_json(keys.CATALOG_MANIFEST)

    assert [shard["month"] for shard in manifest["shards"]] == ["2026-07", "2026-08"]
    assert manifest["counts"]["items"] == 2

    # No URLs: the bucket is private, so the app signs one from the key rather than
    # being handed a prefix to join onto.
    assert manifest.get("urls") is None


def test_discover_reloads_what_publish_wrote():
    storage = MemoryStorage()
    first = context(storage)
    first.items = {1: item(1, "2026-08")}
    first.dirty_months = {"2026-08"}
    publish.run(first)

    second = context(storage)
    discover.run(second)

    assert list(second.items) == [1]
    assert second.known_hashes == {"hash1"}


def test_discover_ignores_folder_placeholder_objects():
    storage = MemoryStorage({keys.INCOMING: b"", keys.INCOMING + "photo.heic": b"data"})
    ctx = context(storage)

    discover.run(ctx)

    assert [entry.key for entry in ctx.pending] == [keys.INCOMING + "photo.heic"]


def test_discover_defers_work_beyond_the_per_run_cap():
    objects = {f"{keys.INCOMING}photo{index}.heic": b"data" for index in range(10)}
    storage = MemoryStorage(objects)

    capped = config().__class__(**{**config().__dict__, "max_files_per_run": 4})
    ctx = Context(config=capped, storage=storage, work_dir="/tmp")
    discover.run(ctx)

    assert len(ctx.pending) == 4
    assert any("deferred" in note for note in ctx.notes)


def test_shard_entries_match_the_gallery_item_shape():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-08")}
    ctx.dirty_months = {"2026-08"}

    publish.run(ctx)

    entry = json.loads(storage.get(keys.shard("2026-08")))["items"][0]

    # These are the fields src/types.ts declares; a missing one breaks the gallery
    # silently rather than loudly, so it is worth asserting here.
    for field in ("itemId", "captureTime", "files", "latitude", "cameraMake", "megapixels"):
        assert field in entry
    for field in ("fileId", "contentType", "tileVersion", "previewVersion", "thumbHash"):
        assert field in entry["files"][0]

    # Mutable state must not be baked into an immutable shard.
    assert "isFavorite" not in entry
    assert "deletedTimeUtc" not in entry


def test_a_stable_month_keeps_its_updatedAt_so_clients_can_skip_it():
    storage = MemoryStorage()
    ctx = context(storage)
    ctx.items = {1: item(1, "2026-07"), 2: item(2, "2026-08")}
    ctx.dirty_months = {"2026-07", "2026-08"}
    publish.run(ctx)

    july_before = _shard_entry(storage, "2026-07")["updatedAt"]

    later = context(storage)
    later.items = dict(ctx.items)
    later.items[3] = item(3, "2026-08")
    later.dirty_months = {"2026-08"}
    publish.run(later)

    assert _shard_entry(storage, "2026-07")["updatedAt"] == july_before
    assert _shard_entry(storage, "2026-08")["updatedAt"] != july_before


def _shard_entry(storage, month):
    manifest = storage.get_json(keys.CATALOG_MANIFEST)
    return next(entry for entry in manifest["shards"] if entry["month"] == month)


def test_a_batch_of_large_files_is_cut_to_fit_the_disk_the_run_has():
    storage = MemoryStorage()
    for index in range(6):
        storage.put(f"{keys.INCOMING}clip{index}.mp4", b"x" * 400, "video/mp4")

    ctx = context(storage)
    ctx.config = dataclasses.replace(ctx.config, max_bytes_per_run=1000)
    discover.run(ctx)

    # Two fit under 1000 bytes; the third would cross it and waits for the next run.
    assert len(ctx.pending) == 2


def test_a_file_bigger_than_the_whole_budget_is_still_taken():
    storage = MemoryStorage()
    storage.put(f"{keys.INCOMING}huge.mp4", b"x" * 5000, "video/mp4")

    ctx = context(storage)
    ctx.config = dataclasses.replace(ctx.config, max_bytes_per_run=1000)
    discover.run(ctx)

    assert len(ctx.pending) == 1


def test_a_migration_asking_for_500_video_previews_only_fetches_what_fits(tmp_path):
    """The state migration 002 leaves: previewVersion cleared on a lot of clips.

    Only the original can produce a preview, so each of these is a full-size fetch
    rather than the small one a tile repair reads.
    """
    storage = MemoryStorage()
    clips = {}

    for index in range(10):
        record = item(index, "2026-03")
        video = record.files[0]
        video.contentType = "video/quicktime"
        video.originalFileName = f"IMG_{index}.MOV"
        video.previewVersion = None
        clips[index] = record
        storage.put(keys.original(video.fileId), b"x" * 400, "video/quicktime")

    ctx = context(storage)
    ctx.work_dir = str(tmp_path)
    ctx.items = clips
    ctx.ingested = []
    ctx.config = dataclasses.replace(ctx.config, max_bytes_per_run=1000)
    backfill.run(ctx)

    assert len(ctx.backfill) == 3


def test_backfill_leaves_room_for_what_ingest_already_downloaded(tmp_path):
    storage = MemoryStorage()
    record = item(1, "2026-03")
    record.files[0].previewVersion = None
    storage.put(keys.original(record.files[0].fileId), b"x" * 400, "video/quicktime")

    ctx = context(storage)
    ctx.work_dir = str(tmp_path)
    ctx.items = {1: record}
    ctx.config = dataclasses.replace(ctx.config, max_bytes_per_run=1000)
    ctx.ingested = [
        Ingested(
            file_id="already",
            hash_sha256="already",
            original_file_name="IMG_9999.MOV",
            content_type="video/quicktime",
            size_bytes=1000,
            local_path=str(tmp_path / "IMG_9999.MOV"),
        )
    ]
    backfill.run(ctx)

    assert ctx.backfill == []
