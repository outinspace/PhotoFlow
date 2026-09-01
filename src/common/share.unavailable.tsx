// Shared links are opened by people who have no idea how the app works, so a
// missing one has to say something. Rendering nothing — which is what a failed
// lookup used to do — is indistinguishable from a broken page.
export const ShareUnavailable = ({ kind }: { kind: 'photo' | 'album' }) => (
    <div className='flex flex-auto items-center justify-center p-8'>
        <div className='max-w-sm text-center'>
            <h1 className='text-lg font-semibold text-slate-900'>This {kind} isn’t available</h1>
            <p className='mt-2 text-sm text-slate-600'>
                The link may have expired, or the {kind} may no longer be shared.
                Ask whoever sent it for a new link.
            </p>
        </div>
    </div>
);
