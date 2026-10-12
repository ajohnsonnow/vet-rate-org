export function isIOSDevice(nav = navigator, win = window) {
  const ua = nav.userAgent;
  const ipadOnMacUA = /Macintosh/.test(ua) && nav.maxTouchPoints > 1;
  return (/iPad|iPhone|iPod/.test(ua) || ipadOnMacUA) && !win.MSStream;
}
