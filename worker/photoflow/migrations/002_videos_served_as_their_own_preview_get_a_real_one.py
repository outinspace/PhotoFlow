"""Ask for a preview to be made for the videos that never had one.

A video whose original was already H.264 at 1080p or less used to be served as its
own preview, on the grounds that a transcode of it would be a near-duplicate file.
Too few clips qualified for that to be worth the branch, and what a camera writes
is laid out for a file rather than for a network, so those played back worse than
the transcoded ones beside them.

Clearing the version is what asks for one: backfill queues any file whose preview
is not current, fetches the original, and derive transcodes it like every other
video. Until that run reaches the file, the gallery shows its tile and no preview.
"""

from ..models import ItemRecord


def migrate(item: ItemRecord) -> bool:
    changed = False

    for file in item.files:
        if not file.previewIsOriginal:
            continue

        file.previewIsOriginal = False
        file.previewVersion = None
        changed = True

    return changed
