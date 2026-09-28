import { ReactNode, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Airplane, ArrowRight, Camera, Flash, HeartSolid, Link as LinkIcon, Lock, Map, Search, SmartphoneDevice, WifiOff } from 'iconoir-react';
import { TopBar } from '../common/top.bar';
import { options } from '../navigation.layout';

// What someone who has not connected a bucket sees at /. The installed app skips it
// and goes straight to the connect screen, since it only opens there to be set up.

const GITHUB = 'https://github.com/outinspace/photoflow';
// index.html carries the description, where search engines and link previews read it.
const TITLE = 'PhotoFlow: a photo library in your own bucket';

const FEATURES: [typeof Search, string, string, string][] = [
    [Search, 'Search what is in them', 'Type "red bicycle in the snow". The AI runs in your browser, so no query leaves the device.', 'bg-sky-100 text-sky-700'],
    [Airplane, 'Trips, found for you', 'Trips are detected from dates and places, with year views and "one year ago".', 'bg-amber-100 text-amber-700'],
    [Map, 'A map of it all', 'Everywhere you have taken a photo, clustered by place.', 'bg-emerald-100 text-emerald-700'],
    [Camera, 'Live Photos', 'Both halves stay together as one photo, with camera, time and place alongside.', 'bg-rose-100 text-rose-700'],
    [LinkIcon, 'Albums and share links', 'Group photos into albums and send a link that expires.', 'bg-violet-100 text-violet-700'],
    [WifiOff, 'Works offline', 'Add it to your home screen and the gallery keeps working with no connection.', 'bg-slate-200 text-slate-700'],
    [Flash, 'Fast scrolling', 'Placeholders draw instantly and thumbnails catch up, so the gallery never waits on the network.', 'bg-yellow-100 text-yellow-700'],
    [SmartphoneDevice, 'Phone and desktop', 'Mobile first, and a full desktop app too. Link a second device with a QR code.', 'bg-cyan-100 text-cyan-700'],
];

// Flat scenes in the app icon's colours stand in for photos in the hero, drawn in a 100x100 box.
const SCENES: Record<string, ReactNode> = {
    peak: <>
        <rect width='100' height='100' fill='#bae6fd' />
        <circle cx='72' cy='26' r='10' fill='#fbbf24' />
        <polygon points='30,100 62,48 100,88 100,100' fill='#cbd5e1' />
        <polygon points='0,100 38,40 80,100' fill='#94a3b8' />
        <polygon points='38,40 30,52 36,50 40,55 45,49 48,54' fill='#fff' />
    </>,
    beach: <>
        <rect width='100' height='100' fill='#fdba74' />
        <circle cx='50' cy='48' r='17' fill='#fb7185' />
        <rect y='66' width='100' height='34' fill='#38bdf8' />
        <path d='M20 28q4-4 8 0q4-4 8 0' stroke='#7c2d12' strokeWidth='1.6' fill='none' strokeLinecap='round' />
    </>,
    clouds: <>
        <rect width='100' height='100' fill='#e0f2fe' />
        <circle cx='70' cy='32' r='12' fill='#fbbf24' />
        <ellipse cx='32' cy='42' rx='16' ry='8' fill='#fff' />
        <ellipse cx='42' cy='36' rx='11' ry='9' fill='#fff' />
        <ellipse cx='24' cy='38' rx='9' ry='7' fill='#fff' />
        <rect y='80' width='100' height='20' fill='#86efac' />
    </>,
    dusk: <>
        <rect width='100' height='100' fill='#fed7aa' />
        <rect y='35' width='100' height='65' fill='#fdba74' />
        <circle cx='50' cy='62' r='14' fill='#fb7185' />
        <path d='M0 70Q25 55 50 68T100 64V100H0Z' fill='#475569' />
    </>,
    lake: <>
        <rect width='100' height='100' fill='#bae6fd' />
        <path d='M0 55Q30 35 60 52T100 45V60H0Z' fill='#4ade80' />
        <rect y='58' width='100' height='42' fill='#0ea5e9' />
        <rect x='20' y='70' width='25' height='1.5' fill='#fff' opacity='0.5' />
        <rect x='55' y='80' width='30' height='1.5' fill='#fff' opacity='0.5' />
    </>,
    night: <>
        <rect width='100' height='100' fill='#1e3a8a' />
        <circle cx='68' cy='30' r='10' fill='#fef3c7' />
        <circle cx='20' cy='20' r='1' fill='#fff' />
        <circle cx='38' cy='34' r='1' fill='#fff' />
        <circle cx='84' cy='56' r='1' fill='#fff' />
        <path d='M0 80Q40 60 100 78V100H0Z' fill='#172554' />
    </>,
    field: <>
        <rect width='100' height='100' fill='#bae6fd' />
        <circle cx='25' cy='25' r='9' fill='#fbbf24' />
        <rect y='62' width='100' height='38' fill='#fde047' />
        <rect x='70' y='48' width='4' height='16' fill='#92400e' />
        <circle cx='72' cy='44' r='12' fill='#16a34a' />
    </>,
    town: <>
        <rect width='100' height='100' fill='#e0f2fe' />
        <rect x='8' y='50' width='18' height='50' fill='#94a3b8' />
        <rect x='28' y='36' width='16' height='64' fill='#64748b' />
        <rect x='46' y='56' width='20' height='44' fill='#cbd5e1' />
        <rect x='68' y='42' width='14' height='58' fill='#94a3b8' />
        <rect x='84' y='60' width='16' height='40' fill='#64748b' />
    </>,
};

