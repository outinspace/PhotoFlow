"""Carrying edits over from the old database, matched by content hash.

The photos come in through incoming/ like any upload and get new ids, so the old
database's ids mean nothing here. Each file's content hash is the join.
"""

import sqlite3

from photoflow import keys
from photoflow.migrate import DEVICE_ID, load_catalog_index, next_seq, plan_operations, write_log
from photoflow.models import DeviceLogDocument
from photoflow.steps.compact import merge
from photoflow.storage import MemoryStorage
from tests.test_catalog import config, context, item
from photoflow.steps import publish

OLD_SCHEMA = """
CREATE TABLE tb_Items (ItemId INTEGER PRIMARY KEY, IsFavorite INTEGER, DeletedTimeUtc TEXT, ModifiedTimeUtc TEXT);
CREATE TABLE tb_Files (FileId TEXT PRIMARY KEY, ItemId INTEGER, HashSha256 TEXT);
CREATE TABLE tb_Albums (AlbumId INTEGER PRIMARY KEY, Name TEXT, CreatedTimeUtc TEXT, UpdatedTimeUtc TEXT, ShareSecret TEXT);
CREATE TABLE tb_ItemAlbum (ItemId INTEGER, AlbumId INTEGER);
"""


def old_db(rows):
    connection = sqlite3.connect(":memory:")
    connection.executescript(OLD_SCHEMA)
    for statement in rows:
        connection.execute(statement)
    connection.commit()
    return connection


def catalog_with(storage, **items_by_hash):
    """A new-format catalog where each named item holds one file with that hash."""
    ctx = context(storage)
    for item_id, content_hash in items_by_hash.items():
        record = item(item_id, "2026-08")
        record.files[0].hashSha256 = content_hash
        record.files[0].fileId = content_hash
        ctx.items[item_id] = record
    ctx.dirty_months = {"2026-08"}
    publish.run(ctx)
    return storage


def test_index_maps_each_hash_to_the_new_item_holding_it():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa", "502": "bbb"})

    index = load_catalog_index(storage)

    assert index == {"aaa": {501}, "bbb": {502}}


def test_a_favourite_follows_its_file_to_the_new_item():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 1, NULL, '2024-12-07 13:46:15.7349337')",
        "INSERT INTO tb_Files VALUES ('OLD-GUID', 1, 'AAA')",
    ])

    ops, report = plan_operations(db, load_catalog_index(storage))

    # Old id 1 and new id 501 share nothing but the hash, which is also matched
    # case-insensitively since the old API stored it in either case.
    assert ops == [{"seq": 1, "ts": "2024-12-07T13:46:15.734Z", "op": "item.favorite", "itemId": 501, "value": True}]
    assert report.favourites == 1


def test_a_deletion_carries_its_original_time():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 0, '2025-02-01 08:00:00.0000000', '2025-02-01 08:00:00.0000000')",
        "INSERT INTO tb_Files VALUES ('g', 1, 'aaa')",
    ])

    ops, _ = plan_operations(db, load_catalog_index(storage))

    assert ops[0]["op"] == "item.deleted"
    assert ops[0]["value"] == "2025-02-01T08:00:00.000Z"


def test_albums_keep_their_ids_and_members_follow_by_hash():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa", "502": "bbb"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 0, NULL, NULL)",
        "INSERT INTO tb_Items VALUES (2, 0, NULL, NULL)",
        "INSERT INTO tb_Files VALUES ('g1', 1, 'aaa')",
        "INSERT INTO tb_Files VALUES ('g2', 2, 'bbb')",
        "INSERT INTO tb_Albums VALUES (7, 'Iceland', '2025-03-01 10:00:00.0000000', '2025-03-05 11:00:00.0000000', NULL)",
        "INSERT INTO tb_ItemAlbum VALUES (1, 7)",
        "INSERT INTO tb_ItemAlbum VALUES (2, 7)",
    ])

    ops, report = plan_operations(db, load_catalog_index(storage))

    assert {"op": "album.create", "albumId": 7, "name": "Iceland"}.items() <= ops[0].items()
    assert sorted(o["itemId"] for o in ops if o["op"] == "album.member") == [501, 502]
    assert report.albums == 1 and report.memberships == 2


