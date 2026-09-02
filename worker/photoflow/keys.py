"""Every object key the system uses, in one place.

The gallery declares the same keys in src/storage/keys.ts, so changing one here
means changing that too.
"""

INCOMING = "incoming/"
CATALOG_MANIFEST = "catalog/manifest.json"
CATALOG_SHARDS = "catalog/shards/"
CATALOG_EMBEDDINGS = "catalog/embeddings/"
META_STATE = "meta/state.json"
META_LOGS = "meta/log/"
META_HEARTBEAT = "meta/heartbeat.json"
META_REPROCESS = "meta/reprocess/"


def original(file_id: str) -> str:
    return f"original/{file_id}"


def tile(file_id: str) -> str:
    return f"tile-image/{file_id}.jpeg"


def preview(file_id: str, extension: str) -> str:
    return f"preview/{file_id}{extension}"


def device_log(device_id: str) -> str:
    return f"{META_LOGS}{device_id}.json"


def reprocess_request(file_id: str) -> str:
    return f"{META_REPROCESS}{file_id}.json"


def shard(month: str, part: int = 1) -> str:
    """A month's shard, or one part of it when the month is too big for one file.

    The first part keeps the plain name, so a catalog written before months could
    be split still reads correctly.
    """
    suffix = "" if part <= 1 else f".p{part}"
    return f"{CATALOG_SHARDS}{month}{suffix}.json"


def embeddings(month: str) -> str:
    return f"{CATALOG_EMBEDDINGS}{month}.bin"
