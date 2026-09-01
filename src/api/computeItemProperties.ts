import { Item } from "../types";

export const computeItemProperties = (item: Item, originalUrlPrefix: string, tileImageUrlPrefix: string, previewUrlPrefix: string) => {
    for (const file of item.files) {
        file.originalUrl = originalUrlPrefix + file.fileId;

        file.tileImageUrl = file.tileVersion ? `${tileImageUrlPrefix}${file.fileId}.jpeg?t=${file.lastProcessedTimeUtc}` : null;

        file.previewUrl = computePreviewUrl(file, previewUrlPrefix);
    }

    // Favourites and deletions live in meta/, not in the catalog, so a fresh item
    // starts from these defaults until the mutation overlay is applied.
    item.isFavorite = item.isFavorite ?? false;
    item.deletedTimeUtc = item.deletedTimeUtc ?? null;

    item.primaryFile = item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0];
    item.captureTime = item.captureTime ?? item.primaryFile.uploadTimeUtc;

    item.totalBytes = item.files.reduce((sum, file) => sum + file.sizeBytes, 0);

    item.device = item.cameraMake !== null && item.cameraModel !== null ? `${item.cameraMake} ${item.cameraModel}` : null;

    item.type = getType(item);
}

const computePreviewUrl = (file: Item['files'][number], previewUrlPrefix: string) => {
    if (!file.previewVersion) {
        return null;
    }

    // A clip that was already browser-playable has no separate preview file; the
    // original is the preview, which is why no transcode was stored for it.
    if (file.previewIsOriginal) {
        return file.originalUrl;
    }

    const previewExtension = file.contentType.startsWith('image') ? '.jpeg' : '.mp4';
    return `${previewUrlPrefix}${file.fileId}${previewExtension}?t=${file.lastProcessedTimeUtc}`;
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
