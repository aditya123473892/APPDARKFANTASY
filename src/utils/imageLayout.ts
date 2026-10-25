/** Use the actual photo shape, including very tall portraits and wide panoramas. */
export function imageAspectRatio(width?: number, height?: number): number | undefined {
  return width != null &&
    height != null &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? width / height
    : undefined;
}
