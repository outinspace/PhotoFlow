import { useMutation, useQuery } from "@tanstack/react-query";
import { AlbumWithItems, File, GetAlbumsResponse, GetGalleryResponse, GetPublicAlbumResponse, GetPublicItemResponse, Item } from "./types";
import constants from "./constants";
import { router } from "./routes";
import { queryClient } from "./app";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as idb from 'idb-keyval';
import { produce } from 'immer';
import { addMinutes } from "date-fns";


export const fetchAuthenticatedRoute = async (path: string, request?: RequestInit) => {
    request = request ?? {};

    request.headers = {
        ...request.headers,
        'Authorization': 'Session ' + localStorage.getItem('sessionId') ?? '',
        'x-tenant-id': localStorage.getItem('tenantId') ?? ''
    };

    const res = await fetch(constants.apiUrl + path, request);

    if (res.status === 401) {
        toast.error('You are not logged in.');

        queryClient.clear();
        localStorage.removeItem('tenantId');
        localStorage.removeItem('sessionId');

        router.navigate({ to: '/login' });

        throw new Error('Session Invalid');
    }

    // Display user errors
    if (res.status >= 400 && res.status < 500) {
        toast.error(await res.json());
    }

    return res;
}


interface UseGalleryData {
    items: Item[];
    deletedItems: Item[];
    checkpointTimeUtc: string;
}

export const useGallery = () => useQuery({
    queryKey: ['gallery'],
    staleTime: 0,
    queryFn: async () => {
        // Overlap checkpoints by 5 minutes to avoid clock skew between browser and server
        const newCheckpointUtc = addMinutes(new Date(), -5).toISOString();

        const cachedData = queryClient.getQueryData<UseGalleryData>(['gallery']);
        const cachedCheckpointUtc = cachedData?.checkpointTimeUtc;

        let queryParams = '';
        if (cachedCheckpointUtc) {
            queryParams = `?updatedSinceUtc=${cachedCheckpointUtc}`;
        }

        const res = await fetchAuthenticatedRoute('/items/gallery' + queryParams);

        const body = await res.json();
        const updatedGallery = body as GetGalleryResponse;

        // Merge cached and updated items
        const cachedItems = cachedData?.items ?? [];
        const mergedItemsMap: Record<number, Item> = {};

        for (const item of cachedItems) {
            mergedItemsMap[item.itemId] = item;
        }
        for (const item of updatedGallery.items) {
            mergedItemsMap[item.itemId] = item;
        }

        const mergedItems = Object.values(mergedItemsMap);

        // Computed properties
        for (const item of mergedItems) {
            computeItemProperties(
                item,
                updatedGallery.originalUrlPrefix,
                updatedGallery.tileImageUrlPrefix,
                updatedGallery.previewUrlPrefix
            );
        }

        // Separate deleted items
        const deletedItems = mergedItems.filter(item => item.deletedTimeUtc !== null);

        const items = mergedItems.filter(item => item.deletedTimeUtc === null);

        return {
            items,
            deletedItems,
            checkpointTimeUtc: newCheckpointUtc
        };
    }
});

export const usePublicItem = (tenantId: string, primaryFileId: string) => useQuery({
    queryKey: ['public', 'item', tenantId, primaryFileId],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute(`/public/item/${tenantId}/${primaryFileId}`);

        const body = await res.json();
        const response = body as GetPublicItemResponse;

        // Computed properties
        computeItemProperties(
            response.item,
            response.originalUrlPrefix,
            response.tileImageUrlPrefix,
            response.previewUrlPrefix
        );

        return response.item;
    }
});

export const usePublicAlbum = (tenantId: string, shareSecret: string) => useQuery({
    queryKey: ['public', 'album', tenantId, shareSecret],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute(`/public/album/${tenantId}/${shareSecret}`);

        const body = await res.json();
        const response = body as GetPublicAlbumResponse;

        // Computed properties
        for (const item of response.items) {
            computeItemProperties(
                item,
                response.originalUrlPrefix,
                response.tileImageUrlPrefix,
                response.previewUrlPrefix
            );
        }

        return response;
    }
});

