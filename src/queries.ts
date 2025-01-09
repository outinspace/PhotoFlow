import { useMutation, useQuery } from "@tanstack/react-query";
import { File, GetAlbumsResponse, GetGalleryResponse, Item } from "./types";
import constants from "./constants";
import { router } from "./routes";
import { queryClient } from "./app";
import { useMemo } from "react";


export const fetchAuthenticatedRoute = async (path: string, request?: RequestInit) => {
    request = request ?? {};

    request.headers = {
        ...request.headers,
        'Authorization': 'Session ' + localStorage.getItem('sessionId') ?? '',
        'x-tenant-id': localStorage.getItem('tenantId') ?? ''
    };

    const res = await fetch(constants.apiUrl + path, request);

    if (res.status === 401) {
        localStorage.removeItem('tenantId');
        localStorage.removeItem('sessionId');

        router.navigate({ to: '/login' });

        throw new Error('Session Invalid');
    }

    return res;
}

export const useGallery = () => useQuery({
    queryKey: ['gallery'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute('/items/gallery');

        const body = await res.json();
        const gallery = body as GetGalleryResponse;

        // Computed properties
        for (const item of gallery.items) {
            for (const file of item.files) {
                file.originalUrl = gallery.originalUrlPrefix + file.fileId;

                file.tileImageUrl = file.tileVersion ? `${gallery.tileImageUrlPrefix}${file.fileId}.jpeg?v=${file.tileVersion}` : null;

                const previewExtension = file.contentType.startsWith('image') ? '.jpeg' : '.mp4';
                file.previewUrl = file.previewVersion ? `${gallery.previewUrlPrefix}${file.fileId}${previewExtension}?v=${file.previewVersion}` : null;
            }

            item.primaryFile = item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0];

            item.totalBytes = item.files.reduce((sum, file) => sum + file.sizeBytes, 0);

            item.device = item.cameraMake !== null && item.cameraModel !== null ? `${item.cameraMake} ${item.cameraModel}` : null;

            item.type = getType(item);
        }

        // Separate deleted items
        const deletedItems = gallery.items.filter(item => item.deletedTimeUtc !== null);
        gallery.deletedItems = deletedItems;

        gallery.items = gallery.items.filter(item => item.deletedTimeUtc === null);

        return gallery;
    }
});

const getType = (item: Item) => {
    if (item.files.length === 1 && item.files[0].contentType.startsWith('image')) {
        return 'photo';
    } else if (item.files.length === 1 && item.files[0].contentType.startsWith('video')) {
        return 'video';
    } else {
        return 'live-photo';
    }
}

export const useTileImageBuffer = (file: File) => useQuery({
    queryKey: ['tile-image', file.fileId, file.tileVersion],
    staleTime: Infinity, // Will use cache max age
    queryFn: async () => {
        if (!file.tileImageUrl) {
            return;
        }

        const res = await fetch(file.tileImageUrl, {
            mode: 'cors'
        });

        const blob = await res.blob();

        // Split blob into binary and MIME type. Blobs and object URLS cannot be cached.
        return {
            buffer: await blob.arrayBuffer(),
            contentType: blob.type
        };
    }
})

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

export const useAlbums = () => useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute('/albums');

        const body = await res.json();
        const response = body as GetAlbumsResponse;

        return response.albums;
    }
})

export const useAlbumsWithItems = () => {
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

        for (const album of albums) {
            album.items = album.itemIds
                .map(itemId => itemsById[itemId])
                .filter(item => !!item)
                .filter(item => !item.deletedTimeUtc);
        }

        return albums;
    }, [gallery, albums]);

    return albumsWithItems
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
