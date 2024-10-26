import { useQuery } from "@tanstack/react-query";

const properties = {
    apiUrl: 'http://192.168.1.44:5023'
};

const authHeaders = {};

const authenticateSession = async () => {
    if (authHeaders['Authorization']) {
        return;
    }

    const params = new URLSearchParams({
        tenantName: 'wilson2',
        email: 'nwilson2',
        password: 'password'
    });

    const res = await fetch(properties.apiUrl + '/session/login?' + params, {
        method: 'POST'
    });
    const body = await res.json();

    authHeaders['Authorization'] = 'Session ' + body.sessionId;
    authHeaders['x-tenant-id'] = body.tenantId;
}

export const useGallery = () => useQuery({
    queryKey: ['gallery'],
    queryFn: async () => {
        await authenticateSession();

        const res = await fetch(properties.apiUrl + '/items/gallery', {
            headers: authHeaders
        });

        const body = await res.json();
        return body.result;
    }
});