const computeItemProperties = (item: Item, originalUrlPrefix: string, tileImageUrlPrefix: string, previewUrlPrefix: string) => {
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

export const useTileImageCache = () => useQuery({
    queryKey: ['tile-image-cache'],
    retry: false,
    staleTime: 5000,
    queryFn: async () => {
        const entries = await idb.entries();

        const files = entries
            .filter(([key, val]) => key.toString().startsWith('file/'))
            .map(entry => ({
                fileId: entry[0].toString().substring(5),
                buffer: entry[1].buffer,
                contentType: entry[1].contentType
            }));

        const map = {};
        for (const file of files) {
            map[file.fileId] = file;
        }

        return map;
    }
});

interface TileImageBlob {
    fileId: string;
    buffer: ArrayBuffer;
    contentType: string;
}

export const useTileImageBuffer = (file: File) => {
    const { data: cache } = useTileImageCache();
    const [tileImage, setTileImage] = useState<TileImageBlob | null>(null);

    console.log(cache)

    useEffect(() => {
        if (!file.tileImageUrl || !cache) {
            return;
        }

        const cachedTileImage = cache[file.fileId];
        if (cachedTileImage) {
            setTileImage(cachedTileImage);
        } else {
            fetchAndCacheTileImage(file);
        }
    }, [cache, file.fileId, file.tileImageUrl]);

    return tileImage;
};

const fetchAndCacheTileImage = async (file: File) => {
    console.time('fetch' + file.fileId)
    const res = await fetch(file.tileImageUrl ?? '', {
        mode: 'cors'
    });

    const blob = await res.blob();

    // Split blob into binary and MIME type. Blobs and object URLS cannot be cached.
    const tileImageData: TileImageBlob = {
        fileId: file.fileId,
        buffer: await blob.arrayBuffer(),
        contentType: blob.type
    };

    await idb.set(`file/${file.fileId}`, tileImageData);

    queryClient.invalidateQueries({ queryKey: ['tile-image-cache'] });
    console.timeEnd('fetch' + file.fileId);
}

export const useDeleteItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            await fetchAuthenticatedRoute('/items', {
                method: 'DELETE',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

export const useRestoreItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            await fetchAuthenticatedRoute('/items/restore', {
                method: 'POST',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

export const useFavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            await fetchAuthenticatedRoute(`/items/${itemId}/favorite`, {
                method: 'POST'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

export const useUnfavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            await fetchAuthenticatedRoute(`/items/${itemId}/unfavorite`, {
                method: 'POST'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

export const useReprocessItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            const promise = fetchAuthenticatedRoute(`/items/${itemId}/reprocess`, {
                method: 'POST'
            });

            await toast.promise(promise, {
                loading: 'Reprocessing',
                success: 'Complete',
                error: 'Failed to reprocess item'
            });
        },
        onSuccess: (_, itemId) => {
            queryClient.setQueryData(['gallery'], (gallery: GetGalleryResponse) => {
                return produce(gallery, draft => {
                    const item = draft.items.find(_ => _.itemId === itemId);

                    // Update item file urls to trigger <img> update
                    item!.files.forEach(file => {
                        file.previewUrl = file.previewUrl?.split('?')[0] + '?t=' + new Date().toISOString();
                        file.tileImageUrl = file.tileImageUrl?.split('?')[0] + '?t=' + new Date().toISOString();
                    });
                });
            });
        }
    });
}

export const useAlbums = () => useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute('/albums');

        const body = await res.json();
        const response = body as GetAlbumsResponse;

        return response.albums;
    }
})

export const useAlbumsWithItems = (): AlbumWithItems[] | undefined => {
    const { data: gallery } = useGallery();
    const { data: albums } = useAlbums();

    const albumsWithItems = useMemo(() => {
        if (!gallery || !albums) {
            return;
        }

        // Link items to albums
        const itemsById: Record<string, Item> = {};
        for (const item of gallery.items) {
            itemsById[item.itemId] = item;
        }

        return albums.map(album => ({
            ...album,
            items: album.itemIds
                .map(itemId => itemsById[itemId])
                .filter(item => !!item)
                .filter(item => !item.deletedTimeUtc)
        }));
    }, [gallery, albums]);

    return albumsWithItems;
}

interface CreateAlbumArgs {
    name: string;
    itemIds: number[];
}
export const useCreateAlbum = () => {
    return useMutation({
        mutationFn: async ({ name, itemIds }: CreateAlbumArgs): Promise<number | null> => {
            const res = await fetchAuthenticatedRoute('/album', {
                method: 'POST',
                body: JSON.stringify({ name, itemIds }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                const body = await res.json();
                return body.albumId;
            } else {
                return null;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

interface AlbumItemIds {
    albumId: number;
    itemIds: number[];
}
export const useAddItemsToAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, itemIds }: AlbumItemIds): Promise<boolean> => {
            const res = await fetchAuthenticatedRoute(`/album/${albumId}/items`, {
                method: 'PUT',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return res.ok;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

export const useRemoveItemsFromAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, itemIds }: AlbumItemIds): Promise<boolean> => {
            const res = await fetchAuthenticatedRoute(`/album/${albumId}/items`, {
                method: 'DELETE',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return res.ok;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

export const useDeleteAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number): Promise<boolean> => {
            const res = await fetchAuthenticatedRoute(`/album/${albumId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return res.ok;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

interface UpdateAlbumArgs {
    albumId: number;
    name: string | null;
}
export const useUpdateAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, name }: UpdateAlbumArgs): Promise<boolean> => {
            const res = await fetchAuthenticatedRoute(`/album/${albumId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return res.ok;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

export const useShareAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number): Promise<string> => {
            const res = await fetchAuthenticatedRoute(`/album/share/${albumId}`, {
                method: 'POST'
            });

            const shareSecret = await res.json();

            return shareSecret as string;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

const isFileAlreadyImported = async (hash: string) => {
    const res = await fetchAuthenticatedRoute(`/import/files/${hash}`);

    const body = await res.json();
    return body.exists;
}

// TODO: Lock down upload endpoint
export const uploadFiles = async (files: FileList) => {
    const tenantId = localStorage.getItem('tenantId') ?? '';

    let checkNumber = 1;
    let loadingToastId: string | undefined = undefined;
    let failureCount = 0;

    loadingToastId = toast.loading(`Checking ${files.length} files`, {
        id: loadingToastId
    });

    const fileCheckPromises = [...files].map(async file => {
        // Check the file hash before uploading, if the crypto API is available.
        if (crypto.subtle) {
            const fileBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const fileAlreadyImported = await isFileAlreadyImported(hashHex);

            loadingToastId = toast.loading(`Checked ${checkNumber++}/${files.length} files`, {
                id: loadingToastId
            });


            if (fileAlreadyImported) {
                return null;
            }

            return file;
        }
    });

    const checkFileResults = await Promise.all(fileCheckPromises);
    const newFiles = checkFileResults.filter(f => f !== null) as globalThis.File[];

    let uploadNumber = 1;
    for (const file of newFiles) {
        loadingToastId = toast.loading(`Uploading ${uploadNumber++}/${newFiles.length} new files`, {
            id: loadingToastId
        });

        const formData = new FormData();
        formData.append('file', file);

        // iOS uses the same filename for multiple images when selecting from camera roll.
        // Adding a timestamp ensures unique filenames and prevents conflicts with existing files.
        const timestamp = new Date().getTime();
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        const fileNameWithTimestamp = `${file.name.replace(/\.[^/.]+$/, '')}_${timestamp}${fileExtension}`;

        const res = await fetchAuthenticatedRoute(`/import/s3/${tenantId}/${fileNameWithTimestamp}`, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type
            },
            body: formData.get('file')
        });

        if (!res.ok) {
            toast.error(`Failed to upload ${file.name}`);
            failureCount++;
        }
    }

    if (loadingToastId) {
        toast.dismiss(loadingToastId);
    }

    if (failureCount === 0) {
        toast.success(`${files.length} files uploaded`);
    } else {
        toast.error(`${failureCount}/${files.length} files failed to upload`, {
            duration: Infinity
        });
    }

    queryClient.invalidateQueries({ queryKey: ['gallery'] });
}
