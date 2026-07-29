import { TopBar } from '../common/top.bar';
import {
    useAutoplayLivePhotos,
    useAutoplayVideos,
    useDefaultToMemories,
    usePhotoAnimations,
    useSlideshowInterval,
    SLIDESHOW_INTERVAL_OPTIONS_SECONDS
} from '../hooks/use.settings';

const Settings = () => {
    const [photoAnimationsEnabled, setPhotoAnimationsEnabled] = usePhotoAnimations();
    const [autoplayLivePhotosEnabled, setAutoplayLivePhotosEnabled] = useAutoplayLivePhotos();
    const [autoplayVideosEnabled, setAutoplayVideosEnabled] = useAutoplayVideos();
    const [defaultToMemoriesEnabled, setDefaultToMemoriesEnabled] = useDefaultToMemories();
    const [slideshowSeconds, setSlideshowSeconds] = useSlideshowInterval();

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
                            <div className='font-medium text-slate-900'>Smooth Live Photo Animations</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                Play a brief animation when viewing live photos in preview
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
                <div className='bg-slate-100 rounded-lg p-4 border border-slate-200 mt-4'>
                    <div className='flex items-center justify-between mb-2'>
                        <div>
                            <div className='font-medium text-slate-900'>Autoplay Videos</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                Automatically play videos when viewing them in preview
                            </div>
                        </div>
                        <button
                            onClick={() => setAutoplayVideosEnabled(!autoplayVideosEnabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                autoplayVideosEnabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            role="switch"
                            aria-checked={autoplayVideosEnabled}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    autoplayVideosEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
                <div className='bg-slate-100 rounded-lg p-4 border border-slate-200 mt-4'>
                    <div className='flex items-center justify-between mb-2'>
                        <div>
                            <div className='font-medium text-slate-900'>Open to Memories</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                Open the Memories page by default when the app first loads
                            </div>
                        </div>
                        <button
                            onClick={() => setDefaultToMemoriesEnabled(!defaultToMemoriesEnabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                defaultToMemoriesEnabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            role="switch"
                            aria-checked={defaultToMemoriesEnabled}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    defaultToMemoriesEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
                <div className='bg-slate-100 rounded-lg p-4 border border-slate-200 mt-4'>
                    <div className='flex items-center justify-between mb-2'>
                        <div>
                            <div className='font-medium text-slate-900'>Slideshow Speed</div>
                            <div className='text-sm text-slate-600 mt-1'>
                                How long each photo is shown before advancing during a slideshow
                            </div>
                        </div>
                        <div className='ml-3 inline-flex flex-shrink-0 rounded-lg border border-slate-300 bg-white p-1'>
                            {SLIDESHOW_INTERVAL_OPTIONS_SECONDS.map(seconds => (
                                <button
                                    key={seconds}
                                    onClick={() => setSlideshowSeconds(seconds)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        slideshowSeconds === seconds ? 'bg-blue-600 text-white' : 'text-slate-700'
                                    }`}
                                    aria-pressed={slideshowSeconds === seconds}
                                >
                                    {seconds}s
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
