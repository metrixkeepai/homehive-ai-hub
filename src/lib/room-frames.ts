// Conservative decoded-pixel comparison. Never discard a frame on a global hash alone:
// a small newly visible serial label can occupy much less than 1% of the frame.
export function sameRoomFrame(a: Uint8ClampedArray | undefined, b: Uint8ClampedArray): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < b.length; i += 4) {
    if (
      Math.abs(a[i]! - b[i]!) > 2 ||
      Math.abs(a[i + 1]! - b[i + 1]!) > 2 ||
      Math.abs(a[i + 2]! - b[i + 2]!) > 2
    )
      return false;
  }
  return true;
}
