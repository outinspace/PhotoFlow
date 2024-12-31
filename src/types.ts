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
    originalUrl: string;
    sizeBytes: number;
    tileImageUrl: string | null;
    previewUrl: string | null;
    uploadTimeUtc: string;
    lastProcessedTimeUtc: string | null;
}

export interface GetGalleryResponse {
    items: Item[];

    // Computed
    deletedItems: Item[];
}
