export interface Item {
    itemId: number;
    isFavorite: boolean;
    captureTimeUtc: string;
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
}

export interface GetGalleryResponse {
    items: Item[];
}
