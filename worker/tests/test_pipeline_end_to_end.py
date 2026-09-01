"""Runs the real pipeline over real files, against in-memory storage.

Everything here uses generated images and clips, so the test needs no credentials
and touches no network. The embedding step is exercised separately because it
downloads model weights.
"""

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

    assert storage.exists(keys.tile("", file.fileId))
    assert storage.exists(keys.preview("", file.fileId, ".jpeg"))
    assert storage.exists(keys.original("", file.fileId))


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
def test_a_small_h264_clip_is_served_as_its_own_preview(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "CLIP.MP4": make_video(tmp_path / "clip.mp4")})

    context = run_pipeline(storage, tmp_path)
    file = next(iter(context.items.values())).files[0]

    assert file.previewIsOriginal is True
    assert file.tileVersion == derive.TILE_VERSION
    # No transcoded near-duplicate was stored, which is the point of passthrough.
    assert not storage.exists(keys.preview("", file.fileId, ".mp4"))


@requires_media_tools
def test_an_oversized_clip_is_transcoded_into_a_preview(tmp_path):
    storage = MemoryStorage({keys.INCOMING + "BIG.MP4": make_video(tmp_path / "big.mp4", height=1440)})

    context = run_pipeline(storage, tmp_path)
    file = next(iter(context.items.values())).files[0]

    assert file.previewIsOriginal is False
    assert storage.exists(keys.preview("", file.fileId, ".mp4"))


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
