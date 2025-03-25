import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock ResizeObserver
class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Setup modal root for tests
beforeEach(() => {
    const modalRoot = document.createElement('div');
    modalRoot.setAttribute('id', 'modal-root');
    document.body.appendChild(modalRoot);
});

afterEach(() => {
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
        document.body.removeChild(modalRoot);
    }
}); 