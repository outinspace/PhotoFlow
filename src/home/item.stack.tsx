import { useState, useEffect, useMemo } from 'react';
import { Item } from '../types';

interface Props {
    items: Item[];
    onClick?: () => void;
    width?: string | number;
    fullWidth?: boolean;
    staticMode?: boolean;
}

export const ItemStack = ({ items, onClick, width = '300px', fullWidth = false, staticMode = false }: Props) => {
    // In static mode, pick a random index once
    const randomIndex = useMemo(() => {
        if (staticMode && items.length > 0) {
            return Math.floor(Math.random() * items.length);
        }
        return 0;
    }, [staticMode, items.length]);

    const [currentImageIndex, setCurrentImageIndex] = useState(staticMode ? randomIndex : 0);

    // Update random index when items change in static mode
    useEffect(() => {
        if (staticMode && items.length > 0) {
            const newRandomIndex = Math.floor(Math.random() * items.length);
            setCurrentImageIndex(newRandomIndex);
        }
    }, [staticMode, items.length]);

    // Auto-rotate images every second (only if not in static mode)
    useEffect(() => {
        if (staticMode || items.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                (prevIndex + 1) % items.length
            );
        }, 2000);

        return () => clearInterval(interval);
    }, [staticMode, items.length]);

    if (items.length === 0) {
        return null;
    }

    // Only render the current image and the next one for smooth transitions (unless in static mode)
    const nextImageIndex = (currentImageIndex + 1) % items.length;
    const imagesToRender = staticMode || items.length === 1
        ? [currentImageIndex]
        : [currentImageIndex, nextImageIndex];

    return (
        <div 
            className={`relative cursor-pointer ${fullWidth ? '' : 'flex-shrink-0'}`}
            onClick={onClick}
        >
            <div className="relative w-full max-w-200 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', width: fullWidth ? '100%' : width }}>
                {imagesToRender.map((index) => {
                    const item = items[index];
                    const isActive = index === currentImageIndex;
                    return (
                        <img
                            key={item.itemId}
                            src={item.primaryFile.previewUrl ?? item.primaryFile.tileImageUrl ?? undefined}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{
                                opacity: isActive ? 1 : 0,
                                transition: staticMode ? 'none' : 'opacity 0.5s ease-in-out',
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

