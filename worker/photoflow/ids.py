"""Deterministic identifiers.

Nothing in this design assigns ids centrally, so they are derived from content.
Two runs over the same photos produce the same ids, which is what makes the whole
pipeline safely re-runnable.
"""

import hashlib

# 52 bits keeps ids inside JavaScript's exact-integer range, so the gallery can go
# on treating itemId as a number. Collision odds across 100k items are ~1 in 10^6.
ID_BITS = 52


def item_id_from_group_key(group_key: str) -> int:
    digest = hashlib.sha256(group_key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") >> (64 - ID_BITS)


def file_id_from_hash(hash_sha256: str) -> str:
    # The content hash is the file id, which makes re-uploading the same photo a
    # no-op instead of a duplicate.
    return hash_sha256


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
