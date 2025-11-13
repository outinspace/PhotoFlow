import { useEffect, useRef } from 'react';
import { Item } from '../types';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 50;

const checkCacheStatus = async (imageUrl: string): Promise<boolean> => {
    if (!('caches' in window)) {
        return false;
    }

    try {
        const cache = await caches.open('photoflow-images');
        const cached = await cache.match(imageUrl);
        return cached !== undefined;
    } catch {
        return false;
    }
};

const precacheImage = (imageUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
            resolve(true);
        };
        
        img.onerror = () => {
            resolve(false);
        };
        
        img.src = imageUrl;
    });
};

const getAllTileImageUrls = (items: Item[]): string[] => {
    const urls: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
        const file = item.primaryFile;
        if (file.tileImageUrl && !seen.has(file.tileImageUrl)) {
            seen.add(file.tileImageUrl);
            urls.push(file.tileImageUrl);
        }
    }

    return urls;
};

const processBatch = async (
    urls: string[],
    startIndex: number,
    onProgress: (cached: number) => void
): Promise<number> => {
    const endIndex = Math.min(startIndex + BATCH_SIZE, urls.length);
    const batch = urls.slice(startIndex, endIndex);

    let cachedCount = 0;
    let newlyCachedCount = 0;

    const promises = batch.map(async (url) => {
        const wasCached = await checkCacheStatus(url);
        if (!wasCached) {
            const success = await precacheImage(url);
            if (success) {
                cachedCount++;
                newlyCachedCount++;
            }
        } else {
            cachedCount++;
        }
    });

    await Promise.all(promises);
    onProgress(cachedCount);

    if (newlyCachedCount > 0) {
        console.log(`[ImagePrecache] Batch ${Math.floor(startIndex / BATCH_SIZE) + 1}: Cached ${newlyCachedCount} new images (${cachedCount}/${endIndex} total in batch)`);
    }

    return cachedCount;
};

export const useImagePrecache = (items: Item[] | undefined) => {
    const isPrecachingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const processedUrlsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!items || items.length === 0) {
            return;
        }

        const startPrecaching = async () => {
            if (isPrecachingRef.current) {
                console.log('[ImagePrecache] Already precaching, skipping');
                return;
            }

            if (!('caches' in window)) {
                console.log('[ImagePrecache] Cache API not available, skipping');
                return;
            }

            isPrecachingRef.current = true;
            abortControllerRef.current = new AbortController();

            const allUrls = getAllTileImageUrls(items);
            
            console.log(`[ImagePrecache] Found ${allUrls.length} total tile image URLs`);
            
            if (allUrls.length === 0) {
                console.log('[ImagePrecache] No images to precache');
                isPrecachingRef.current = false;
                return;
            }

            const urlsToProcess = allUrls.filter(url => !processedUrlsRef.current.has(url));

            console.log(`[ImagePrecache] Processing ${urlsToProcess.length} uncached images (${allUrls.length - urlsToProcess.length} already processed)`);

            if (urlsToProcess.length === 0) {
                console.log('[ImagePrecache] All images already processed');
                isPrecachingRef.current = false;
                return;
            }

            let totalCached = 0;
            let totalBatches = Math.ceil(urlsToProcess.length / BATCH_SIZE);

            console.log(`[ImagePrecache] Starting precache: ${urlsToProcess.length} images in ${totalBatches} batches`);

            const processNextBatch = async (startIndex: number) => {
                if (abortControllerRef.current?.signal.aborted) {
                    console.log('[ImagePrecache] Precache aborted');
                    return;
                }

                if (startIndex >= urlsToProcess.length) {
                    console.log(`[ImagePrecache] Precache complete: ${totalCached}/${urlsToProcess.length} images cached`);
                    isPrecachingRef.current = false;
                    return;
                }

                const batchNumber = Math.floor(startIndex / BATCH_SIZE) + 1;
                const cached = await processBatch(
                    urlsToProcess,
                    startIndex,
                    (count) => {
                        totalCached += count;
                    }
                );

                for (let i = startIndex; i < Math.min(startIndex + BATCH_SIZE, urlsToProcess.length); i++) {
                    processedUrlsRef.current.add(urlsToProcess[i]);
                }

                if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
                    console.log(`[ImagePrecache] Progress: ${batchNumber}/${totalBatches} batches, ${totalCached}/${urlsToProcess.length} images cached`);
                }

                if (abortControllerRef.current?.signal.aborted) {
                    console.log('[ImagePrecache] Precache aborted');
                    return;
                }

                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(() => {
                        processNextBatch(startIndex + BATCH_SIZE);
                    }, { timeout: 1000 });
                } else {
                    setTimeout(() => {
                        processNextBatch(startIndex + BATCH_SIZE);
                    }, BATCH_DELAY_MS);
                }
            };

            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    processNextBatch(0);
                }, { timeout: 2000 });
            } else {
                setTimeout(() => {
                    processNextBatch(0);
                }, 1000);
            }
        };

        startPrecaching();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            isPrecachingRef.current = false;
        };
    }, [items]);
};

