export interface Item {
    itemId: number;
    isFavorite: boolean;
    captureTime: string;
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
