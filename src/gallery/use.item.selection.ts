import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Item } from '../types';

const keysPressed = new Set();

const handleKeyDown = (e: KeyboardEvent) => {
    keysPressed.add(e.key);
};

const handleKeyUp = (e: KeyboardEvent) => {
    keysPressed.delete(e.key);
};

export function useItemSelection(allItems: Item[]) {
    const [selectedItemsById, setSelectedItemsById] = useState<Record<number, Item>>({});
    const selectedItems = useMemo(() => Object.values(selectedItemsById), [selectedItemsById]);

    const lastLastSelectedItem = useRef<Item | null>(null);
    const lastSelectedItem = useRef<Item | null>(null);

    // Refs let toggleItemSelection stay referentially stable (it reaches every memoized
    // tile via handleItemClick) while still reading the latest selection / item list.
    const selectedItemsByIdRef = useRef(selectedItemsById);
    selectedItemsByIdRef.current = selectedItemsById;
    const allItemsRef = useRef(allItems);
    allItemsRef.current = allItems;

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const toggleItemSelection = useCallback((item: Item, isDoubleClick: boolean) => {
        const selectedItemsById = selectedItemsByIdRef.current;
        const allItems = allItemsRef.current;
        if (!isDoubleClick && selectedItemsById[item.itemId]) {
            const newItems = { ...selectedItemsById };
            delete newItems[item.itemId];

            setSelectedItemsById(newItems);
            lastSelectedItem.current = null;
        } else {
            const newSelectedItemsById = { ...selectedItemsById, [item.itemId]: item };

            const lastSelection = item === lastSelectedItem.current ? lastLastSelectedItem.current : lastSelectedItem.current;

            // Select range
            if ((isDoubleClick || keysPressed.has('Shift')) && lastSelection) {
                const index1 = allItems.findIndex(i => i === item);
                const index2 = allItems.findIndex(i => i === lastSelection);

                const minIndex = Math.min(index1, index2);
                const maxIndex = Math.max(index1, index2);

                const rangeItems = allItems.slice(minIndex, maxIndex);
                for (const rangeItem of rangeItems) {
                    newSelectedItemsById[rangeItem.itemId] = rangeItem;
                }
            }

            lastLastSelectedItem.current = lastSelectedItem.current;
            lastSelectedItem.current = item;
            setSelectedItemsById(newSelectedItemsById);
        }
    }, []);

    const resetSelection = useCallback(() => {
        setSelectedItemsById({});
    }, []);

    return {
        selectedItems,
        selectedItemsById,
        toggleItemSelection,
        resetSelection
    }
}
