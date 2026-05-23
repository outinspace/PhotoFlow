import { useMemo, useState, useCallback } from 'react';
import { useGallery } from '../api/useGallery';
import { subYears, subDays, addDays, subMonths, addMonths, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import ItemPreview from '../gallery/item.preview';
import { ItemStack } from './item.stack';

export const OneYearAgoToday = () => {
    const { data: gallery } = useGallery();
    const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);

    const matchingItems = useMemo(() => {
        if (!gallery?.items) return [];

        const today = new Date();
        const oneYearAgo = subYears(today, 1);
        const oneYearAgoStart = startOfDay(oneYearAgo);
        const oneYearAgoEnd = endOfDay(oneYearAgo);

        // First try: exact date (one year ago today)
        let items = gallery.items.filter(item => {
            const captureDate = parseISO(item.captureTime);
            return isWithinInterval(captureDate, { start: oneYearAgoStart, end: oneYearAgoEnd });
        });

        // Second try: ±7 days if no matches
        if (items.length === 0) {
            const sevenDaysBefore = startOfDay(subDays(oneYearAgo, 7));
            const sevenDaysAfter = endOfDay(addDays(oneYearAgo, 7));
            items = gallery.items.filter(item => {
                const captureDate = parseISO(item.captureTime);
                return isWithinInterval(captureDate, { start: sevenDaysBefore, end: sevenDaysAfter });
            });
        }

        // Third try: ±1 month if still no matches
        if (items.length === 0) {
            const oneMonthBefore = startOfDay(subMonths(oneYearAgo, 1));
            const oneMonthAfter = endOfDay(addMonths(oneYearAgo, 1));
            items = gallery.items.filter(item => {
                const captureDate = parseISO(item.captureTime);
                return isWithinInterval(captureDate, { start: oneMonthBefore, end: oneMonthAfter });
            });
        }

        // Randomize order
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [gallery?.items]);

    const handleClick = useCallback((currentIndex: number) => {
        if (matchingItems.length > 0) {
            setPreviewItemIndex(currentIndex);
        }
    }, [matchingItems.length]);

    const handleClosePreview = useCallback(() => {
        setPreviewItemIndex(null);
    }, []);

    const handleMoveNext = useCallback(() => {
        if (previewItemIndex === null) return;
        const newIndex = previewItemIndex >= matchingItems.length - 1 ? 0 : previewItemIndex + 1;
        setPreviewItemIndex(newIndex);
    }, [previewItemIndex, matchingItems.length]);

    const handleMovePrevious = useCallback(() => {
        if (previewItemIndex === null) return;
        const newIndex = previewItemIndex === 0 ? matchingItems.length - 1 : previewItemIndex - 1;
        setPreviewItemIndex(newIndex);
    }, [previewItemIndex, matchingItems.length]);

    if (matchingItems.length === 0) {
        return null;
    }

    return (
        <>
            <div className="p-2 mb-6">
                <h2 className="text-2xl font-bold mb-4 px-4">One Year Ago</h2>
                <div className="px-4">
                    <ItemStack
                        items={matchingItems} 
                        onClick={handleClick} 
                        fullWidth
                        animate
                    />
                </div>
            </div>
            {previewItemIndex !== null && (
                <ItemPreview
                    items={matchingItems}
                    itemIndex={previewItemIndex}
                    albumId={null}
                    onMoveNext={handleMoveNext}
                    onMovePrevious={handleMovePrevious}
                    onClose={handleClosePreview}
                />
            )}
        </>
    );
};

