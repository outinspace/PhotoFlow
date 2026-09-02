"""Splitting a month that holds too many items for one file.

The point is not the split itself but what it buys: editing one photo in a
month of twenty thousand should rewrite one part, not the lot.
"""

from photoflow import keys
from photoflow.models import ManifestDocument, ShardDocument
from photoflow.steps import discover, publish
from photoflow.steps.publish import MAX_ITEMS_PER_SHARD, split_into_parts
from photoflow.storage import MemoryStorage
from tests.test_catalog import config, context, item


def many(count: int, month: str = "2025-01"):
    return {n: item(n, month) for n in range(1, count + 1)}


def publish_all(storage, items, months={"2025-01"}):
    ctx = context(storage)
    ctx.items = dict(items)
    ctx.dirty_months = set(months)
    publish.run(ctx)
    return ctx


def shard_keys(storage):
    return sorted(o.key for o in storage.list(keys.CATALOG_SHARDS))


def test_a_small_month_stays_one_file_with_its_original_name():
    storage = MemoryStorage()
    publish_all(storage, many(50))

    # Anything written before splitting existed must still be found.
    assert shard_keys(storage) == ["catalog/shards/2025-01.json"]


def test_a_large_month_is_split_into_parts():
    storage = MemoryStorage()
    publish_all(storage, many(MAX_ITEMS_PER_SHARD * 2 + 10))

    assert shard_keys(storage) == [
        "catalog/shards/2025-01.json",
        "catalog/shards/2025-01.p2.json",
        "catalog/shards/2025-01.p3.json",
    ]


def test_every_item_survives_the_split():
    storage = MemoryStorage()
    items = many(MAX_ITEMS_PER_SHARD * 2 + 10)
    publish_all(storage, items)

    seen = set()
    for key in shard_keys(storage):
        seen.update(i.itemId for i in ShardDocument.model_validate_json(storage.get(key)).items)

    assert seen == set(items)


def test_the_manifest_lists_every_part():
    storage = MemoryStorage()
    publish_all(storage, many(MAX_ITEMS_PER_SHARD * 2 + 10))

    manifest = storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument)

    assert [(e.month, e.part) for e in manifest.shards] == [("2025-01", 1), ("2025-01", 2), ("2025-01", 3)]
    assert sum(e.items for e in manifest.shards) == MAX_ITEMS_PER_SHARD * 2 + 10


def test_editing_one_photo_rewrites_only_the_part_holding_it():
    storage = MemoryStorage()
    items = many(MAX_ITEMS_PER_SHARD * 3)
    publish_all(storage, items)

    before = {key: storage.get(key) for key in shard_keys(storage)}
    stamps = {(e.month, e.part): e.updatedAt
              for e in storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument).shards}

    # The whole reason for splitting: one changed photo, one changed download.
    edited = sorted(items)[0]
    items[edited].files[0].tileVersion = 99
    publish_all(storage, items)

    after = {key: storage.get(key) for key in shard_keys(storage)}
    changed = [key for key in after if after[key] != before[key]]

    assert len(changed) == 1

    now = {(e.month, e.part): e.updatedAt
           for e in storage.get_model(keys.CATALOG_MANIFEST, ManifestDocument).shards}
    # Unchanged parts keep their timestamp, so a browser does not refetch them.
    assert sum(1 for key in stamps if stamps[key] != now[key]) == 1


def test_republishing_unchanged_items_rewrites_nothing():
    storage = MemoryStorage()
    items = many(MAX_ITEMS_PER_SHARD * 2)
    publish_all(storage, items)

    before = {key: storage.get(key) for key in shard_keys(storage)}
    context_after = publish_all(storage, items)

    assert {key: storage.get(key) for key in shard_keys(storage)} == before
    assert any("0 shard parts" in note for note in context_after.notes)


def test_a_month_that_shrinks_leaves_no_stale_parts_behind():
    storage = MemoryStorage()
    items = many(MAX_ITEMS_PER_SHARD * 3)
    publish_all(storage, items)
    assert len(shard_keys(storage)) == 3

    # Deleting objects is what actually removes photos; the catalog just stops
    # listing them. A part left behind would be loaded forever.
    smaller = {k: v for k, v in list(items.items())[:MAX_ITEMS_PER_SHARD]}
    publish_all(storage, smaller)

    assert shard_keys(storage) == ["catalog/shards/2025-01.json"]


def test_discover_reads_every_part_back():
    storage = MemoryStorage()
    items = many(MAX_ITEMS_PER_SHARD * 2 + 5)
    publish_all(storage, items)

    reloaded = context(storage)
    discover.run(reloaded)

    assert set(reloaded.items) == set(items)


def test_the_split_is_ordered_by_an_id_that_never_changes():
    # Ordering by capture time would move boundaries whenever a photo was edited
    # or a new one landed mid-month, changing every part after it.
    items = list(many(MAX_ITEMS_PER_SHARD + 1).values())

    forward = [i.itemId for part in split_into_parts(items) for i in part]
    reversed_input = [i.itemId for part in split_into_parts(list(reversed(items))) for i in part]

    assert forward == reversed_input == sorted(forward)


def test_an_empty_month_still_produces_one_part():
    assert split_into_parts([]) == [[]]
