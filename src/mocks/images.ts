const svg = (a: string, b: string, accent: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="370" r="180" fill="${accent}" opacity=".75"/><path d="M145 1000c30-250 160-390 255-390s225 140 255 390" fill="#13101b" opacity=".75"/><circle cx="335" cy="350" r="18" fill="#17121f"/><circle cx="465" cy="350" r="18" fill="#17121f"/><path d="M335 455q65 48 130 0" stroke="#17121f" stroke-width="16" fill="none" stroke-linecap="round"/></svg>`)}`;

export const mockImages = [
  svg('#28103e', '#a833ff', '#f0b6a8'),
  svg('#102c3e', '#167d8f', '#ba815d'),
  svg('#3d162a', '#d14880', '#e7ad92'),
  svg('#302718', '#b38332', '#8f5d45'),
  svg('#17254a', '#456bd8', '#f2c1a7'),
  svg('#321349', '#7734ad', '#c98868'),
];
