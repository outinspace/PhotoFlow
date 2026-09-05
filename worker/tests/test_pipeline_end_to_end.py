"""Runs the real pipeline over real files, against in-memory storage.

Everything here uses generated images and clips, so the test needs no credentials
and touches no network. The embedding step is exercised separately because it
downloads model weights.
"""

import pathlib
import shutil
import subprocess

import pytest
from PIL import Image

from photoflow import keys
from photoflow.pipeline import Context
from photoflow.steps import cleanup, derive, discover, extract, ingest, publish
from photoflow.storage import MemoryStorage
from tests.test_catalog import config

requires_media_tools = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("exiftool")),
    reason="ffmpeg and exiftool are required for the media pipeline",
)


def make_jpeg(path, size=(800, 600), colour=(180, 90, 60)):
    Image.new("RGB", size, colour).save(path, "JPEG")
    return path.read_bytes()


def make_video(path, seconds=1, height=480):
    width = (height * 16 // 9) // 2 * 2
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", f"testsrc=duration={seconds}:size={width}x{height}:rate=15",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)],
        check=True,
    )
    return path.read_bytes()


def run_pipeline(storage, work_dir):
    context = Context(config=config(), storage=storage, work_dir=str(work_dir))
    discover.run(context)
    ingest.run(context)
    extract.run(context)
    derive.run(context)
    publish.run(context)
    cleanup.run(context)
    return context


@requires_media_tools
def test_a_photo_becomes_a_catalog_item_with_a_tile_and_preview(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})

    context = run_pipeline(storage, tmp_path)

    assert len(context.items) == 1
    item = next(iter(context.items.values()))
    file = item.files[0]

    assert file.tileVersion == derive.TILE_VERSION
    assert file.previewVersion == derive.PREVIEW_VERSION
    assert file.thumbHash
    assert item.widthPixels == 800 and item.heightPixels == 600
    assert item.megapixels == 0.5

    assert storage.exists(keys.tile(file.fileId))
    assert storage.exists(keys.preview(file.fileId, ".jpeg"))
    assert storage.exists(keys.original(file.fileId))


@requires_media_tools
def test_the_upload_is_removed_from_incoming_once_stored(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})

    run_pipeline(storage, tmp_path)

    assert not [entry for entry in storage.list(keys.INCOMING)]


@requires_media_tools
def test_reuploading_the_same_photo_does_not_create_a_second_item(tmp_path):
    body = make_jpeg(tmp_path / "a.jpg")
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": body})
    run_pipeline(storage, tmp_path)

    # The same bytes arriving again under a different name is the common case when
    # a phone backup app re-sends its camera roll.
    storage.put(keys.INCOMING + "IMG_0001_1730928000000.JPG", body, "image/jpeg")
    context = run_pipeline(storage, tmp_path)

    assert len(context.items) == 1
    assert any("1 duplicates" in note for note in context.notes)


@requires_media_tools
def test_a_live_photo_pair_becomes_one_item(tmp_path):
    storage = MemoryStorage({
        keys.INCOMING + "IMG_4021.JPG": make_jpeg(tmp_path / "still.jpg"),
        keys.INCOMING + "IMG_4021.MP4": make_video(tmp_path / "clip.mp4"),
    })

    context = run_pipeline(storage, tmp_path)

    assert len(context.items) == 1
    item = next(iter(context.items.values()))
    assert len(item.files) == 2
    assert {file.contentType for file in item.files} == {"image/jpeg", "video/mp4"}


@requires_media_tools
def test_a_clip_already_in_a_browser_safe_codec_is_still_transcoded(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "CLIP.MP4": make_video(tmp_path / "clip.mp4")})

    context = run_pipeline(storage, tmp_path)
    file = next(iter(context.items.values())).files[0]

    assert file.tileVersion == derive.TILE_VERSION
    assert file.previewVersion == derive.PREVIEW_VERSION
    assert storage.exists(keys.preview(file.fileId, ".mp4"))


@requires_media_tools
def test_an_oversized_clip_is_transcoded_into_a_preview(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "BIG.MP4": make_video(tmp_path / "big.mp4", height=1440)})

    context = run_pipeline(storage, tmp_path)
    file = next(iter(context.items.values())).files[0]

    assert file.previewVersion == derive.PREVIEW_VERSION
    assert storage.exists(keys.preview(file.fileId, ".mp4"))


