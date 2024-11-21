export interface Item {
    itemId: number;
    isFavorite: boolean;
    captureTime: string;

    videoLength: string | null;
    widthPixels: number | null;
    heightPixels: number | null;
    longitude: number | null;
    latitude: number | null;
    altitude: number | null;
    megapixels: number | null;
    exposureTime: string | null;
    aperature: number | null;
    fNumber: number | null;
    iso: number | null;
    cameraMake: string | null;
    cameraModel: string | null;
    lensMake: string | null;
    lensModel: string | null;

    files: File[];
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
    processedVersion: number | null;
}

export interface GetGalleryResponse {
    items: Item[];
}
