"""Runs the pipeline against real S3 semantics.

MemoryStorage is a convenient stand-in, but it cannot catch the things that
actually differ on a real bucket: pagination, 404 shapes on a missing key, or
content types surviving a round trip. moto serves a real S3 API in-process, so
these tests still need no credentials and no network.
"""

import pytest

boto3 = pytest.importorskip("boto3")
moto = pytest.importorskip("moto")

from photoflow import keys
from photoflow.models import ManifestDocument, ShardDocument
from photoflow.pipeline import Context
from photoflow.storage import S3Storage
from photoflow.steps import cleanup, derive, discover, extract, ingest, publish
from tests.test_catalog import config
from tests.test_pipeline_end_to_end import make_jpeg, requires_media_tools


def moto_config():
    # moto intercepts AWS-shaped endpoints, so the stand-in bucket uses one rather
    # than the example.invalid host the other tests use.
    settings = config()
    return type(settings)(**{**settings.__dict__, "endpoint_url": "https://s3.us-east-1.amazonaws.com"})


@pytest.fixture
def s3_storage():
    with moto.mock_aws():
        settings = moto_config()
        client = boto3.client("s3", region_name=settings.region)
        client.create_bucket(Bucket=settings.bucket)

        yield S3Storage(settings), client


def test_list_pages_past_the_thousand_key_limit(s3_storage):
    storage, client = s3_storage

    # S3 returns at most 1000 keys per response; a library well past that is the
    # normal case, so failing to paginate would silently hide most of it.
    for index in range(1050):
        client.put_object(Bucket=moto_config().bucket, Key=f"{keys.INCOMING}file{index:05d}.jpg", Body=b"x")

    assert len(storage.list(keys.INCOMING)) == 1050


def test_exists_is_false_for_a_missing_key_rather_than_raising(s3_storage):
    storage, _ = s3_storage

    assert storage.exists("catalog/manifest.json") is False


def test_json_round_trips(s3_storage):
    storage, _ = s3_storage

    storage.put_json("meta/example.json", {"b": 1, "a": 2})

    assert storage.get_json("meta/example.json") == {"b": 1, "a": 2}


def test_delete_of_a_missing_key_is_not_an_error(s3_storage):
    storage, _ = s3_storage

    storage.delete("incoming/never-existed.jpg")


@requires_media_tools
def test_a_full_run_against_a_real_bucket(s3_storage, tmp_path):
    storage, client = s3_storage
    settings = moto_config()

    client.put_object(
        Bucket=settings.bucket,
        Key=keys.INCOMING + "IMG_0001.JPG",
        Body=make_jpeg(tmp_path / "a.jpg"),
        ContentType="image/jpeg",
    )

    context = Context(config=settings, storage=storage, work_dir=str(tmp_path))
    for step in (discover, ingest, extract, derive, publish, cleanup):
        step.run(context)

    manifest = storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)
    assert manifest.counts.items == 1

    month = manifest.shards[0].month
    shard = storage.get_model(keys.shard(month), ShardDocument)
    file = shard.items[0].files[0]

    assert storage.exists(keys.original("", file.fileId))
    assert storage.exists(keys.tile("", file.fileId))
    assert storage.exists(keys.preview("", file.fileId, ".jpeg"))
    assert not storage.list(keys.INCOMING)

    # Tiles are served straight to <img> tags, so the stored content type has to
    # survive the upload or browsers will refuse to render them.
    head = client.head_object(Bucket=settings.bucket, Key=keys.tile("", file.fileId))
    assert head["ContentType"] == "image/jpeg"


@requires_media_tools
def test_a_second_run_against_a_real_bucket_is_a_no_op(s3_storage, tmp_path):
    storage, client = s3_storage
    settings = moto_config()

    client.put_object(
        Bucket=settings.bucket,
        Key=keys.INCOMING + "IMG_0001.JPG",
        Body=make_jpeg(tmp_path / "a.jpg"),
        ContentType="image/jpeg",
    )

    def run_once():
        context = Context(config=settings, storage=storage, work_dir=str(tmp_path))
        for step in (discover, ingest, extract, derive, publish, cleanup):
            step.run(context)
        return context

    run_once()
    second = run_once()

    assert len(second.items) == 1
    assert second.dirty_months == set()
