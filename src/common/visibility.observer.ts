type Callback = (isIntersecting: boolean) => void;

const callbacks = new WeakMap<Element, Callback>();

const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            const cb = callbacks.get(entry.target);
            if (cb) cb(entry.isIntersecting);
        }
    },
    { rootMargin: '0px' }
);

export function observeVisibility(element: Element, callback: Callback): () => void {
    callbacks.set(element, callback);
    observer.observe(element);
    return () => {
        observer.unobserve(element);
        callbacks.delete(element);
    };
}
