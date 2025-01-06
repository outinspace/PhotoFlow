import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetGalleryResponse, Item } from "./types";
import constants from "./constants";
import { router } from "./routes";


const fetchAuthenticatedRoute = async (path: string, request?: RequestInit) => {
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
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute('/items/gallery');

        const body = await res.json();
        const gallery = body.result as GetGalleryResponse;

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

export const useDeleteItems = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            await fetchAuthenticatedRoute('/items', {
                method: 'DELETE',
                body: JSON.stringify({
                    itemIds: itemIds
                }),
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