// [scene, mirrored, video length, favourite]
const SHOT: [string, boolean?, string?, boolean?][] = [
    ['peak'], ['lake', true], ['peak', true, undefined, true], ['clouds'],
    ['lake'], ['field', false, '00:12'], ['beach'], ['dusk', true],
    ['town'], ['peak'], ['clouds', true], ['lake', true],
    ['beach', true], ['beach', false, undefined, true], ['dusk', false, '00:04'], ['night'],
    ['field', true], ['town', true], ['lake'], ['peak', true],
    ['clouds'], ['dusk'], ['night', true], ['beach'],
];

const buttonClass = 'inline-flex items-center gap-1.5 rounded-xl border font-semibold';
const primary = `${buttonClass} h-11 px-4.5 border-sky-500 bg-sky-500 text-white hover:bg-sky-600`;
const secondary = `${buttonClass} h-11 px-4.5 border-slate-200 bg-white text-slate-900 hover:bg-slate-100`;

const InstallButton = () => (
    <a href={`${GITHUB}#setup`} className={primary}>
        Install from GitHub
        <ArrowRight className='size-4' />
    </a>
);

export const HomePage = () => {
    useEffect(() => {
        document.title = TITLE;
        return () => { document.title = 'PhotoFlow'; };
    }, []);

    return (
        <div className='w-full flex-auto select-text px-4 pt-[env(safe-area-inset-top)] text-slate-900 *:mx-auto *:max-w-5xl'>
            <header className='flex items-center justify-between gap-3 py-3.5'>
                <span className='flex items-center gap-2 text-lg font-bold italic'>
                    <img src='/icon-192.png' alt='' className='size-9 rounded-[0.55rem]' />
                    PhotoFlow
                </span>
                <Link to='/connect' className={`${buttonClass} h-9 px-3.5 text-sm border-slate-200 bg-white hover:bg-slate-100`}>
                    Connect a bucket
                    <ArrowRight className='size-4' />
                </Link>
            </header>

            <section className='grid items-center gap-10 pt-6 pb-12 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:pt-14 md:pb-18'>
                <div>
                    <h1 className='mb-4 text-4xl font-bold tracking-tight text-balance md:text-5xl md:leading-[1.05]'>
                        Your photo library, in a bucket you own.
                    </h1>
                    <p className='mb-6 max-w-md text-[1.0625rem] leading-relaxed text-slate-600'>
                        A fast photo app for phone and desktop with no server in the middle. Your photos stay as
                        ordinary files in your own S3 bucket, and the bill is your storage and nothing else.
                    </p>
                    <div className='flex flex-wrap gap-2'>
                        <InstallButton />
                        <a href='#features' className={secondary}>See what it does</a>
                    </div>
                    <div className='mt-3 text-xs font-semibold text-slate-500'>
                        Free and open source. Needs an S3 bucket and a computer that is usually on.
                    </div>
                </div>
                <PhoneShot />
            </section>

            <section id='features' className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {FEATURES.map(([Icon, title, text, tint]) => (
                    <div key={title} className='grid grid-cols-[auto_1fr] gap-x-3.5 rounded-2xl border border-slate-200 bg-white p-4 sm:block sm:p-4.5'>
                        <span className={`row-span-2 grid size-9 place-items-center rounded-[0.625rem] ${tint}`}>
                            <Icon className='size-4.5' />
                        </span>
                        <h3 className='mb-1 font-semibold sm:mt-3.5'>{title}</h3>
                        <p className='text-[0.8125rem] leading-normal text-slate-500'>{text}</p>
                    </div>
                ))}
            </section>

            <section className='mt-3 flex gap-2.5 rounded-2xl bg-sky-100 px-4.5 py-4'>
                <Lock className='mt-0.5 size-4 flex-none text-sky-700' />
                <p className='text-[0.8125rem] leading-normal text-slate-700'>
                    <b className='text-slate-900'>Where your photos live.</b> In your own bucket, as ordinary files, under
                    your own key. A small program on your computer runs once a day to build the catalog, and the app
                    reads it straight from the bucket. Nothing in PhotoFlow ever modifies or deletes an original.
                </p>
            </section>

            <footer className='flex flex-col items-center gap-3 pt-14 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center'>
                <InstallButton />
                <small className='text-xs text-slate-500'>
                    AGPL-3.0. PhotoFlow is young; expect rough edges and open an issue when something breaks.
                </small>
            </footer>
        </div>
    );
};

