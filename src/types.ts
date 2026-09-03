export interface Item {
    itemId: number;
    isFavorite: boolean;
    captureTime: string;

    videoLength: number | null;
    widthPixels: number | null;
    heightPixels: number | null;
    longitude: number | null;
    latitude: number | null;
    altitude: number | null;
    city: string | null;
    region: string | null;
    megapixels: number | null;
    exposureTime: string | null;
    aperature: number | null;
    fNumber: number | null;
    iso: number | null;
    cameraMake: string | null;
    cameraModel: string | null;
    files: File[];

    deletedTimeUtc: string | null;

    // Computed
    primaryFile: File;
    totalBytes: number;
    device: string | null;
    type: 'photo' | 'video' | 'live-photo';
}

export interface File {
    fileId: string;
    contentType: string;
    hashSha256: string;
    originalFileName: string;
    sizeBytes: number;
    uploadTimeUtc: string;
    lastProcessedTimeUtc: string | null;
    failedProcessingTimeUtc: string | null;
    tileVersion: number | null;
    previewVersion: number | null;
    thumbHash: string | null;
    // True when the original is already browser-playable and is served as its own
    // preview, so the worker stored no near-duplicate transcode.
    previewIsOriginal: boolean;

    // Computed. Each holds either a bucket key, which the app signs when it renders,
    // or an absolute already-signed URL — which is what a shared document carries,
    // because whoever opens it has no credentials to sign with. Pass them through
    // useMediaUrl rather than into a src attribute.
    originalSource: string;
    tileImageSource: string | null;
    previewSource: string | null;
}

export interface Album {
    albumId: number;
    name: string;
    shareSecret: string | null;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    itemIds: number[];
}

export interface AlbumWithItems {
    albumId: number;
    name: string;
    shareSecret: string | null;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    itemIds: number[];

    items: Item[];
}
