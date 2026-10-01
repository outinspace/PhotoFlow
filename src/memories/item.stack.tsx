import { useState, useEffect, useMemo } from 'react';
import { Item } from '../types';
import { MediaImage } from '../common/media.image';

interface Props {
    items: Item[];
    onClick?: (currentIndex: number) => void;
    width?: string | number;
    fullWidth?: boolean;
    animate?: boolean;
    aspectRatio?: string;
    // Shown on a glass label over the bottom of the picture. Without a title the
    // card shows a photo count instead.
    title?: string;
    subtitle?: string;
    showCount?: boolean;
}

export const ItemStack = ({ items, onClick, width = '300px', fullWidth = false, animate = false, aspectRatio = '16/9', title, subtitle, showCount = true }: Props) => {
    const randomItemIndex = useMemo(() => {
        if (items.length === 0) {
            return 0;
        }

        const favoritedItems = items.filter(item => item.isFavorite);

        if (favoritedItems.length > 0) {
            const firstFavorite = favoritedItems[0];
            return items.findIndex(item => item.itemId === firstFavorite.itemId);
        }

        return Math.floor(Math.random() * items.length);
    }, [items]);

    const [currentImageIndex, setCurrentImageIndex] = useState(!animate ? randomItemIndex : 0);

    // Update random index when items change in static mode
    useEffect(() => {
        if (!animate && items.length > 0) {
            const favoritedItems = items.filter(item => item.isFavorite);

            let newRandomIndex: number;
            if (favoritedItems.length > 0) {
                const firstFavorite = favoritedItems[0];
                newRandomIndex = items.findIndex(item => item.itemId === firstFavorite.itemId);
            } else {
                newRandomIndex = Math.floor(Math.random() * items.length);
            }

            setCurrentImageIndex(newRandomIndex);
        }
    }, [animate, items]);

    // Auto-rotate images every second (only if animate is true)
    useEffect(() => {
        if (!animate || items.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                (prevIndex + 1) % items.length
            );
        }, 2000);

        return () => clearInterval(interval);
    }, [animate, items.length]);

    if (items.length === 0) {
        return null;
    }

    // Render three images: previous, current, and next (for smooth transitions)
    // Use stable React keys (itemId) so React reuses DOM elements
    const getIndex = (offset: number) => {
        if (items.length === 1) return 0;
        return (currentImageIndex + offset + items.length) % items.length;
    };

    const prevIndex = getIndex(-1);
    const nextIndex = getIndex(1);
    const indicesToRender = !animate || items.length === 1
        ? [currentImageIndex]
        : [prevIndex, currentImageIndex, nextIndex];

    return (
        <div 
            className={`relative cursor-pointer transition-transform active:scale-[0.98] ${fullWidth ? '' : 'flex-shrink-0'}`}
            onClick={() => onClick?.(currentImageIndex)}
        >
            <div className="relative w-full max-w-200 rounded-[28px] overflow-hidden bg-slate-300 shadow-sm" style={{ aspectRatio, width: fullWidth ? '100%' : width }}>
                {indicesToRender.map((index) => {
                    const item = items[index];
                    const isActive = index === currentImageIndex;
                    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));

                    return (
                        <div key={item.itemId} className="absolute inset-0 w-full h-full">
                            <MediaImage
                                source={item.primaryFile.tileImageSource}
                                alt=""
                                className="w-full h-full object-cover"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 1,
                                    opacity: isActive ? 1 : 0,
                                    transition: !animate ? 'none' : 'opacity 0.5s ease-in-out',
                                }}
                            />
                            <MediaImage
                                source={imageFile?.previewSource}
                                alt=""
                                className="w-full h-full object-cover"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 2,
                                    opacity: isActive ? 1 : 0,
                                    transition: !animate ? 'none' : 'opacity 0.5s ease-in-out',
                                }}
                            />
                        </div>
                    );
                })}
                {title ? (
                    <div
                        className="glass absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-2xl px-3.5 py-2"
                        style={{ zIndex: 3 }}
                    >
                        <div className="text-[15px] font-semibold leading-5 truncate">{title}</div>
                        {subtitle && <div className="text-xs font-medium leading-4 text-slate-600 truncate">{subtitle}</div>}
                    </div>
                ) : showCount && (
                    <div
                        className="glass absolute bottom-3 right-3 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ zIndex: 3 }}
                    >
                        {items.length} {items.length === 1 ? 'photo' : 'photos'}
                    </div>
                )}
            </div>
        </div>
    );
};

