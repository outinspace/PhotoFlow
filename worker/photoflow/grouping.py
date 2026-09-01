"""Grouping files into items.

A Live Photo arrives as two files that share a filename stem (IMG_4021.HEIC and
IMG_4021.MOV). Cameras reuse those stems across years, so the stem alone is not
enough — files must also have been captured close together to be one item.
"""

import os
import re
from datetime import datetime, timedelta

GROUPING_WINDOW = timedelta(days=3)

# Uploaders append a timestamp to dodge camera-roll filename collisions
# (IMG_4021_1730928000000.HEIC); strip it so both halves of a Live Photo still match.
_UPLOAD_SUFFIX = re.compile(r"_\d{10,}$")


def group_key(original_file_name: str, capture_time: datetime) -> str:
    stem = os.path.splitext(original_file_name)[0]
    stem = _UPLOAD_SUFFIX.sub("", stem).lower()

    # Bucketing by window start keeps the key stable for files a few hours apart
    # without needing to compare every file against every other file.
    window_index = int(capture_time.timestamp() // GROUPING_WINDOW.total_seconds())

    return f"{stem}:{window_index}"


def group_keys_for(original_file_name: str, capture_time: datetime) -> list[str]:
    """Candidate keys for a file, nearest window first.

    A pair straddling a window boundary would otherwise land in different items, so
    a file also offers the previous window's key and takes it if an item is there.
    """
    previous = capture_time - GROUPING_WINDOW
    return [
        group_key(original_file_name, capture_time),
        group_key(original_file_name, previous),
    ]
