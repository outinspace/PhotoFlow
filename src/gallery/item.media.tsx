import { useEffect, useRef, useState } from 'react';
import { Item } from '../types';
import { useLongPress } from 'use-long-press';
import { useAutoplayLivePhotos, useAutoplayVideos } from '../hooks/use.settings';
import { useMediaUrl } from '../api/useMediaUrl';

const zIndex = {
    controls: 10,
    previewVideo: 3,
    previewImage: 2,
    tileImage: 1
};

interface Props {
    item: Item;
    isPrimary: boolean;
}

const ItemMedia = ({ item, isPrimary }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const livePhotoVideoRef = useRef<HTMLVideoElement>(null);
    const [showLivePhoto, setShowLivePhoto] = useState(false);
    const [showSmoothAnimation, setShowSmoothAnimation] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [autoplayLivePhotos] = useAutoplayLivePhotos();
    const [autoplayVideos] = useAutoplayVideos();

    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));

    // Signed here rather than in the markup: the bucket is private, so a URL only
    // exists once it has been signed, and that is asynchronous.
    //
    // Which is why the videos below take a src of their own rather than a <source>
    // child. A <video> whose only <source> has no src yet gives up on the spot and
    // then waits for a source element to be inserted; filling in the src of the one
    // already there does not wake it, so the video would never load at all. Setting
    // src on the element itself starts the load whenever it arrives.
    const tileUrl = useMediaUrl(imageFile?.tileImageSource);
    const previewUrl = useMediaUrl(imageFile?.previewSource);
    const videoPreviewUrl = useMediaUrl(videoFile?.previewSource);
    const isLivePhoto = !!imageFile && !!videoFile;

    useEffect(() => {
        if (isPrimary && autoplayVideos) {
            videoRef.current?.play();
        } else {
            videoRef.current?.pause();
        }
    }, [isPrimary, autoplayVideos, videoRef]);

    useEffect(() => {
        if (isPrimary && autoplayLivePhotos && isLivePhoto) {
            setShowSmoothAnimation(true);
        } else {
            setShowSmoothAnimation(false);
        }
    }, [isPrimary, autoplayLivePhotos, isLivePhoto]);

    useEffect(() => {
        if (!livePhotoVideoRef.current || !isLivePhoto) return;

        const video = livePhotoVideoRef.current;

        if (showLivePhoto && isPrimary) {
            video.currentTime = 0;
            video.play().catch(() => {
                setShowLivePhoto(false);
            });
        } else if (showSmoothAnimation) {
            setIsFadingOut(false);
            
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
            
            const handleCanPlay = () => {
                timeoutId = setTimeout(() => {
                    setIsFadingOut(true);
                    fadeTimeoutId = setTimeout(() => {
                        video.pause();
                        setShowSmoothAnimation(false);
                        setIsFadingOut(false);
                    }, 300);
                }, 300);
            };

            const handleLoadedMetadata = () => {
                const duration = video.duration;
                if (duration > 0) {
                    const halfwayPoint = duration / 2;
                    const startTime = Math.max(0, halfwayPoint - 0.3);
                    video.currentTime = startTime;
                    
                    const playPromise = video.play();
                    
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {
                            setShowSmoothAnimation(false);
                        });
                    }
                    
                    if (video.readyState >= 3) {
                        handleCanPlay();
                    } else {
                        video.addEventListener('canplay', handleCanPlay, { once: true });
                    }
                }
            };

            if (video.readyState >= 2) {
                handleLoadedMetadata();
            } else {
                video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
            }

            return () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                video.removeEventListener('canplay', handleCanPlay);
                video.pause();
            };
        } else {
            video.pause();
        }
    }, [showLivePhoto, showSmoothAnimation, isPrimary, isLivePhoto]);

    const longPressHandlers = useLongPress(() => {
        setShowLivePhoto(true);
    });

    return (
        // Absolute, not fixed. A fixed pane is only held inside the preview's carousel because
        // that carousel happens to be transformed, and react-spring drops the transform entirely
        // whenever it sits at rest — at which point the neighbouring photos escape to the
        // viewport and pile up on the one being looked at.
        <div
            className={`absolute top-0 bottom-0 left-0 right-0 ${isLivePhoto && showLivePhoto && 'animate-[pulse_0.5s_ease-in-out_1]'}`}
            {...longPressHandlers()}
        >
            {imageFile && <>
                <img
                    className='select-none pointer-events-none'
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.tileImage
                    }}
                    src={tileUrl ?? undefined}
                />
                <img
                    className='select-none pointer-events-none'
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewImage,
                    }}
                    src={previewUrl ?? undefined}
                />
            </>}
            {isLivePhoto && (
                <video
                    ref={livePhotoVideoRef}
                    playsInline
                    src={videoPreviewUrl ?? undefined}
                    preload={autoplayLivePhotos ? "auto" : "none"}
                    className={`select-none pointer-events-none transition-opacity duration-300 ${(showLivePhoto || (showSmoothAnimation && !isFadingOut)) ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo,
                        pointerEvents: (showLivePhoto || showSmoothAnimation) ? 'auto' : 'none'
                    }}
                    onEnded={() => {
                        if (showLivePhoto) {
                            setShowLivePhoto(false);
                        }
                    }}
                />
            )}
            {videoFile && !isLivePhoto && (
                <video
                    ref={videoRef}
                    playsInline
                    src={videoPreviewUrl ?? undefined}
                    controls
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo
                    }}
                />
            )}
        </div>
    );
}

export default ItemMedia;
