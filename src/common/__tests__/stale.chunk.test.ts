import { describe, expect, it } from 'vitest';
import { shouldReload } from '../stale.chunk';

// The guard is all that stands between a missing chunk and an endless reload loop.
describe('stale chunk reload guard', () => {
    it('reloads when this tab has not reloaded for a missing chunk', () => {
        expect(shouldReload(null, 1_000_000)).toBe(true);
        expect(shouldReload('980000', 1_000_000)).toBe(true);
    });

    it('gives up rather than reloading again within the cooldown', () => {
        expect(shouldReload('999000', 1_000_000)).toBe(false);
    });

    it('reloads if the stored timestamp is unreadable', () => {
        expect(shouldReload('', 1_000_000)).toBe(true);
        expect(shouldReload('not a number', 1_000_000)).toBe(true);
    });
});
