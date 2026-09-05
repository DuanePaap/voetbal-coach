// Viewport meta's user-scalable=no is not enough — iOS Safari ignores it since iOS 10
// for accessibility. This only blocks the two-finger pinch gesture (native gesture
// events on Safari, multi-touch move elsewhere) so the app feels fixed-scale like a
// native app; single-finger taps, drags and scrolling are untouched.
(() => {
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
})();
