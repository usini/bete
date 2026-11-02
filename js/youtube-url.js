// Pure URL recognition, independent of browser persistence.
export function youTubeId(text) {
  if (!text) return null;
  // Any host works (www., m., music., none): only the part after "youtube.com/" matters.
  const m = String(text).match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|watch\/|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
