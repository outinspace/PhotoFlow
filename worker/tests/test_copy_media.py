"""Copying one tenant's media out of a shared bucket, server side."""

import sqlite3

import pytest

boto3 = pytest.importorskip("boto3")
moto = pytest.importorskip("moto")

from photoflow.copy_media import plan, run_copies

TENANT = "tenant-a"
OTHER = "tenant-b"

SCHEMA = """
CREATE TABLE tb_Items (ItemId INTEGER PRIMARY KEY, DeletedTimeUtc TEXT);
CREATE TABLE tb_Files (FileId TEXT PRIMARY KEY, OriginalFileName TEXT, ItemId INTEGER);
"""


@pytest.fixture
def database(tmp_path):
    path = tmp_path / "photoflow.db"
    connection = sqlite3.connect(path)
    connection.executescript(SCHEMA)
    connection.executescript("""
        INSERT INTO tb_Items VALUES (1, NULL), (2, NULL), (3, '2025-02-01 08:00:00');
        -- A Live Photo: two files, one item, sharing a stem.
        INSERT INTO tb_Files VALUES ('guid-1', 'IMG_4021.HEIC', 1);
        INSERT INTO tb_Files VALUES ('guid-2', 'IMG_4021.MOV', 1);
        -- Same filename as item 1, from a different year.
        INSERT INTO tb_Files VALUES ('guid-3', 'IMG_4021.HEIC', 2);
        INSERT INTO tb_Files VALUES ('guid-4', 'IMG_9999.HEIC', 3);
    """)
    connection.commit()
    return str(path)


@pytest.fixture
def buckets():
    with moto.mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="shared")
        client.create_bucket(Bucket="mine")
        for guid in ("guid-1", "guid-2", "guid-3", "guid-4"):
            client.put_object(Bucket="shared", Key=f"original/{TENANT}/{guid}", Body=f"bytes-{guid}".encode())
        client.put_object(Bucket="shared", Key=f"original/{OTHER}/guid-x", Body=b"not mine")
        yield client


def keys_in(client, bucket, prefix=""):
    return sorted(o["Key"] for o in client.list_objects_v2(Bucket=bucket, Prefix=prefix).get("Contents", []))


def test_the_guid_key_becomes_the_real_filename(database):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    by_source = {c.source_key: c.destination_key for c in copies}
    # Without the real name the worker sees application/octet-stream and pairs nothing.
    assert by_source[f"original/{TENANT}/guid-1"] == "incoming/1/IMG_4021.HEIC"


def test_a_filename_used_twice_lands_in_separate_folders(database):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    destinations = [c.destination_key for c in copies if c.destination_key.endswith("IMG_4021.HEIC")]
    # Same name, different items: one folder each, or the second overwrites the first.
    assert sorted(destinations) == ["incoming/1/IMG_4021.HEIC", "incoming/2/IMG_4021.HEIC"]


def test_a_live_photo_keeps_both_halves_together_with_a_shared_stem(database):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    pair = sorted(c.destination_key for c in copies if c.destination_key.startswith("incoming/1/"))
    assert pair == ["incoming/1/IMG_4021.HEIC", "incoming/1/IMG_4021.MOV"]


def test_deleted_photos_come_across_by_default(database):
    copies, non_media, deleted = plan(database, TENANT, "original/", include_deleted=True)

    assert (non_media, deleted) == (0, 0)
    assert any(c.destination_key == "incoming/3/IMG_9999.HEIC" for c in copies)


def test_deleted_photos_can_be_left_behind(database):
    copies, _, deleted = plan(database, TENANT, "original/", include_deleted=False)

    assert deleted == 1
    assert not any("IMG_9999" in c.destination_key for c in copies)


def test_only_the_named_tenant_is_copied(database, buckets):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)
    run_copies(buckets, "shared", "mine", copies, workers=4)

    assert keys_in(buckets, "mine") == [
        "incoming/1/IMG_4021.HEIC",
        "incoming/1/IMG_4021.MOV",
        "incoming/2/IMG_4021.HEIC",
        "incoming/3/IMG_9999.HEIC",
    ]


def test_the_bytes_are_untouched(database, buckets):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)
    run_copies(buckets, "shared", "mine", copies, workers=4)

    # The migration matches old edits to new photos by content hash, so a copy
    # that altered a single byte would silently match nothing.
    assert buckets.get_object(Bucket="mine", Key="incoming/1/IMG_4021.HEIC")["Body"].read() == b"bytes-guid-1"


def test_running_it_again_copies_nothing(database, buckets):
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)
    run_copies(buckets, "shared", "mine", copies, workers=4)

    # 46,000 objects is worth resuming rather than restarting.
    counts = run_copies(buckets, "shared", "mine", copies, workers=4)

    assert counts["already there"] == len(copies)
    assert counts["copied"] == 0


def test_a_row_whose_object_is_gone_is_reported_not_fatal(database, buckets):
    buckets.delete_object(Bucket="shared", Key=f"original/{TENANT}/guid-2")
    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    counts = run_copies(buckets, "shared", "mine", copies, workers=4)

    assert counts["source missing"] == 1
    assert counts["copied"] == 3
    assert counts["failed"] == 0


def test_macos_junk_is_not_copied(database, tmp_path):
    connection = sqlite3.connect(database)
    connection.executescript("""
        INSERT INTO tb_Items VALUES (4, NULL);
        INSERT INTO tb_Files VALUES ('guid-5', '._IMG_4021.HEIC', 4);
        INSERT INTO tb_Files VALUES ('guid-6', '.DS_Store', 4);
    """)
    connection.commit()

    copies, non_media, _ = plan(database, TENANT, "original/", include_deleted=True)

    # They have no extension to match on, and would otherwise be catalogued only
    # to sit in Failed Items forever.
    assert non_media == 2
    assert not any("._" in c.destination_key or "DS_Store" in c.destination_key for c in copies)


def test_the_source_key_is_lowercased_to_match_the_stored_objects(database):
    connection = sqlite3.connect(database)
    connection.execute("INSERT INTO tb_Items VALUES (9, NULL)")
    connection.execute("INSERT INTO tb_Files VALUES ('ABCD-1234-EF', 'IMG_1.HEIC', 9)")
    connection.commit()

    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    # The old app keyed objects with Guid.ToString(), which is lowercase, while the
    # database column holds the same id uppercased. S3 keys are case sensitive.
    assert any(c.source_key.endswith("/abcd-1234-ef") for c in copies)


def test_preflight_stops_a_run_whose_source_keys_are_all_wrong(database, buckets):
    from photoflow.copy_media import preflight

    copies, *_ = plan(database, TENANT, "wrong-folder/", include_deleted=True)
    problem = preflight(buckets, "shared", copies)

    # Otherwise the same failure is reported once per object, fifty thousand times.
    assert problem is not None and "wrong-folder/" in problem


def test_preflight_passes_when_the_source_is_right(database, buckets):
    from photoflow.copy_media import preflight

    copies, *_ = plan(database, TENANT, "original/", include_deleted=True)

    assert preflight(buckets, "shared", copies) is None
