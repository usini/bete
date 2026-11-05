// Preserve the chosen width while making the image area match its intrinsic aspect ratio.
export function fittedImageSize(node, width, height) {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  const caption = node.text?.trim() ? .16 : 0;
  const ratio = width / height * (1 - caption);
  let w = node.w, h = w / ratio;
  const minScale = Math.max(20 / w, 20 / h), maxScale = Math.min(1e5 / w, 1e5 / h);
  const scale = Math.min(maxScale, Math.max(1, minScale));
  w *= scale; h *= scale;
  return { w, h };
}
