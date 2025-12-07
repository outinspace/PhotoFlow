import { useEffect, useRef, useState } from 'react';
import { Item } from '../types';
import { nonSelectable } from '../styles';
import { useLongPress } from 'use-long-press';
import { useAutoplayLivePhotos } from '../hooks/use.autoplay.live.photos';
import { useAutoplayVideos } from '../hooks/use.autoplay.videos';

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
    const [showLivePhoto, setShowLivePhoto] = useState(false);
    const { enabled: autoplayLivePhotos } = useAutoplayLivePhotos();
    const { enabled: autoplayVideos } = useAutoplayVideos();

    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    useEffect(() => {
        if (isPrimary && autoplayVideos) {
            videoRef.current?.play();
        } else {
            videoRef.current?.pause();
        }
    }, [isPrimary, autoplayVideos, videoRef]);

    const longPressHandlers = useLongPress(() => {
        setShowLivePhoto(true);
    });

    return (
        <div
            className={`fixed top-0 bottom-0 left-0 right-0 ${isLivePhoto && showLivePhoto && 'animate-[pulse_0.5s_ease-in-out_1]'}`}
            {...longPressHandlers()}
        >
            {imageFile && <>
                <img
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.tileImage
                    }}
                    src={imageFile?.tileImageUrl ?? undefined}
                />
                <img
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewImage,
                    }}
                    src={imageFile.previewUrl ?? undefined}
                />
            </>}
            {isLivePhoto && showLivePhoto && isPrimary && !autoplayLivePhotos && (
                <video
                    autoPlay
                    controls={false}
                    playsInline
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo
                    }}
                    onEnded={() => setShowLivePhoto(false)}
                >
                    <source src={videoFile.previewUrl ?? undefined} />
                </video>
            )}
            {videoFile && (!isLivePhoto || autoplayLivePhotos) && (
                <video
                    ref={videoRef}
                    controls
                    playsInline
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo
                    }}
                    onEnded={() => setShowLivePhoto(false)}
                >
                    <source src={videoFile.previewUrl ?? undefined} />
                </video>
            )}
        </div>
    );
}

export default ItemMedia;
