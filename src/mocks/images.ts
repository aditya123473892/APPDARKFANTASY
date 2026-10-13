const svg = (a: string, b: string, accent: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="370" r="180" fill="${accent}" opacity=".75"/><path d="M145 1000c30-250 160-390 255-390s225 140 255 390" fill="#13101b" opacity=".75"/><circle cx="335" cy="350" r="18" fill="#17121f"/><circle cx="465" cy="350" r="18" fill="#17121f"/><path d="M335 455q65 48 130 0" stroke="#17121f" stroke-width="16" fill="none" stroke-linecap="round"/></svg>`)}`;

const scene = (a: string, b: string, sun: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#s)"/><circle cx="820" cy="360" r="130" fill="${sun}" opacity=".85"/><path d="M0 620l220-160 180 120 260-220 260 200 280-140v480H0z" fill="#0b0b0f" opacity=".72"/><path d="M0 760l300-120 260 90 300-130 340 120v180H0z" fill="#0b0b0f" opacity=".9"/></svg>`)}`;

/** Original, licence-free placeholder portraits. Replace only with properly licensed assets. */
export const mockImages = [
  svg('#28103e', '#a833ff', '#f0b6a8'),
  svg('#102c3e', '#167d8f', '#ba815d'),
  svg('#3d162a', '#d14880', '#e7ad92'),
  svg('#302718', '#b38332', '#8f5d45'),
  svg('#17254a', '#456bd8', '#f2c1a7'),
  svg('#321349', '#7734ad', '#c98868'),
  svg('#3a1020', '#ff4f87', '#f3c3a8'),
  svg('#1b1b26', '#5b4d7a', '#d6a07f'),
  svg('#2a0f1f', '#b03a6a', '#a8714f'),
  svg('#13202a', '#3f8c8c', '#efbe9c'),
];

/** Landscape placeholder artwork for post media of differing aspect ratios. */
export const mockScenes = [
  scene('#2b1036', '#ff4f87', '#f58fb0'),
  scene('#0f1b2d', '#3d5a8c', '#f2c1a7'),
  scene('#1d1b24', '#7a3e66', '#ffb38a'),
];
