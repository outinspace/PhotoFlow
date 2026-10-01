import { ReactNode } from 'react';
import { TopBar } from '../common/top.bar';
import {
    useAutoplayLivePhotos,
    useAutoplayVideos,
    useDefaultToMemories,
    usePhotoAnimations,
    usePrefetchThumbnails,
    useSlideshowInterval,
    SLIDESHOW_INTERVAL_OPTIONS_SECONDS
} from '../hooks/use.settings';
import { PREFETCH_AHEAD_ITEMS } from '../common/tile.loader';

const Row = ({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) => (
    <div className='flex items-center justify-between gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0'>
        <div className='min-w-0'>
            <div className='text-[16px] text-slate-900'>{title}</div>
            <div className='text-[13px] leading-snug text-slate-500 mt-0.5'>{description}</div>
        </div>
        {children}
    </div>
);

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7.5 w-12.5 flex-shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}
        role='switch'
        aria-checked={checked}
        aria-label={label}
    >
        <span
            className={`pointer-events-none inline-block size-6.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
    </button>
);

const Settings = () => {
    const [photoAnimationsEnabled, setPhotoAnimationsEnabled] = usePhotoAnimations();
    const [autoplayLivePhotosEnabled, setAutoplayLivePhotosEnabled] = useAutoplayLivePhotos();
    const [autoplayVideosEnabled, setAutoplayVideosEnabled] = useAutoplayVideos();
    const [defaultToMemoriesEnabled, setDefaultToMemoriesEnabled] = useDefaultToMemories();
    const [slideshowSeconds, setSlideshowSeconds] = useSlideshowInterval();
    const [prefetchEnabled, setPrefetchEnabled] = usePrefetchThumbnails();

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Display & Playback' />
            <div className='overflow-auto tabbar-pad'>
                <div className='w-full max-w-2xl mx-auto px-5 pt-2 space-y-7'>
                    <div className='rounded-2xl bg-white overflow-hidden'>
                        <Row title='Photo Animations' description='Slide between photos when using the arrow keys or buttons'>
                            <Toggle label='Photo Animations' checked={photoAnimationsEnabled} onChange={setPhotoAnimationsEnabled} />
                        </Row>
                        <Row title='Smooth Live Photo Animations' description='Play a brief animation when viewing Live Photos'>
                            <Toggle label='Smooth Live Photo Animations' checked={autoplayLivePhotosEnabled} onChange={setAutoplayLivePhotosEnabled} />
                        </Row>
                        <Row title='Autoplay Videos' description='Start videos as soon as you open them'>
                            <Toggle label='Autoplay Videos' checked={autoplayVideosEnabled} onChange={setAutoplayVideosEnabled} />
                        </Row>
                        <Row title='Open to Collections' description='Open Collections instead of the Library when the app starts'>
                            <Toggle label='Open to Collections' checked={defaultToMemoriesEnabled} onChange={setDefaultToMemoriesEnabled} />
                        </Row>
                    </div>
                    <div className='rounded-2xl bg-white overflow-hidden'>
                        <Row
                            title='Prefetch Thumbnails'
                            description={<>
                                Once the photos on screen have loaded, quietly download the next{' '}
                                {PREFETCH_AHEAD_ITEMS.toLocaleString()} so scrolling on is instant.
                                Turn this off to save data on a metered connection.
                            </>}
                        >
                            <Toggle label='Prefetch Thumbnails' checked={prefetchEnabled} onChange={setPrefetchEnabled} />
                        </Row>
                        <Row title='Slideshow Speed' description='How long each photo is shown'>
                            <div className='inline-flex flex-shrink-0 rounded-full bg-slate-100 p-1'>
                                {SLIDESHOW_INTERVAL_OPTIONS_SECONDS.map(seconds => (
                                    <button
                                        key={seconds}
                                        onClick={() => setSlideshowSeconds(seconds)}
                                        className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${slideshowSeconds === seconds ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                        aria-pressed={slideshowSeconds === seconds}
                                    >
                                        {seconds}s
                                    </button>
                                ))}
                            </div>
                        </Row>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
