import { Item } from "../types";

export const computeItemProperties = (item: Item, originalUrlPrefix: string, tileImageUrlPrefix: string, previewUrlPrefix: string) => {
    for (const file of item.files) {
        file.originalUrl = originalUrlPrefix + file.fileId;

        file.tileImageUrl = file.tileVersion ? `${tileImageUrlPrefix}${file.fileId}.jpeg?t=${file.lastProcessedTimeUtc}` : null;

        const previewExtension = file.contentType.startsWith('image') ? '.jpeg' : '.mp4';
        file.previewUrl = file.previewVersion ? `${previewUrlPrefix}${file.fileId}${previewExtension}?t=${file.lastProcessedTimeUtc}` : null;
    }

    item.primaryFile = item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0];

    item.totalBytes = item.files.reduce((sum, file) => sum + file.sizeBytes, 0);

    item.device = item.cameraMake !== null && item.cameraModel !== null ? `${item.cameraMake} ${item.cameraModel}` : null;

    item.type = getType(item);
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

