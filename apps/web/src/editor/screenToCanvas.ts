export function screenToCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  zoom: number,
): { x: number; y: number } {
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
}
