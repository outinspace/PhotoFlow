// Basemap configuration, shared by the full map and the small one in the info sheet.
//
// Vector tiles rather than the raster tiles this used to load: the browser gets one
// set of geometry per area and renders it at any zoom, so panning and zooming are
// continuous instead of resolving tile by tile.
//
// OpenFreeMap serves these free, with no API key and no request limit, which is what
// makes the map work in a cloned repo with nothing to configure. Attribution is
// required and MapLibre adds it automatically. Self-hosting is possible if the public
// instance is ever unavailable — see https://openfreemap.org.
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// The muted grey basemap is deliberate: it is a backdrop for the photo markers, so
// the map itself should recede. 'liberty' and 'bright' are more colourful, 'dark' and
// 'fiord' are dark; all are served from the same host.

// The style's glyph set only contains these three stacks, and MapLibre silently
// renders no label at all when asked for a font it cannot fetch.
export const LABEL_FONT = ['Noto Sans Bold'];

export const DOT_COLOR = '#0ea5e9';
export const DOT_STROKE = '#ffffff';