@requires_media_tools
def test_non_media_uploads_are_discarded(tmp_path):
    storage = MemoryStorage({
        keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg"),
        keys.INCOMING + "IMG_0001.JPG.json": b'{"title": "takeout sidecar"}',
    })

    context = run_pipeline(storage, tmp_path)

    assert len(context.items) == 1
    assert any("ignored 1" in note for note in context.notes)


@requires_media_tools
def test_a_second_run_with_nothing_new_leaves_the_catalog_byte_identical(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    run_pipeline(storage, tmp_path)

    shard_before = storage.get(keys.shard(_only_month(storage)))
    run_pipeline(storage, tmp_path)

    assert storage.get(keys.shard(_only_month(storage))) == shard_before


def _only_month(storage) -> str:
    return storage.get_json(keys.CATALOG_MANIFEST)["shards"][0]["month"]


@requires_media_tools
def test_a_reprocess_request_rebuilds_the_file_in_place(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    first = run_pipeline(storage, tmp_path)

    item = next(iter(first.items.values()))
    file = item.files[0]
    month = _only_month(storage)

    # Throw away a derived file the way a failed or outdated run would leave it.
    storage.delete(keys.tile(file.fileId))
    storage.put_json(keys.reprocess_request(file.fileId), {"fileId": file.fileId})

    second = run_pipeline(storage, tmp_path)

    assert storage.exists(keys.tile(file.fileId))
    # The request is consumed, so the next run does not repeat the work.
    assert not storage.list(keys.META_REPROCESS)
    # No second item, and it stayed in the month it was uploaded in.
    assert len(second.items) == 1
    assert _only_month(storage) == month


@requires_media_tools
def test_reprocessing_does_not_duplicate_or_re_upload_the_original(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    first = run_pipeline(storage, tmp_path)

    file = next(iter(first.items.values())).files[0]
    original_before = storage.get(keys.original(file.fileId))

    storage.put_json(keys.reprocess_request(file.fileId), {"fileId": file.fileId})
    second = run_pipeline(storage, tmp_path)

    assert storage.get(keys.original(file.fileId)) == original_before
    assert len(next(iter(second.items.values())).files) == 1


@requires_media_tools
def test_a_request_for_a_file_that_is_gone_is_discarded(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    run_pipeline(storage, tmp_path)

    storage.put_json(keys.reprocess_request("0" * 64), {"fileId": "0" * 64})
    context = run_pipeline(storage, tmp_path)

    # Otherwise it would be retried every night forever.
    assert not storage.list(keys.META_REPROCESS)
    assert any("unknown file" in note for note in context.notes)


def run_full_pipeline(storage, work_dir):
    """The ordinary pipeline, including the repair step."""
    from photoflow.steps import backfill
    context = Context(config=config(), storage=storage, work_dir=str(work_dir))
    discover.run(context)
    ingest.run(context)
    backfill.run(context)
    extract.run(context)
    derive.run(context)
    publish.run(context)
    cleanup.run(context)
    return context


@requires_media_tools
def test_a_missing_thumbnail_is_rebuilt_on_the_next_run(tmp_path):
    # This is the state a migration leaves behind: the photo and its preview are
    # in place, but the thumbnail belonged to a bucket that is no longer used.
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    first = run_full_pipeline(storage, tmp_path)

    file = next(iter(first.items.values())).files[0]
    storage.delete(keys.tile(file.fileId))
    file.tileVersion = None
    _rewrite_shard(storage, first)

    second = run_full_pipeline(storage, tmp_path)

    assert storage.exists(keys.tile(file.fileId))
    assert next(iter(second.items.values())).files[0].tileVersion == derive.TILE_VERSION


@requires_media_tools
def test_the_rebuild_reads_the_preview_rather_than_the_original(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg")})
    first = run_full_pipeline(storage, tmp_path)

    file = next(iter(first.items.values())).files[0]
    file.tileVersion = None
    _rewrite_shard(storage, first)

    # Pulling whole originals back out of storage to rebuild files a fraction of
    # their size is the thing this must not do.
    storage.delete(keys.original(file.fileId))
    second = run_full_pipeline(storage, tmp_path)

    assert storage.exists(keys.tile(file.fileId))
    assert next(iter(second.items.values())).files[0].tileVersion == derive.TILE_VERSION


@requires_media_tools
def test_a_rebuild_does_not_re_transcode_the_video(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "BIG.MP4": make_video(tmp_path / "big.mp4", height=1440)})
    first = run_full_pipeline(storage, tmp_path)

    file = next(iter(first.items.values())).files[0]
    preview_before = storage.get(keys.preview(file.fileId, ".mp4"))

    file.tileVersion = None
    _rewrite_shard(storage, first)
    run_full_pipeline(storage, tmp_path)

    assert storage.get(keys.preview(file.fileId, ".mp4")) == preview_before


@requires_media_tools
def test_a_file_that_failed_is_left_alone_by_the_repair(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "BROKEN.JPG": b"not an image" * 50})
    first = run_full_pipeline(storage, tmp_path)

    file = next(iter(first.items.values())).files[0]
    assert file.failedProcessingTimeUtc

    # Retrying it every night forever is what a reprocess request is for.
    second = run_full_pipeline(storage, tmp_path)
    assert second.backfill == []


def _rewrite_shard(storage, context):
    """Persist an edit made directly to a loaded item, as a migration would."""
    from photoflow.models import ShardDocument
    month = _only_month(storage)
    storage.put_model(month_key := keys.shard(month), ShardDocument(month=month, items=list(context.items.values())))
    return month_key


@requires_media_tools
def test_same_filename_in_two_incoming_folders_stays_two_photos(tmp_path):
    """Copying a library in keeps its folders, and IMG_1234.JPG recurs across years.

    Both have to come through with their own pixels: they share a temp filename
    while being fetched, and one download overwriting the other is silent.
    """
    storage = MemoryStorage({
        keys.INCOMING + "2024/12/IMG_1234.JPG": _dated_jpeg(tmp_path / "a.jpg", (800, 600), "2024:12:07 13:46:15"),
        keys.INCOMING + "2025/03/IMG_1234.JPG": _dated_jpeg(tmp_path / "b.jpg", (400, 300), "2025:03:18 09:15:00"),
    })

    context = run_pipeline(storage, tmp_path)

    assert len(context.items) == 2
    assert {i.widthPixels for i in context.items.values()} == {800, 400}
    for item in context.items.values():
        assert storage.exists(keys.tile(item.files[0].fileId))


def _dated_jpeg(path, size, taken):
    """A photo with a real capture date, which is what separates two years' IMG_1234."""
    make_jpeg(path, size=size)
    subprocess.run(
        ["exiftool", "-overwrite_original", "-q", f"-DateTimeOriginal={taken}", str(path)],
        check=True,
    )
    return path.read_bytes()


def run_pipeline_with(storage, work_dir, workers):
    from photoflow.steps import backfill
    pathlib.Path(work_dir).mkdir(parents=True, exist_ok=True)
    context = Context(config=config(), storage=storage, work_dir=str(work_dir), workers=workers)
    for step in (discover, ingest, backfill, extract, derive, publish, cleanup):
        step.run(context)
    return context


@requires_media_tools
def test_parallel_processing_produces_the_same_catalog_as_sequential(tmp_path):
    def library(root):
        root.mkdir(exist_ok=True)
        return {
            keys.INCOMING + f"IMG_{n}.JPG": _dated_jpeg(root / f"{n}.jpg", (300 + n * 10, 200), f"2025:03:{n:02d} 10:00:00")
            for n in range(1, 13)
        }

    one = MemoryStorage(library(tmp_path / "a"))
    many = MemoryStorage(library(tmp_path / "b"))

    sequential = run_pipeline_with(one, tmp_path / "wa", workers=1)
    parallel = run_pipeline_with(many, tmp_path / "wb", workers=6)

    # Same photos in, same catalog out — ids come from content, so they match.
    assert sorted(sequential.items) == sorted(parallel.items)
    assert len(parallel.items) == 12
    for item_id, item in parallel.items.items():
        assert item.widthPixels == sequential.items[item_id].widthPixels
        assert item.files[0].tileVersion == derive.TILE_VERSION
        assert many.exists(keys.tile(item.files[0].fileId))


@requires_media_tools
def test_two_copies_of_one_photo_in_a_parallel_batch_are_still_one_item(tmp_path):
    # Both hit the dedupe check at once; without a lock each would pass it and
    # the photo would be catalogued twice.
    same = _dated_jpeg(tmp_path / "same.jpg", (400, 300), "2025:03:01 10:00:00")
    storage = MemoryStorage({
        keys.INCOMING + f"copy{n}/IMG_1.JPG": same for n in range(1, 7)
    })

    context = run_pipeline_with(storage, tmp_path, workers=6)

    assert len(context.items) == 1
    assert any("5 duplicates" in note for note in context.notes)


@requires_media_tools
def test_a_rotated_photo_still_gets_a_full_width_preview(tmp_path):
    """The DCT-scaled decode must not shorten a portrait photo's preview.

    Pillow's draft refuses to go below either dimension it is asked for, so asking
    along the stored width — which becomes the *height* once the EXIF rotation is
    applied — silently yields a preview well under PREVIEW_WIDTH. Most phone photos
    are rotated this way, so the regression would have been the common case.
    """
    source = tmp_path / "portrait.jpg"
    image = Image.new("RGB", (4032, 3024), (70, 120, 200))
    exif = image.getexif()
    exif[0x0112] = 6  # stored landscape, displayed portrait
    image.save(source, "JPEG", exif=exif)

    with Image.open(source) as opened:
        derive._draft_to_preview(opened)
        from PIL import ImageOps

        displayed = ImageOps.exif_transpose(opened)

    assert displayed.width >= derive.PREVIEW_WIDTH, (
        f"preview would be {displayed.width}px wide, short of {derive.PREVIEW_WIDTH}"
    )


@requires_media_tools
def test_an_unrotated_photo_is_decoded_at_a_reduced_scale(tmp_path):
    """The whole point of the draft: fewer pixels to resize."""
    source = tmp_path / "landscape.jpg"
    Image.new("RGB", (4032, 3024), (200, 120, 70)).save(source, "JPEG")

    with Image.open(source) as opened:
        derive._draft_to_preview(opened)
        assert opened.width < 4032
        assert opened.width >= derive.PREVIEW_WIDTH


@requires_media_tools
def test_metadata_for_a_whole_batch_comes_back_keyed_by_path(tmp_path):
    """One exiftool call has to be mapped back onto the files that went into it."""
    paths = []
    for index in range(5):
        path = tmp_path / f"IMG_{index}.jpg"
        make_jpeg(path)
        paths.append(str(path))

    tags = extract.read_tags_many(paths, str(tmp_path))

    assert set(tags) == set(paths)
    assert all(tags[path]["ImageWidth"] == 800 for path in paths)


def test_an_unreadable_file_is_absent_rather_than_shifting_the_others(tmp_path):
    """A failure must not slide metadata onto the wrong file.

    Results come back keyed by path precisely so that a file exiftool cannot read
    drops out instead of misaligning everything after it.
    """
    good = tmp_path / "good.jpg"
    make_jpeg(good)
    broken = tmp_path / "broken.jpg"
    broken.write_bytes(b"not a jpeg at all")

    tags = extract.read_tags_many([str(broken), str(good)], str(tmp_path))

    assert str(good) in tags
    assert tags[str(good)]["ImageWidth"] == 800


@requires_media_tools
def test_a_throttled_upload_is_left_for_the_next_run(tmp_path):
    """A bucket answering SlowDown costs one file, not the whole import."""

    class ThrottleOnce(MemoryStorage):
        throttled = False

        def copy(self, source_key, destination_key, content_type):
            if not self.throttled and source_key.endswith("IMG_0001.JPG"):
                self.throttled = True
                raise RuntimeError("SlowDown: too many requests")
            super().copy(source_key, destination_key, content_type)

    storage = ThrottleOnce({
        keys.INCOMING + "IMG_0001.JPG": make_jpeg(tmp_path / "a.jpg"),
        keys.INCOMING + "IMG_0002.JPG": make_jpeg(tmp_path / "b.jpg", colour=(20, 120, 200)),
    })

    first = run_pipeline(storage, tmp_path)

    assert len(first.items) == 1
    assert storage.exists(keys.INCOMING + "IMG_0001.JPG")
    assert any("could not ingest" in note for note in first.notes)

    second = run_pipeline(storage, tmp_path)

    assert len(second.items) == 2
    assert not storage.list(keys.INCOMING)
