"""Fold per-device mutation logs into one compacted state file.

Favourites, deletions and album membership are written by browsers, not by this
worker. Each device owns exactly one log file and never writes any other, so two
devices can never collide on the same object and no locking or conditional write
is needed. Conflicts are resolved here, last-write-wins per field.

This step never deletes a log. It publishes how far it read, and each device
prunes its own log on its next write once it sees its entries are absorbed.
"""

from datetime import datetime, timezone

from .. import keys
from ..models import DeviceLogDocument, StateDocument
from ..storage import DocumentError

STATE_VERSION = 1


def run(context) -> None:
    state = context.storage.get_model(keys.META_STATE, StateDocument) or StateDocument()
    logs = _read_logs(context)

    merged, applied = merge(state.model_dump(), [log.model_dump() for log in logs])
    merged["compactedAt"] = datetime.now(timezone.utc).isoformat()

    context.merged_state = merged
    context.storage.put_model(keys.META_STATE, StateDocument.model_validate(merged))

    context.note(f"compacted {applied} operations from {len(logs)} device logs")


def merge(state: dict, logs: list[dict]) -> tuple[dict, int]:
    """Apply every log operation the state has not already absorbed.

    Kept pure so the merge can be tested without any storage at all.
    """
    items = dict(state.get("items", {}))
    albums = dict(state.get("albums", {}))
    cursors = dict(state.get("cursors", {}))
    applied = 0

    operations = []
    for log in logs:
        device_id = log.get("deviceId")
        if not device_id:
            continue
        seen = cursors.get(device_id, 0)
        for operation in log.get("ops", []):
            if operation.get("seq", 0) > seen:
                operations.append((device_id, operation))

    # Ordering by timestamp makes the outcome independent of which device's log
    # happened to be read first.
    operations.sort(key=lambda pair: (pair[1].get("ts", ""), pair[0]))

    for device_id, operation in operations:
        _apply(items, albums, operation)
        cursors[device_id] = max(cursors.get(device_id, 0), operation.get("seq", 0))
        applied += 1

    return (
        {
            "stateVersion": STATE_VERSION,
            "cursors": cursors,
            "items": items,
            "albums": albums,
        },
        applied,
    )


def _apply(items: dict, albums: dict, operation: dict) -> None:
    kind = operation.get("op")
    timestamp = operation.get("ts", "")

    if kind == "item.favorite":
        _set_field(items, str(operation["itemId"]), "favorite", operation["value"], timestamp)

    elif kind == "item.deleted":
        _set_field(items, str(operation["itemId"]), "deleted", operation["value"], timestamp)

    elif kind in ("album.create", "album.rename"):
        album = _album(albums, str(operation["albumId"]))
        if kind == "album.create" and not album.get("createdTimeUtc"):
            album["createdTimeUtc"] = timestamp
        _set_value(album, "name", operation["name"], timestamp)

    elif kind == "album.delete":
        _set_value(_album(albums, str(operation["albumId"])), "deleted", True, timestamp)

    elif kind == "album.share":
        _set_value(_album(albums, str(operation["albumId"])), "shareSecret", operation["secret"], timestamp)

    elif kind == "album.member":
        album = _album(albums, str(operation["albumId"]))
        members = album.setdefault("members", {})
        # Membership is tracked per photo rather than as one list, so two devices
        # adding different photos to the same album both survive the merge.
        _set_value(members.setdefault(str(operation["itemId"]), {}), "in", operation["value"], timestamp)


def _album(albums: dict, album_id: str) -> dict:
    return albums.setdefault(album_id, {"albumId": int(album_id)})


def _set_field(items: dict, item_id: str, field: str, value, timestamp: str) -> None:
    _set_value(items.setdefault(item_id, {}), field, value, timestamp)


def _set_value(target: dict, field: str, value, timestamp: str) -> None:
    existing = target.get(field)
    if existing is None or timestamp >= existing.get("ts", ""):
        target[field] = {"value": value, "ts": timestamp}


def _read_logs(context) -> list[DeviceLogDocument]:
    """Read every device's log, skipping any that no longer parse.

    These are the one class of document written by something other than this
    worker, and a browser mid-upgrade could leave one malformed. One unreadable
    log should cost that device's pending edits, not the whole night's run.
    """
    logs = []
    for entry in context.storage.list(keys.META_LOGS):
        if not entry.key.endswith(".json"):
            continue

        try:
            log = context.storage.get_model(entry.key, DeviceLogDocument)
        except DocumentError as error:
            context.note(f"skipping unreadable log {entry.key}: {error}")
            continue

        if log:
            logs.append(log)

    return logs
