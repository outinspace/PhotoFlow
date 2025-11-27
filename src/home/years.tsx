import { useMemo, useState, useCallback } from 'react';
import { useGallery } from '../api/useGallery';
import { parseISO, getYear } from 'date-fns';
import ItemPreview from '../gallery/item.preview';
import { ItemStack } from './item.stack';
import { Item } from '../types';

export const Years = () => {
    const { data: gallery } = useGallery();
    const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
    const [selectedYearItems, setSelectedYearItems] = useState<Item[]>([]);

    const itemsByYear = useMemo(() => {
        if (!gallery?.items) return {};

        const grouped: Record<number, Item[]> = {};

        for (const item of gallery.items) {
            const year = getYear(parseISO(item.captureTime));
            if (!grouped[year]) {
                grouped[year] = [];
            }
            grouped[year].push(item);
        }

        // Sort items within each year by capture time (newest first)
        for (const year in grouped) {
            grouped[year].sort((a, b) => {
                const dateA = parseISO(a.captureTime).getTime();
                const dateB = parseISO(b.captureTime).getTime();
                return dateB - dateA;
            });
        }

        return grouped;
    }, [gallery?.items]);

    const years = useMemo(() => {
        return Object.keys(itemsByYear)
            .map(Number)
            .sort((a, b) => b - a); // Sort years descending (newest first)
    }, [itemsByYear]);

    const handleYearClick = useCallback((yearItems: Item[]) => {
        setSelectedYearItems(yearItems);
        setPreviewItemIndex(0);
    }, []);

    const handleClosePreview = useCallback(() => {
        setPreviewItemIndex(null);
        setSelectedYearItems([]);
    }, []);

    const handleMoveNext = useCallback(() => {
        if (previewItemIndex === null) return;
        const newIndex = previewItemIndex >= selectedYearItems.length - 1 ? selectedYearItems.length - 1 : previewItemIndex + 1;
        setPreviewItemIndex(newIndex);
    }, [previewItemIndex, selectedYearItems.length]);

    const handleMovePrevious = useCallback(() => {
        if (previewItemIndex === null) return;
        const newIndex = previewItemIndex === 0 ? 0 : previewItemIndex - 1;
        setPreviewItemIndex(newIndex);
    }, [previewItemIndex]);

    if (years.length === 0) {
        return null;
    }

    return (
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 px-8">Years</h2>
                <div className="overflow-x-auto" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex shrink-1 gap-4 pl-8" style={{ width: 'max-content' }}>
                        {years.map((year) => {
                            const yearItems = itemsByYear[year];
                            return (
                                <div key={year} className="flex flex-col items-center flex-shrink-0">
                                    <ItemStack
                                        items={yearItems}
                                        onClick={() => handleYearClick(yearItems)}
                                        staticMode={true}
                                    />
                                    <div className="mt-2 text-sm font-medium">{year}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {previewItemIndex !== null && selectedYearItems.length > 0 && (
                <ItemPreview
                    items={selectedYearItems}
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

