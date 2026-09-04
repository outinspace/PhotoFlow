"""The first-run bucket check.

moto answers the CORS calls the way a real bucket does, so these cover the whole
S3 path; the B2 path is a different shape of rule for the same rule, which is
what is checked here.
"""

import pytest

boto3 = pytest.importorskip("boto3")
moto = pytest.importorskip("moto")

from photoflow import bucket_setup
from photoflow.storage import S3Storage
from tests.test_s3_storage import moto_config


@pytest.fixture
def bucket():
    with moto.mock_aws():
        settings = moto_config()
        client = boto3.client("s3", region_name=settings.region)
        client.create_bucket(Bucket=settings.bucket)
        yield settings, S3Storage(settings), client


def answers(monkeypatch, *replies):
    """Stand in for the operator, and fail rather than hang if asked more."""
    queued = list(replies)
    monkeypatch.setattr("sys.stdin.isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt="": queued.pop(0))
    return queued


def test_writes_a_rule_for_the_configured_origin_when_there_is_none(bucket, monkeypatch):
    settings, storage, client = bucket
    left = answers(monkeypatch, "y", "")  # yes, and keep the offered origin

    assert bucket_setup._ensure_cors(settings, storage) is True
    assert left == []

    rule = client.get_bucket_cors(Bucket=settings.bucket)["CORSRules"][0]
    assert rule["AllowedOrigins"] == ["https://photoflow.outin.space"]
    assert "PUT" in rule["AllowedMethods"]


def test_takes_a_different_origin_over_the_default(bucket, monkeypatch):
    settings, storage, client = bucket
    answers(monkeypatch, "y", "https://photos.example.com")

    assert bucket_setup._ensure_cors(settings, storage) is True
    assert client.get_bucket_cors(Bucket=settings.bucket)["CORSRules"][0]["AllowedOrigins"] == [
        "https://photos.example.com"
    ]


def test_declining_stops_the_run(bucket, monkeypatch):
    settings, storage, client = bucket
    answers(monkeypatch, "n")

    assert bucket_setup._ensure_cors(settings, storage) is False


def test_says_nothing_when_the_origin_is_already_allowed(bucket, monkeypatch):
    settings, storage, client = bucket
    client.put_bucket_cors(
        Bucket=settings.bucket,
        CORSConfiguration={"CORSRules": bucket_setup.s3_cors_rules(settings.app_origin)},
    )
    answers(monkeypatch)  # any question at all pops an empty list and fails

    assert bucket_setup._ensure_cors(settings, storage) is True


def test_a_private_bucket_passes_and_leaves_no_probe_behind(bucket, monkeypatch):
    settings, storage, _ = bucket
    answers(monkeypatch)

    assert bucket_setup._ensure_private(settings, storage) is True
    assert storage.list(bucket_setup.PROBE_KEY) == []


def test_a_public_bucket_is_caught(bucket, monkeypatch):
    settings, storage, client = bucket
    client.put_bucket_policy(
        Bucket=settings.bucket,
        Policy='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*",'
               f'"Action":"s3:GetObject","Resource":"arn:aws:s3:::{settings.bucket}/*"}}]}}',
    )
    assert bucket_setup._serves_unsigned_reads(storage) is True

    answers(monkeypatch, "n")
    assert bucket_setup._ensure_private(settings, storage) is False


def test_nothing_is_asked_without_a_terminal(bucket, monkeypatch):
    settings, storage, _ = bucket
    monkeypatch.setattr("sys.stdin.isatty", lambda: False)
    monkeypatch.setattr("builtins.input", lambda prompt="": pytest.fail("asked in CI"))

    assert bucket_setup.ensure_ready(settings, storage) is True


def test_the_b2_rule_allows_the_s3_operations_the_app_uses():
    # A rule allowing only the b2_ operations looks right and does nothing, since
    # the app goes through B2's S3 endpoint.
    rule = bucket_setup.b2_cors_rules("https://photoflow.outin.space")[0]
    assert rule["allowedOperations"] == ["s3_get", "s3_head", "s3_put"]
    assert not rule["corsRuleName"].startswith("b2-")  # B2 rejects that prefix
