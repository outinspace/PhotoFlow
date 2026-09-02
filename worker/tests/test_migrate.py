"""Importing a library from the old API's SQLite database.

The fixture mirrors the real schema, including the shapes that actually caused
trouble: .NET timestamps, DateTime.MinValue standing in for null, durations as
TimeSpan text, and numbers stored in TEXT columns.
"""

import sqlite3

import pytest

from photoflow import keys
from photoflow.migrate import _exposure, _video_length, read_catalog, read_state, shard_items, write
from photoflow.models import ManifestDocument, ShardDocument, StateDocument
from photoflow.storage import MemoryStorage
from tests.test_catalog import config

OLD_SCHEMA = """
CREATE TABLE tb_Items (
    ItemId INTEGER PRIMARY KEY, Altitude TEXT, Aperture TEXT, CameraMake TEXT, CameraModel TEXT,
    CaptureTimeOffsetMinutes INTEGER, CaptureTimeUtc TEXT, City TEXT, DeletedTimeUtc TEXT,
    ExposureTimeDenominator INTEGER, ExposureTimeNumerator INTEGER, FNumber TEXT,
    HeightPixels INTEGER, ISO INTEGER, IsFavorite INTEGER, Latitude TEXT, Longitude TEXT,
    Megapixels TEXT, ModifiedTimeUtc TEXT, Region TEXT, VideoLength TEXT, WidthPixels INTEGER,
    EmbeddingV1 BLOB);
CREATE TABLE tb_Files (
    FileId TEXT PRIMARY KEY, ContentType TEXT, HashSha256 TEXT, ItemId INTEGER,
    LastProcessedTimeUtc TEXT, MetadataVersion INTEGER, OriginalFileName TEXT,
    PreviewVersion INTEGER, SizeBytes INTEGER, TileVersion INTEGER, UploadTimeUtc TEXT,
    FailedProcessingTimeUtc TEXT, ThumbHash TEXT, ThumbHashVersion INTEGER, EmbeddingVersion INTEGER);
CREATE TABLE tb_Albums (AlbumId INTEGER PRIMARY KEY, Name TEXT, CreatedTimeUtc TEXT, UpdatedTimeUtc TEXT, ShareSecret TEXT);
CREATE TABLE tb_ItemAlbum (ItemId INTEGER, AlbumId INTEGER);
"""


@pytest.fixture
def old_db(tmp_path):
    connection = sqlite3.connect(tmp_path / "photoflow.db")
    connection.executescript(OLD_SCHEMA)

    connection.execute(
        "INSERT INTO tb_Items VALUES (1,'333.76',NULL,'Apple','iPhone 15',0,'2024-11-02 09:15:00.1234567',"
        "'Lisbon',NULL,250,1,'1.6',3024,400,1,'41.28','-8.61','12.19','2024-12-07 13:46:15.7349337',"
        "'Porto',NULL,4032,NULL)"
    )
    # No capture time: the old code wrote DateTime.MinValue rather than null.
    connection.execute(
        "INSERT INTO tb_Items VALUES (2,NULL,NULL,NULL,NULL,0,'0001-01-01 00:00:00',NULL,"
        "'2025-02-01 08:00:00.0000000',NULL,NULL,NULL,1080,NULL,0,NULL,NULL,NULL,"
        "'2025-02-01 08:00:00.0000000',NULL,'00:00:02.8316666',1920,NULL)"
    )

    connection.execute(
        "INSERT INTO tb_Files VALUES ('00005570-6BE1-49BE-820E-B97A51928CC3','image/heic','abc123',1,"
        "'2024-12-07 13:50:00.0000000',1,'IMG_4021.HEIC',3,2400000,2,'2024-12-07 13:46:15.7349337',"
        "NULL,'WxkGLQJWqf93x2N7mYd2VmLAimYL',1,2)"
    )
    connection.execute(
        "INSERT INTO tb_Files VALUES ('11115570-6BE1-49BE-820E-B97A51928CC4','video/quicktime','def456',2,"
        "NULL,1,'IMG_9000.MOV',3,9600000,2,'2025-02-01 07:59:00.0000000',"
        "'2025-02-01 08:05:00.0000000',NULL,NULL,NULL)"
    )

    connection.execute("INSERT INTO tb_Albums VALUES (7,'Iceland','2025-03-01 10:00:00.0000000','2025-03-05 11:00:00.0000000','secret-xyz')")
    connection.execute("INSERT INTO tb_ItemAlbum VALUES (1,7)")
    connection.commit()
    return connection


