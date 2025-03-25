import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ItemGrid from './item.grid';
import { Item, File } from '../types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '../routes';

// Mock useVirtualizer
vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: () => ({
        getVirtualItems: () => [{ index: 0, key: 0, start: 0, lane: 0 }, { index: 1, key: 1, start: 0, lane: 1 }],
        getTotalSize: () => 100,
        measure: () => {},
        scrollToIndex: () => {},
        options: { lanes: 2 }
    }),
    defaultRangeExtractor: (range: any) => range
}));

// Mock the gallery route component
vi.mock('./gallery', () => ({
    default: () => <div data-testid="mock-gallery">Mock Gallery</div>
}));

const mockFile: File = {
    fileId: '1',
    contentType: 'image/jpeg',
    originalFileName: 'test.jpg',
    sizeBytes: 1000,
    uploadTimeUtc: new Date('2024-01-01').toISOString(),
    lastProcessedTimeUtc: null,
    tileVersion: 1,
    previewVersion: 1,
    originalUrl: 'test-original.jpg',
    tileImageUrl: 'test-tile.jpg',
    previewUrl: 'test-preview.jpg'
};

const mockItems: Item[] = [
    {
        itemId: 1,
        isFavorite: false,
        captureTime: new Date('2024-01-01').toISOString(),
        videoLength: null,
        widthPixels: 1920,
        heightPixels: 1080,
        longitude: null,
        latitude: null,
        altitude: null,
        city: null,
        region: null,
        megapixels: 2.1,
        exposureTime: null,
        aperature: null,
        fNumber: null,
        iso: null,
        cameraMake: null,
        cameraModel: null,
        files: [mockFile],
        deletedTimeUtc: null,
        primaryFile: mockFile,
        totalBytes: 1000,
        device: null,
        type: 'photo'
    },
    {
        itemId: 2,
        isFavorite: false,
        captureTime: new Date('2024-01-02').toISOString(),
        videoLength: null,
        widthPixels: 1920,
        heightPixels: 1080,
        longitude: null,
        latitude: null,
        altitude: null,
        city: null,
        region: null,
        megapixels: 2.1,
        exposureTime: null,
        aperature: null,
        fNumber: null,
        iso: null,
        cameraMake: null,
        cameraModel: null,
        files: [mockFile],
        deletedTimeUtc: null,
        primaryFile: mockFile,
        totalBytes: 2000,
        device: null,
        type: 'photo'
    }
];

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            {ui}
        </QueryClientProvider>
    );
};

describe('ItemGrid', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should open preview on single click', async () => {
        renderWithProviders(<ItemGrid items={mockItems} albumId={null} />);
        
        const firstItem = screen.getByTestId(`item-${mockItems[0].itemId}`);
        fireEvent.click(firstItem);

        // Fast-forward timers to trigger the single-click handler
        act(() => {
            vi.advanceTimersByTime(250);
        });

        // Verify preview is opened
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should enter selection mode on double click', () => {
        renderWithProviders(<ItemGrid items={mockItems} albumId={null} />);
        
        const firstItem = screen.getByTestId(`item-${mockItems[0].itemId}`);
        
        // Simulate double click
        fireEvent.click(firstItem);
        fireEvent.click(firstItem);

        // Verify selection mode is enabled and item is selected
        expect(screen.getByTestId('selection-mode-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('selection-overlay')).toBeInTheDocument();
    });

    it('should not open preview when double clicked', () => {
        renderWithProviders(<ItemGrid items={mockItems} albumId={null} />);
        
        const firstItem = screen.getByTestId(`item-${mockItems[0].itemId}`);
        
        // Simulate double click
        fireEvent.click(firstItem);
        fireEvent.click(firstItem);

        // Fast-forward timers to ensure preview wouldn't open
        act(() => {
            vi.advanceTimersByTime(250);
        });

        // Verify preview is not opened
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should handle selections immediately when already in selection mode', () => {
        renderWithProviders(<ItemGrid items={mockItems} albumId={null} />);
        
        // Enter selection mode first
        const firstItem = screen.getByTestId(`item-${mockItems[0].itemId}`);
        fireEvent.click(firstItem);
        fireEvent.click(firstItem);

        // Select second item
        const secondItem = screen.getByTestId(`item-${mockItems[1].itemId}`);
        fireEvent.click(secondItem);

        // Verify both items are selected without waiting
        expect(firstItem.querySelector('[data-testid="selection-overlay"]')).toBeInTheDocument();
        expect(secondItem.querySelector('[data-testid="selection-overlay"]')).toBeInTheDocument();
    });
}); 