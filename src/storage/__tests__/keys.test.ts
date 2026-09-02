import { describe, expect, it } from 'vitest';
import { shard } from '../keys';

// These names are a contract with the worker: worker/photoflow/keys.py builds the
// same strings, and a mismatch means the gallery silently loads nothing.
describe('shard object keys', () => {
    it('leaves the first part of a month unsuffixed', () => {
        // A catalog written before months could be split has to keep working.
        expect(shard('2025-01')).toBe('catalog/shards/2025-01.json');
        expect(shard('2025-01', 1)).toBe('catalog/shards/2025-01.json');
    });

    it('numbers the later parts of a split month', () => {
        expect(shard('2025-01', 2)).toBe('catalog/shards/2025-01.p2.json');
        expect(shard('2025-01', 11)).toBe('catalog/shards/2025-01.p11.json');
    });
});
