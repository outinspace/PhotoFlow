import { queryClient } from '../app';
import { router } from '../routes';

const TENANT_ID_KEY = 'tenantId';
const SESSION_ID_KEY = 'sessionId';

export const getSession = () => {
    const tenantId = localStorage.getItem(TENANT_ID_KEY);
    const sessionId = localStorage.getItem(SESSION_ID_KEY);

    return tenantId && sessionId ? { tenantId, sessionId } : null;
};

export const getTenantId = () => localStorage.getItem(TENANT_ID_KEY);

export const startSession = (tenantId: string, sessionId: string) => {
    localStorage.setItem(TENANT_ID_KEY, tenantId);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
};

// Clearing the query cache matters as much as clearing the keys — it holds the gallery of
// whoever was signed in, and it is persisted to IndexedDB.
export const endSessionAndGoToLogin = () => {
    queryClient.clear();
    localStorage.removeItem(TENANT_ID_KEY);
    localStorage.removeItem(SESSION_ID_KEY);

    router.navigate({ to: '/login' });
};