def test_a_photo_not_yet_reuploaded_is_reported_not_guessed():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 1, NULL, NULL)",
        "INSERT INTO tb_Files VALUES ('g', 1, 'not-in-catalog')",
    ])

    ops, report = plan_operations(db, load_catalog_index(storage))

    assert ops == []
    assert report.unmatched_items == 1


def test_an_old_item_split_across_two_new_items_marks_both():
    # A Live Photo the new grouping paired differently: the still and the clip
    # landed on separate items. Losing the favourite on one half would be worse
    # than marking both.
    storage = catalog_with(MemoryStorage(), **{"501": "still", "502": "clip"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 1, NULL, NULL)",
        "INSERT INTO tb_Files VALUES ('g1', 1, 'still')",
        "INSERT INTO tb_Files VALUES ('g2', 1, 'clip')",
    ])

    ops, report = plan_operations(db, load_catalog_index(storage))

    assert sorted(o["itemId"] for o in ops) == [501, 502]
    assert report.split_items == 1


def test_share_links_are_not_carried_but_are_named():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    db = old_db([
        "INSERT INTO tb_Albums VALUES (7, 'Iceland', '2025-03-01 10:00:00.0000000', NULL, 'secret-xyz')",
    ])

    ops, report = plan_operations(db, load_catalog_index(storage))

    # Carrying the secret without the share document would show a dead link.
    assert not any(o["op"] == "album.share" for o in ops)
    assert report.shared_albums_not_carried == ["Iceland"]


def test_the_log_it_writes_is_one_the_worker_merges():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa", "502": "bbb"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 1, NULL, '2024-12-07 13:46:15.7349337')",
        "INSERT INTO tb_Items VALUES (2, 0, '2025-02-01 08:00:00.0000000', '2025-02-01 08:00:00.0000000')",
        "INSERT INTO tb_Files VALUES ('g1', 1, 'aaa')",
        "INSERT INTO tb_Files VALUES ('g2', 2, 'bbb')",
        "INSERT INTO tb_Albums VALUES (7, 'Iceland', '2025-03-01 10:00:00.0000000', '2025-03-05 11:00:00.0000000', NULL)",
        "INSERT INTO tb_ItemAlbum VALUES (1, 7)",
    ])

    ops, _ = plan_operations(db, load_catalog_index(storage))
    write_log(storage, ops)

    # This is the whole point: no special import path, just a device log the
    # existing compaction understands.
    log = storage.get_model(keys.device_log(DEVICE_ID), DeviceLogDocument)
    state, applied = merge({"stateVersion": 1, "cursors": {}, "items": {}, "albums": {}}, [log.model_dump()])

    assert applied == len(ops)
    assert state["items"]["501"]["favorite"]["value"] is True
    assert state["items"]["502"]["deleted"]["value"] == "2025-02-01T08:00:00.000Z"
    assert state["albums"]["7"]["name"]["value"] == "Iceland"
    assert state["albums"]["7"]["members"]["501"]["in"]["value"] is True


def test_a_rerun_continues_after_what_was_already_compacted():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    from photoflow.models import StateDocument
    storage.put_model(keys.META_STATE, StateDocument(cursors={DEVICE_ID: 4}))

    # Otherwise a second run's operations would sit below the cursor and never apply.
    assert next_seq(storage) == 5


def test_an_edit_made_in_the_new_app_beats_the_old_databases_state():
    storage = catalog_with(MemoryStorage(), **{"501": "aaa"})
    db = old_db([
        "INSERT INTO tb_Items VALUES (1, 1, NULL, '2024-12-07 13:46:15.7349337')",
        "INSERT INTO tb_Files VALUES ('g', 1, 'aaa')",
    ])
    ops, _ = plan_operations(db, load_catalog_index(storage))

    # Someone un-favourited it on their phone last week, well after the old row
    # was last touched. Timestamping from the row rather than now is what lets
    # that newer edit win.
    phone = {"deviceId": "phone", "ops": [
        {"seq": 1, "ts": "2026-08-20T10:00:00.000Z", "op": "item.favorite", "itemId": 501, "value": False}]}
    state, _ = merge({"stateVersion": 1, "cursors": {}, "items": {}, "albums": {}},
                     [{"deviceId": DEVICE_ID, "ops": ops}, phone])

    assert state["items"]["501"]["favorite"]["value"] is False
