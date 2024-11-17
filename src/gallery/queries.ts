import { useQuery } from "@tanstack/react-query";
import { GetGalleryResponse } from "./types";
import constants from "../constants";

const getAuthHeaders = () => {
    return {
        'Authorization': 'Session ' + localStorage.getItem('sessionId') ?? '',
        'x-tenant-id': localStorage.getItem('tenantId') ?? ''
    };
}

export const useGallery = () => useQuery({
    queryKey: ['gallery'],
    queryFn: async () => {
        const res = await fetch(constants.apiUrl + '/items/gallery', {
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('sessionId');
            // TODO: Route to login
        }

        const body = await res.json();
        return body.result as GetGalleryResponse;
    }
});
