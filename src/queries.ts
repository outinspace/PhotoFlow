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

        gallery.items = gallery.items.map(item => ({
            ...item,
            // Computed properties
            primaryFile: item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0],
            totalBytes: item.files.reduce((sum, file) => sum + file.sizeBytes, 0),
            device: item.cameraMake !== null && item.cameraModel !== null ? `${item.cameraMake} ${item.cameraModel}` : null,
            type: getType(item)
        }));

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

export const useDeleteItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (itemId: number) => {
            await fetchAuthenticatedRoute('/items/' + itemId, {
                method: 'DELETE'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}