// A trip in the gallery, built from the app's own top bar and navigation so it keeps looking like the app.
const PhoneShot = () => (
    <div aria-hidden className='pointer-events-none mx-auto w-80 max-w-full select-none rounded-[2.25rem] border border-slate-200 bg-white p-2 shadow-[0_30px_60px_-30px_rgb(15_60_100/0.35)]'>
        <div className='overflow-hidden rounded-[1.75rem] bg-slate-50'>
            <TopBar title='Cornwall' />
            <div className='relative grid grid-cols-4'>
                {SHOT.map(([scene, flip, video, favorite], i) => (
                    <div key={i} className='relative aspect-square overflow-hidden outline outline-1 outline-white'>
                        <svg viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice' className={`size-full ${flip ? '-scale-x-100' : ''}`}>
                            {SCENES[scene]}
                        </svg>
                        {favorite && <HeartSolid className='absolute bottom-1 left-1 size-3 text-slate-100 shadow' />}
                        {video && <div className='absolute right-1 bottom-1 text-[0.5rem] leading-none font-bold text-slate-100 shadow'>{video}</div>}
                    </div>
                ))}
                <div className='text-shadow absolute top-3 left-3 text-xl font-bold text-slate-50'>Jun 14 2026</div>
            </div>
            <div className='flex border-t border-slate-200 bg-slate-50 p-1.5'>
                {options.map(option => (
                    <div key={option.name} className={`flex flex-1 basis-0 flex-col items-center rounded-md py-2 text-[0.625rem] ${option.name === 'Memories' ? 'bg-slate-200 font-bold text-sky-500' : ''}`}>
                        <option.icon className='mb-1 h-4' />
                        {option.name}
                    </div>
                ))}
            </div>
        </div>
    </div>
);
