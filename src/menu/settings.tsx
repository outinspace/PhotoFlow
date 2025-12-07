import { TopBar } from '../common/top.bar';
import { usePhotoAnimations } from '../hooks/use.photo.animations';
import { useAutoplayLivePhotos } from '../hooks/use.autoplay.live.photos';

const Settings = () => {
    const { enabled: photoAnimationsEnabled, setEnabled: setPhotoAnimationsEnabled } = usePhotoAnimations();
    const { enabled: autoplayLivePhotosEnabled, setEnabled: setAutoplayLivePhotosEnabled } = useAutoplayLivePhotos();

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Settings' />
            <div className='p-5 overflow-auto'>
                <div className='bg-slate-100 rounded-lg p-4 border border-slate-200'>
                    <div className='flex items-center justify-between mb-2'>
                        <div>
                            <div className='font-medium text-slate-900'>Photo Animations</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                Enable animations when navigating between photos using arrow keys or buttons
                            </div>
                        </div>
                        <button
                            onClick={() => setPhotoAnimationsEnabled(!photoAnimationsEnabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                photoAnimationsEnabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            role="switch"
                            aria-checked={photoAnimationsEnabled}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    photoAnimationsEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
                <div className='bg-slate-100 rounded-lg p-4 border border-slate-200 mt-4'>
                    <div className='flex items-center justify-between mb-2'>
                        <div>
                            <div className='font-medium text-slate-900'>Autoplay Live Photos</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                Automatically play live photo videos when viewing photos in preview
                            </div>
                        </div>
                        <button
                            onClick={() => setAutoplayLivePhotosEnabled(!autoplayLivePhotosEnabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                autoplayLivePhotosEnabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            role="switch"
                            aria-checked={autoplayLivePhotosEnabled}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    autoplayLivePhotosEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
