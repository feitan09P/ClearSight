let canvas;
let context;

self.addEventListener("message", (event) => {
  const { requestId, bitmap } = event.data || {};
  if (!bitmap || !Number.isInteger(requestId)) {
    bitmap?.close?.();
    return;
  }
  void encodeFrame(requestId, bitmap);
});

async function encodeFrame(requestId, bitmap) {
  try {
    if (!canvas || canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      context = canvas.getContext("2d", { alpha: false });
    }
    if (!context) throw new Error("Could not create the video-frame canvas.");
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
    const dataUrl = new FileReaderSync().readAsDataURL(blob);
    self.postMessage({ requestId, dataUrl });
  } catch (error) {
    self.postMessage({ requestId, errorName: error?.name || "Error" });
  } finally {
    bitmap.close();
  }
}