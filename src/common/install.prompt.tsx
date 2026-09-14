import { useSyncExternalStore } from 'react';
import { Download, ShareIos, Xmark } from 'iconoir-react';
import { IS_STANDALONE } from './browser.utils';
import { useInstallPromptDismissed } from '../hooks/use.settings';

// Installed, the app opens full screen and keeps its offline cache, which is most of
// what makes it feel like a photo app rather than a web page.
//
// Chrome fires beforeinstallprompt once, usually before React has mounted, so it is
// caught here at module load and held until something asks for it. iOS has no such
// event and no way to install from script — Safari does it from its own Share menu —
// so there the banner can only say where that menu is.

interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    changed();
});

window.addEventListener('appinstalled', () => {
    deferred = null;
    changed();
});

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

// Chrome allows one prompt per event, so it is spent either way once shown.
const install = async (event: InstallPromptEvent) => {
    await event.prompt();
    deferred = null;
    changed();
};

// An iPad reports itself as a Mac, and only the touch count gives it away.
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const InstallPrompt = () => {
    const installable = useSyncExternalStore(subscribe, () => deferred);
    const [dismissed, setDismissed] = useInstallPromptDismissed();

    if (IS_STANDALONE || dismissed || (!installable && !IS_IOS)) {
        return null;
    }

    return (
        <div className='md:hidden flex-none flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900'>
            {installable ? (
                <button
                    type='button'
                    onClick={() => install(installable)}
                    className='flex flex-auto items-center gap-2 py-1 text-left font-medium'
                >
                    <Download className='size-5 shrink-0' />
                    Add PhotoFlow to your home screen
                </button>
            ) : (
                <span className='flex flex-auto items-center gap-2 py-1'>
                    <ShareIos className='size-5 shrink-0' />
                    Tap Share, then Add to Home Screen
                </span>
            )}
            <button
                type='button'
                onClick={() => setDismissed(true)}
                aria-label='Dismiss'
                className='shrink-0 p-1 text-sky-700'
            >
                <Xmark className='size-4' />
            </button>
        </div>
    );
};
