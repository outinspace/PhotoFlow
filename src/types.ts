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
    originalFileName: string;
    sizeBytes: number;
    uploadTimeUtc: string;
    lastProcessedTimeUtc: string | null;
    tileVersion: number | null;
    previewVersion: number | null;

    // Computed
    originalUrl: string;
    tileImageUrl: string | null;
    previewUrl: string | null;
}

export interface Album {
    albumId: number;
    name: string;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    itemIds: number[];

    // Computed
    items: Item[];
}

export interface GetGalleryResponse {
    items: Item[];
    albums: Album[];

    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;

    // Computed
    deletedItems: Item[];
}
