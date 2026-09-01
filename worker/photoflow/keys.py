"""Every object key the system uses, in one place.

The gallery builds URLs from the same shapes, so changing a key here means
changing src/storage/catalog.ts too.
"""

INCOMING = "incoming/"
CATALOG_MANIFEST = "catalog/manifest.json"
CATALOG_SHARDS = "catalog/shards/"
CATALOG_EMBEDDINGS = "catalog/embeddings/"
META_STATE = "meta/state.json"
META_LOGS = "meta/log/"
META_HEARTBEAT = "meta/heartbeat.json"


def original(prefix: str, file_id: str) -> str:
    return f"original/{prefix}{file_id}"


def tile(prefix: str, file_id: str) -> str:
    return f"tile-image/{prefix}{file_id}.jpeg"


def preview(prefix: str, file_id: str, extension: str) -> str:
    return f"preview/{prefix}{file_id}{extension}"


def shard(month: str) -> str:
    return f"{CATALOG_SHARDS}{month}.json"


def embeddings(month: str) -> str:
    return f"{CATALOG_EMBEDDINGS}{month}.bin"
