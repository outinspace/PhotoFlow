import { Item } from "../types";
import * as keys from "../storage/keys";

// Everything derived from a shard entry that the gallery needs but the worker does
// not store. Media locations are bucket keys rather than URLs: the bucket is
// private, so a URL only exists once it has been signed, which happens per tile as
// it renders.

export const computeItemProperties = (item: Item) => {
    for (const file of item.files) {
        // A shared document arrives with signed URLs already in these fields, since
        // its reader cannot sign one. Only fill in what is missing.
        file.originalSource ??= keys.original(file.fileId);

        // The version is a cache buster: a reprocessed tile keeps its key, because
        // that key is the hash of the original, so without this the browser would
        // go on showing the tile it already had.
        file.tileImageSource ??= file.tileVersion
            ? `${keys.tile(file.fileId)}?t=${file.lastProcessedTimeUtc}`
            : null;

        file.previewSource ??= computePreviewSource(file);
    }

    // Favourites and deletions live in meta/, not in the catalog, so a fresh item
    // starts from these defaults until the mutation overlay is applied.
    item.isFavorite = item.isFavorite ?? false;
    item.deletedTimeUtc = item.deletedTimeUtc ?? null;

    item.primaryFile = item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0];

    // A photo whose date nothing knew is stored without one. The upload time
    // stands in so every consumer can format and group by a real date, and the
    // flag is what the gallery sorts on to keep those out of the timeline. Read
    // before the fallback, which is what makes the distinction survive it.
    item.hasCaptureDate = !!item.captureTime;
    item.captureTime = item.captureTime ?? item.primaryFile.uploadTimeUtc;

    item.totalBytes = item.files.reduce((sum, file) => sum + file.sizeBytes, 0);

    item.device = item.cameraMake !== null && item.cameraModel !== null ? `${item.cameraMake} ${item.cameraModel}` : null;

    item.type = getType(item);
}

const computePreviewSource = (file: Item['files'][number]) => {
    if (!file.previewVersion) {
        return null;
    }

    const previewExtension = file.contentType.startsWith('image') ? '.jpeg' : '.mp4';
    return `${keys.preview(file.fileId, previewExtension)}?t=${file.lastProcessedTimeUtc}`;
}

const getType = (item: Item) => {
    if (item.files.length === 1 && item.files[0].contentType.startsWith('image')) {
        return 'photo';
    } else if (item.files.length === 1 && item.files[0].contentType.startsWith('video')) {
        return 'video';
    } else {
        return 'live-photo';
    }
}
