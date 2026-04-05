import { getDefaultToMemories } from '../hooks/use.default.to.memories';

const SETUP_WIZARD_VERSION = 'v1';
const SETUP_WIZARD_KEY_PREFIX = 'setupWizardCompleted';

const getSetupWizardKey = (tenantId: string) => `${SETUP_WIZARD_KEY_PREFIX}:${tenantId}`;

export const isSetupWizardRequired = (tenantId: string | null) => {
    if (!tenantId) {
        return false;
    }

    return localStorage.getItem(getSetupWizardKey(tenantId)) !== SETUP_WIZARD_VERSION;
};

export const markSetupWizardCompleted = (tenantId: string | null) => {
    if (!tenantId) {
        return;
    }

    localStorage.setItem(getSetupWizardKey(tenantId), SETUP_WIZARD_VERSION);
};

export const getPostSetupRoute = () => {
    return getDefaultToMemories() ? '/memories' : '/gallery';
};
