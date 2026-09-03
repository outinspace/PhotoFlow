"""Where the catalog actually lives in a public bucket.

The catalog sits at a fixed, guessable path, so on a public bucket it goes under a
random prefix. Media does not: it is named by content hash and read straight from
the CDN. Getting that split wrong is silent in one direction — the catalog stays
readable by anyone — which is why it is pinned here.
"""

import dataclasses

import pytest

from photoflow import keys
from photoflow.storage import S3Storage
from tests.test_catalog import config as base_config


def storage(prefix: str) -> S3Storage:
    return S3Storage(dataclasses.replace(base_config(), private_prefix=prefix))


@pytest.mark.parametrize("key", [
    keys.CATALOG_MANIFEST,
    keys.shard("2026-08"),
    keys.shard("2026-08", 3),
    keys.embeddings("2026-08"),
    keys.META_STATE,
    keys.META_HEARTBEAT,
    keys.device_log("phone"),
    keys.reprocess_request("abc"),
])
def test_a_guessable_key_moves_under_the_prefix(key):
    assert storage("s3cret").resolve(key) == f"s3cret/{key}"


@pytest.mark.parametrize("key", [
    "original/abc123",
    "tile-image/abc123.jpeg",
    "preview/abc123.mp4",
    "share/album/somesecret.json",
    # Same bytes as an original/ object named by its hash, so moving the upload
    # queue would hide nothing and cost hundreds of gigabytes of copying.
    keys.INCOMING,
    keys.INCOMING + "IMG_1234_1730928000000.HEIC",
])
def test_an_already_unguessable_key_stays_put(key):
    assert storage("s3cret").resolve(key) == key


def test_nothing_moves_when_no_prefix_is_configured():
    assert storage("").resolve(keys.CATALOG_MANIFEST) == keys.CATALOG_MANIFEST


def test_a_listed_key_survives_the_round_trip():
    """A listing hands back logical keys, or get() would prefix them a second time."""
    subject = storage("s3cret")
    stored = subject.resolve(keys.device_log("phone"))

    assert subject._logical(stored) == keys.device_log("phone")
    assert subject.resolve(subject._logical(stored)) == stored