def test_reads_items_and_files(old_db):
    items, warnings = read_catalog(old_db)

    assert warnings == []
    assert set(items) == {1, 2}
    assert items[1].cameraModel == "iPhone 15"
    # Stored as TEXT in the old schema, but a number in the catalog.
    assert items[1].megapixels == pytest.approx(12.19)
    assert items[1].latitude == pytest.approx(41.28)


def test_timestamps_become_something_a_browser_can_parse(old_db):
    items, _ = read_catalog(old_db)

    assert items[1].captureTime == "2024-11-02T09:15:00.123Z"
    assert items[1].files[0].uploadTimeUtc == "2024-12-07T13:46:15.734Z"


def test_an_unknown_capture_time_falls_back_to_the_upload_time(old_db):
    items, _ = read_catalog(old_db)

    # The old sentinel would otherwise sort this item to the year 1.
    assert items[2].captureTime == "2025-02-01T07:59:00.000Z"


def test_thumbnails_are_dropped_so_they_are_rebuilt_in_this_bucket(old_db):
    items, _ = read_catalog(old_db)

    # The old ones live in a bucket shared between tenants and are not brought over.
    assert all(f.tileVersion is None for item in items.values() for f in item.files)


def test_previews_are_kept_so_no_video_is_transcoded_again(old_db):
    items, _ = read_catalog(old_db)

    assert all(f.previewVersion is not None for item in items.values() for f in item.files)
    assert all(f.previewIsOriginal is False for item in items.values() for f in item.files)


def test_search_vectors_are_dropped_because_the_model_changed(old_db):
    items, _ = read_catalog(old_db)

    # The old vectors came from a different model; comparing across the two would
    # rank nonsense, so every item is queued for re-embedding.
    assert all(item.embeddingVersion is None for item in items.values())


def test_file_ids_are_untouched_because_they_are_object_keys(old_db):
    items, _ = read_catalog(old_db)

    assert items[1].files[0].fileId == "00005570-6BE1-49BE-820E-B97A51928CC3"


def test_a_failed_file_stays_failed(old_db):
    items, _ = read_catalog(old_db)

    assert items[2].files[0].failedProcessingTimeUtc == "2025-02-01T08:05:00.000Z"


def test_favourites_and_deletions_become_mutable_state(old_db):
    items, _ = read_catalog(old_db)
    state = read_state(old_db, items)

    assert state.items["1"]["favorite"]["value"] is True
    assert state.items["2"]["deleted"]["value"] == "2025-02-01T08:00:00.000Z"
    # Timestamped from the row, so a newer edit on a device still wins the merge.
    assert state.items["1"]["favorite"]["ts"] == "2024-12-07T13:46:15.734Z"


def test_albums_carry_their_membership_and_share_link(old_db):
    items, _ = read_catalog(old_db)
    state = read_state(old_db, items)

    album = state.albums["7"]
    assert album["name"]["value"] == "Iceland"
    assert album["shareSecret"]["value"] == "secret-xyz"
    assert album["members"]["1"]["in"]["value"] is True


def test_items_are_sharded_by_upload_month(old_db):
    items, _ = read_catalog(old_db)

    assert sorted(shard_items(items)) == ["2024-12", "2025-02"]


def test_what_is_written_reads_back_as_a_valid_catalog(old_db):
    items, _ = read_catalog(old_db)
    state = read_state(old_db, items)
    storage = MemoryStorage()

    manifest = write(storage, config(), items, state)

    assert storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument).counts.items == 2
    assert storage.get_model(keys.META_STATE, StateDocument).albums["7"]["albumId"] == 7
    for entry in manifest.shards:
        assert storage.get_model(keys.shard(entry.month), ShardDocument) is not None


def test_video_length_converts_from_dotnet_timespan():
    assert _video_length("00:00:02.8316666") == pytest.approx(2.8316666)
    assert _video_length("00:00:07") == 7
    assert _video_length("1.02:00:00") == 93600
    assert _video_length(None) is None
    assert _video_length("nonsense") is None


def test_exposure_reads_the_way_a_camera_shows_it():
    assert _exposure(1, 250) == "1/250"
    assert _exposure(2, 4) == "1/2"
    assert _exposure(5, 2) == "2.5"
    assert _exposure(None, 250) is None
