/* Monster Hunter — canvas and image helpers shared by the art scripts (no dependencies). */

/* v3.11.3: offscreen canvases are made and freed through these. Mobile Safari has a hard cap on canvas
   memory and only returns it when a canvas is shrunk to 0×0 (or much later, at GC); past the cap
   getContext() returns null, which used to throw mid-frame and leave monsters and the hero undrawn. */
function newCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    const g = cv.getContext('2d');
    if (!g) {
        freeCanvas(cv);
        return null;
    }
    return { cv, g };
}
function freeCanvas(cv) {
    if (cv && cv.width !== undefined) {
        cv.width = 0;
        cv.height = 0;
    }
}
/** Loads an image, retrying a couple of times on a flaky connection. */
function loadImage(src, onload, tries = 3) {
    const img = new Image();
    img.onload = () => onload(img);
    img.onerror = () => {
        if (tries > 1) setTimeout(() => loadImage(src, onload, tries - 1), 2500);
        else onload(null);
    };
    img.src = src;
    return img;
}
