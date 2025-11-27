import constants from "../constants";
import { router } from "../routes";
import { queryClient } from "../app";
import toast from "react-hot-toast";

export const fetchAuthenticatedRoute = async (path: string, request?: RequestInit) => {
    request = request ?? {};

    request.headers = {
        ...request.headers,
        'Authorization': 'Session ' + (localStorage.getItem('sessionId') ?? ''),
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

