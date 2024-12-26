import { useQuery } from "@tanstack/react-query";
import { GetGalleryResponse } from "./types";
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
            // Select primary file for easy access later
            primaryFile: item.files.find(file => file.contentType.startsWith('image')) ?? item.files[0]
        }));

        return gallery;
    }
});
