import constants from "../constants";
import { endSessionAndGoToLogin, getSession } from "../common/session";
import toast from "react-hot-toast";

export const fetchAuthenticatedRoute = async (path: string, request?: RequestInit) => {
    request = request ?? {};

    const session = getSession();

    request.headers = {
        ...request.headers,
        'Authorization': 'Session ' + (session?.sessionId ?? ''),
        'x-tenant-id': session?.tenantId ?? ''
    };

    const res = await fetch(constants.apiUrl + path, request);

    if (res.status === 401) {
        toast.error('You are not logged in.');

        endSessionAndGoToLogin();

        throw new Error('Session Invalid');
    }

    // Throwing keeps callers on a single path: a returned response is always a successful
    // one, so the body can be read without checking the status first.
    if (!res.ok) {
        toast.error(res.status < 500 ? await readErrorMessage(res) : 'Something went wrong. Please try again.');

        throw new Error(`Request failed (${res.status}): ${path}`);
    }

    return res;
}

// User errors come back as a JSON string, but framework errors can be any shape,
// so fall back to the raw body.
const readErrorMessage = async (res: Response) => {
    const body = await res.text();

    try {
        const parsed = JSON.parse(body);
        return typeof parsed === 'string' ? parsed : body;
    } catch {
        return body;
    }
}
