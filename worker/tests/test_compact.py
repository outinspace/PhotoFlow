from photoflow.steps.compact import merge


def log(device: str, *ops) -> dict:
    return {"deviceId": device, "ops": list(ops)}


def op(seq: int, ts: str, kind: str, **fields) -> dict:
    return {"seq": seq, "ts": ts, "op": kind, **fields}


def empty() -> dict:
    return {"stateVersion": 1, "cursors": {}, "items": {}, "albums": {}}


def test_favorite_is_applied():
    state, applied = merge(empty(), [log("phone", op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True))])

    assert applied == 1
    assert state["items"]["7"]["favorite"]["value"] is True


def test_latest_write_wins_across_devices():
    logs = [
        log("phone", op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True)),
        log("laptop", op(1, "2026-08-01T11:00:00Z", "item.favorite", itemId=7, value=False)),
    ]

    state, _ = merge(empty(), logs)
    assert state["items"]["7"]["favorite"]["value"] is False


def test_merge_order_does_not_depend_on_which_log_is_read_first():
    a = log("phone", op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True))
    b = log("laptop", op(1, "2026-08-01T11:00:00Z", "item.favorite", itemId=7, value=False))

    forward, _ = merge(empty(), [a, b])
    reverse, _ = merge(empty(), [b, a])

    assert forward["items"] == reverse["items"]


def test_two_devices_adding_different_photos_to_one_album_both_survive():
    # This is the reason membership is tracked per photo rather than as a list:
    # whole-list writes would make one device's addition overwrite the other's.
    logs = [
        log("phone",
            op(1, "2026-08-01T10:00:00Z", "album.create", albumId=3, name="Trip"),
            op(2, "2026-08-01T10:00:01Z", "album.member", albumId=3, itemId=100, value=True)),
        log("laptop",
            op(1, "2026-08-01T10:00:02Z", "album.member", albumId=3, itemId=200, value=True)),
    ]

    state, _ = merge(empty(), logs)
    members = state["albums"]["3"]["members"]

    assert members["100"]["in"]["value"] is True
    assert members["200"]["in"]["value"] is True


def test_already_compacted_operations_are_not_reapplied():
    first = log("phone", op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True))
    state, _ = merge(empty(), [first])

    # The device has not pruned its log yet, so the same op is still present.
    state, applied = merge(state, [first])

    assert applied == 0
    assert state["cursors"]["phone"] == 1


def test_a_later_unfavorite_survives_recompaction():
    state, _ = merge(empty(), [log("phone", op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True))])

    state, applied = merge(
        state,
        [log("phone",
             op(1, "2026-08-01T10:00:00Z", "item.favorite", itemId=7, value=True),
             op(2, "2026-08-02T10:00:00Z", "item.favorite", itemId=7, value=False))],
    )

    assert applied == 1
    assert state["items"]["7"]["favorite"]["value"] is False


def test_album_rename_and_delete():
    logs = [
        log("phone",
            op(1, "2026-08-01T10:00:00Z", "album.create", albumId=3, name="Trip"),
            op(2, "2026-08-02T10:00:00Z", "album.rename", albumId=3, name="Iceland"),
            op(3, "2026-08-03T10:00:00Z", "album.delete", albumId=3)),
    ]

    state, _ = merge(empty(), logs)
    album = state["albums"]["3"]

    assert album["name"]["value"] == "Iceland"
    assert album["deleted"]["value"] is True
    assert album["createdTimeUtc"] == "2026-08-01T10:00:00Z"


def test_deletion_and_restore_are_the_same_field():
    logs = [
        log("phone",
            op(1, "2026-08-01T10:00:00Z", "item.deleted", itemId=7, value="2026-08-01T10:00:00Z"),
            op(2, "2026-08-02T10:00:00Z", "item.deleted", itemId=7, value=None)),
    ]

    state, _ = merge(empty(), logs)
    assert state["items"]["7"]["deleted"]["value"] is None
