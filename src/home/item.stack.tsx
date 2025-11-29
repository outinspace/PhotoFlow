import { useState, useEffect, useMemo } from 'react';
import { Item } from '../types';

interface Props {
    items: Item[];
    onClick?: (currentIndex: number) => void;
    width?: string | number;
    fullWidth?: boolean;
    animate?: boolean;
}

export const ItemStack = ({ items, onClick, width = '300px', fullWidth = false, animate = false }: Props) => {
    const randomItemIndex = useMemo(() => {
        if (items.length === 0) {
            return 0;
        }

        const favoritedItems = items.filter(item => item.isFavorite);

        if (favoritedItems.length > 0) {
            const randomFavorite = favoritedItems[Math.floor(Math.random() * favoritedItems.length)];
            return items.findIndex(item => item.itemId === randomFavorite.itemId);
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
                const randomFavorite = favoritedItems[Math.floor(Math.random() * favoritedItems.length)];
                newRandomIndex = items.findIndex(item => item.itemId === randomFavorite.itemId);
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
            className={`relative hover:opacity-90 ${fullWidth ? '' : 'flex-shrink-0'}`}
            onClick={() => onClick?.(currentImageIndex)}
        >
            <div className="relative w-full max-w-200 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/9', width: fullWidth ? '100%' : width }}>
                {indicesToRender.map((index) => {
                    const item = items[index];
                    const isActive = index === currentImageIndex;
                    const isVideo = item.type === 'video';
                    return (
                        <img
                            key={item.itemId}
                            src={(isVideo ? item.primaryFile.tileImageUrl : item.primaryFile.previewUrl) ?? undefined}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{
                                opacity: isActive ? 1 : 0,
                                transition: !animate ? 'none' : 'opacity 0.5s ease-in-out',
                            }}
                        />
                    );
                })}
                <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {items.length} {items.length === 1 ? 'photo' : 'photos'}
                </div>
            </div>
        </div>
    );
};

