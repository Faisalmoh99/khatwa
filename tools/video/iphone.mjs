// iPhone-style frame (modern shape, Dynamic Island, side buttons) with NO logo or brand marks.
// The status bar strip holds the island so it never covers the app; the app sits below it (like Safari).
// Geometry is in "points" (CSS px of a 430x932 phone) and scaled by `k`.

export const PHONE = { w: 430, h: 932, status: 59, appH: 873 };

const statusIcons = (k, color) => `
  <svg width="${78 * k}" height="${13 * k}" viewBox="0 0 78 13" fill="${color}" style="display:block">
    <rect x="0" y="9" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/>
    <rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/>
    <path d="M30 4.5a10 10 0 0 1 14 0l-1.6 1.7a7.6 7.6 0 0 0-10.8 0zM33.2 7.8a5.4 5.4 0 0 1 7.6 0l-1.7 1.7a3 3 0 0 0-4.2 0zM37 13l-2.2-2.2a3.1 3.1 0 0 1 4.4 0z"/>
    <rect x="52" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="${color}" stroke-opacity=".5"/>
    <rect x="54" y="2.5" width="16" height="8" rx="2"/><rect x="75" y="4.5" width="2" height="4" rx="1" fill-opacity=".5"/>
  </svg>`;

/**
 * HTML for one framed phone. `screen` = an <img> or nothing (video overlay: transparent app area).
 * k = pixels per point. pad = transparent margin around the phone (for the shadow).
 */
export function phoneHtml({
  k,
  screen = '',
  statusBg = '#0a3742',
  statusFg = '#fff',
  pad = 0,
  shadow = true,
  // hollow: the body is only the bezel ring, so a video under the overlay shows through the screen
  hollow = false,
}) {
  const b = 13 * k; // bezel
  const r = 55 * k; // screen corner radius
  const W = PHONE.w * k;
  const H = PHONE.h * k;
  const x = pad + b;
  const y = pad + b;
  const btn = (side, top, h) =>
    `<div style="position:absolute;${side === 'L' ? `left:${pad - 3 * k}px` : `left:${pad + W + 2 * b - 0.5 * k}px`};top:${pad + top * k}px;width:${3.5 * k}px;height:${h * k}px;border-radius:${2 * k}px;background:linear-gradient(90deg,#2b2b30,#55555c,#2b2b30)"></div>`;
  return `
  ${
    hollow
      ? `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${W}px;height:${H}px;border:${b}px solid #0b0b0d;border-radius:${r + b}px;
      box-shadow:0 0 0 ${1.6 * k}px #5c5c63${shadow ? `, 0 ${18 * k}px ${44 * k}px rgba(0,0,0,.30)` : ''}"></div>`
      : `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${W + 2 * b}px;height:${H + 2 * b}px;border-radius:${r + b}px;
      background:#0b0b0d;box-shadow:inset 0 0 0 ${1.6 * k}px #5c5c63, inset 0 0 0 ${3 * k}px #1c1c20${shadow ? `, 0 ${18 * k}px ${44 * k}px rgba(0,0,0,.30)` : ''}"></div>`
  }
  ${btn('L', 150, 30)}${btn('L', 205, 55)}${btn('L', 272, 55)}${btn('R', 230, 90)}
  <div style="position:absolute;left:${x}px;top:${y}px;width:${W}px;height:${H}px;border-radius:${r}px;overflow:hidden;background:transparent">
    <div style="position:absolute;left:0;top:0;width:${W}px;height:${PHONE.status * k}px;background:${statusBg}"></div>
    <div style="position:absolute;left:${34 * k}px;top:${17 * k}px;font:600 ${17 * k}px -apple-system,'Helvetica Neue',Arial,sans-serif;color:${statusFg};letter-spacing:${-0.2 * k}px">9:41</div>
    <div style="position:absolute;right:${26 * k}px;top:${21 * k}px">${statusIcons(k, statusFg)}</div>
    <div style="position:absolute;left:${(W - 126 * k) / 2}px;top:${11 * k}px;width:${126 * k}px;height:${37 * k}px;border-radius:${19 * k}px;background:#000"></div>
    ${screen ? `<div style="position:absolute;left:0;top:${PHONE.status * k}px;width:${W}px;height:${PHONE.appH * k}px">${screen}</div>` : ''}
  </div>`;
}

/** Outer size of the framed phone image in px. */
export const framedSize = (k, pad) => ({
  w: PHONE.w * k + 2 * 13 * k + 2 * pad,
  h: PHONE.h * k + 2 * 13 * k + 2 * pad,
});
