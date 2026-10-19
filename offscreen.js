const MODEL_URL = chrome.runtime.getURL("assets/models/nsfwjs/model.json");
const NUDENET_MODEL_URL = chrome.runtime.getURL("assets/models/nudenet/320n.onnx");
const NUDENET_NMS_MODEL_URL = chrome.runtime.getURL("assets/models/nudenet/nms-yolov8.onnx");
const NUDENET_WASM_URL = chrome.runtime.getURL("vendor/ort-wasm-simd.wasm");
const NUDENET_WASM_FALLBACK_URL = chrome.runtime.getURL("vendor/ort-wasm.wasm");
const NUDENET_INPUT_SIZE = 320;
const CLASS_NAMES = ["Drawing", "Hentai", "Neutral", "Porn", "Sexy"];
const SCORE_NAMES = [...CLASS_NAMES, "NSFW", "SFW"];
const NUDENET_CLASS_NAMES = [
  "FEMALE_GENITALIA_COVERED",
  "FACE_FEMALE",
  "BUTTOCKS_EXPOSED",
  "FEMALE_BREAST_EXPOSED",
  "FEMALE_GENITALIA_EXPOSED",
  "MALE_BREAST_EXPOSED",
  "ANUS_EXPOSED",
  "FEET_EXPOSED",
  "BELLY_COVERED",
  "FEET_COVERED",
  "ARMPITS_COVERED",
  "ARMPITS_EXPOSED",
  "FACE_MALE",
  "BELLY_EXPOSED",
  "MALE_GENITALIA_EXPOSED",
  "ANUS_COVERED",
  "FEMALE_BREAST_COVERED",
  "BUTTOCKS_COVERED",
];
const DEFAULTS = { enabled: true, threshold: 0.77, partThreshold: 0.61, blurVideos: true };
const MIN_THRESHOLD = 0.25;
const MAX_THRESHOLD = 0.98;
const MIN_PART_THRESHOLD = 0.15;
const MAX_PART_THRESHOLD = 0.80;
const VIDEO_CLASSIFIER_MAX_EDGE = 512;
const MAX_CLASSIFICATION_CACHE_ENTRIES = 192;
const CLASSIFICATION_CACHE_TTL_MS = 120000;
const MAX_PARALLEL_IMAGE_LOADS = 4;
const EXPOSED_PARTS = new Map([
  ["BUTTOCKS_EXPOSED", { label: "exposed buttocks", defaultThreshold: 0.52, absoluteFloor: 0.27 }],
  ["FEMALE_BREAST_EXPOSED", { label: "exposed breasts", defaultThreshold: 0.40, absoluteFloor: 0.20 }],
  ["FEMALE_GENITALIA_EXPOSED", { label: "exposed vagina", defaultThreshold: 0.32, absoluteFloor: 0.15 }],
  ["MALE_GENITALIA_EXPOSED", { label: "exposed penis", defaultThreshold: 0.32, absoluteFloor: 0.15 }],
  ["ANUS_EXPOSED", { label: "exposed anus", defaultThreshold: 0.32, absoluteFloor: 0.15 }],
]);
let human;
let nsfwModel;
let nudeModel;
let nudeNmsModel;
let runtimePromise;
let nsfwLoadPromise;
let nudeLoadPromise;
let modelWarmupPromise;
let settings = { ...DEFAULTS };
let inferenceRunning = false;
let lastWasRealtime = false;
const normalInferenceQueue = [];
let pendingRealtimeInference;
let activeImageLoads = 0;
const waitingImageLoads = [];
const gifDecoderCache = new Map();
const classificationCache = new Map();
const MAX_GIF_DECODERS = 3;
const REMOTE_VIDEO_MAX_BYTES = 32 * 1024 * 1024;
const REMOTE_VIDEO_MAX_DURATION_SECONDS = 180;
let tabCaptureStream;
let tabCaptureVideo;
let tabCaptureTabId;
let tabCaptureAudioContext;
let tabCaptureCanvas;
let tabCaptureContext;
let inputCanvas;
let inputCanvasContext;
let inputCanvasSize = "";
let nudeCanvas;
let nudeCanvasContext;

function normalizeSettings(saved) {
  const merged = { ...DEFAULTS, ...saved };
  const requestedThreshold = Number(merged.threshold);
  merged.threshold = !Number.isFinite(requestedThreshold) || requestedThreshold < MIN_THRESHOLD
    ? DEFAULTS.threshold
    : Math.min(MAX_THRESHOLD, requestedThreshold);
  const requestedPartThreshold = Number(merged.partThreshold);
  merged.partThreshold = !Number.isFinite(requestedPartThreshold) || requestedPartThreshold < MIN_PART_THRESHOLD
    ? DEFAULTS.partThreshold
    : Math.min(MAX_PART_THRESHOLD, requestedPartThreshold);
  return merged;
}

async function loadRuntime() {
  if (human) return;
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const runtime = new Human.Human({
      backend: "webgl",
      modelBasePath: "",
      face: { enabled: false },
      body: { enabled: false },
      hand: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
    });
    const tf = runtime.tf;
    globalThis.tf = tf;
    human = runtime;
    tf.enableProdMode();
    try { tf.env().set("WEBGL_USE_SHAPES_UNIFORMS", true); } catch { /* Backend may already be initialized. */ }
    try {
      const webglReady = await tf.setBackend("webgl");
      if (!webglReady) throw new Error("TensorFlow.js WebGL backend is unavailable.");
      await tf.ready();
    } catch (webglError) {
      const cpuReady = await tf.setBackend("cpu");
      if (!cpuReady) throw webglError;
      await tf.ready();
    }
    // Human supplies TensorFlow.js only; its own detectors remain disabled.
  })().catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}

async function loadNsfwModel() {
  if (nsfwModel) return nsfwModel;
  if (nsfwLoadPromise) return nsfwLoadPromise;
  nsfwLoadPromise = (async () => {
    await loadRuntime();
    nsfwModel = await globalThis.tf.loadGraphModel(MODEL_URL);
    return nsfwModel;
  })().catch((error) => {
    nsfwLoadPromise = undefined;
    throw error;
  });
  return nsfwLoadPromise;
}

async function createNudeSessions(runtime, executionProvider) {
  const modelSession = await runtime.InferenceSession.create(NUDENET_MODEL_URL, {
    executionProviders: [executionProvider],
  });
  try {
    const nmsSession = await runtime.InferenceSession.create(NUDENET_NMS_MODEL_URL, {
      executionProviders: [executionProvider],
    });
    return { modelSession, nmsSession };
  } catch (error) {
    await Promise.resolve(modelSession.release()).catch(() => undefined);
    throw error;
  }
}

async function loadNudeModel() {
  if (nudeModel) return nudeModel;
  if (nudeLoadPromise) return nudeLoadPromise;
  nudeLoadPromise = (async () => {
    const runtime = globalThis.ClearSightOrt;
    if (!runtime?.InferenceSession || !runtime?.Tensor || !runtime?.env?.wasm) {
      throw new Error("The local NudeNet runtime is unavailable.");
    }
    runtime.env.wasm.wasmPaths = {
      "ort-wasm-simd.wasm": NUDENET_WASM_URL,
      "ort-wasm.wasm": NUDENET_WASM_FALLBACK_URL,
    };
    runtime.env.wasm.numThreads = 1;
    let sessions;
    try {
      sessions = await createNudeSessions(runtime, "webgl");
    } catch {
      sessions = await createNudeSessions(runtime, "wasm");
    }
    nudeModel = sessions.modelSession;
    nudeNmsModel = sessions.nmsSession;
    return nudeModel;
  })().catch((error) => {
    nudeLoadPromise = undefined;
    throw error;
  });
  return nudeLoadPromise;
}

async function switchToCpuBackend(originalError) {
  const tf = globalThis.tf;
  if (!tf || tf.getBackend() !== "webgl") throw originalError;
  nsfwModel?.dispose();
  nsfwModel = undefined;
  nsfwLoadPromise = undefined;
  if (!(await tf.setBackend("cpu"))) throw originalError;
  await tf.ready();
}

async function warmupNsfwModel() {
  if (modelWarmupPromise) return modelWarmupPromise;
  modelWarmupPromise = (async () => {
    await loadNsfwModel();
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Could not warm up the local image model.");
    context.fillStyle = "#777";
    context.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await classifyNsfw(canvas, DEFAULTS.threshold);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  })().catch((error) => {
    modelWarmupPromise = undefined;
    throw error;
  });
  return modelWarmupPromise;
}

async function bitmapFromRequest(message) {
  if (message.captureRect) return bitmapFromCapturedTab(message.captureRect, message.senderTabId);
  const url = message.dataUrl || message.imageUrl;
  if (!url || !(url.startsWith("http:") || url.startsWith("https:") || url.startsWith("data:image/"))) {
    throw new Error("This image source cannot be read by the extension.");
  }
  const cacheKey = message.imageUrl || message.dataUrl;
  if (message.animationFrameIndex !== undefined && gifDecoderCache.has(cacheKey)) {
    const cachedFrame = await decodeCachedGifFrame(cacheKey, message.animationFrameIndex);
    if (cachedFrame) return cachedFrame;
  }
  const isDataUrl = url.startsWith("data:image/");
  const response = await fetch(url, isDataUrl ? undefined : { credentials: "include", cache: "force-cache" });
  if (!response.ok) throw new Error("Image request failed (" + response.status + ").");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 12 * 1024 * 1024) {
    throw new Error("Unsupported or oversized image.");
  }
  const mimeType = blob.type.toLowerCase().split(";")[0].trim();
  if (mimeType === "image/gif" && typeof ImageDecoder === "function") {
    try {
      const entry = await createGifDecoder(cacheKey, blob);
      if (entry) return decodeGifEntry(cacheKey, entry, message.animationFrameIndex || 0);
    } catch {
      evictGifDecoder(cacheKey);
      // Fall back to the browser's regular still-image decoder if this GIF is
      // malformed or this browser cannot decode its animation stream.
    }
  }
  return { bitmap: await createImageBitmap(blob), animatedFrameCount: 0, mimeType };
}

async function bitmapFromCapturedTab(rect, senderTabId) {
  if (!tabCaptureVideo || tabCaptureVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      tabCaptureVideo.videoWidth <= 0 || tabCaptureVideo.videoHeight <= 0) {
    throw new Error("Chrome blocks direct pixels for this video. Open ClearSight and enable video capture for this tab.");
  }
  if (!senderTabId || senderTabId !== tabCaptureTabId) {
    throw new Error("Video capture is not active for this tab. Open ClearSight and enable video capture for this tab.");
  }
  const values = [rect.x, rect.y, rect.width, rect.height, rect.viewportWidth, rect.viewportHeight].map(Number);
  if (values.some((value) => !Number.isFinite(value)) || rect.width <= 0 || rect.height <= 0 ||
      rect.viewportWidth <= 0 || rect.viewportHeight <= 0) {
    throw new Error("The video frame position could not be mapped to the captured tab.");
  }
  const [x, y, width, height, viewportWidth, viewportHeight] = values;
  const scaleX = tabCaptureVideo.videoWidth / viewportWidth;
  const scaleY = tabCaptureVideo.videoHeight / viewportHeight;
  const sx = Math.max(0, x * scaleX);
  const sy = Math.max(0, y * scaleY);
  const right = Math.min(tabCaptureVideo.videoWidth, (x + width) * scaleX);
  const bottom = Math.min(tabCaptureVideo.videoHeight, (y + height) * scaleY);
  const sourceWidth = right - sx;
  const sourceHeight = bottom - sy;
  if (sourceWidth < 2 || sourceHeight < 2) throw new Error("The video is outside the captured viewport.");
  const scale = Math.min(1, VIDEO_CLASSIFIER_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  if (!tabCaptureCanvas) tabCaptureCanvas = document.createElement("canvas");
  if (tabCaptureCanvas.width !== outputWidth || tabCaptureCanvas.height !== outputHeight) {
    tabCaptureCanvas.width = outputWidth;
    tabCaptureCanvas.height = outputHeight;
    tabCaptureContext = tabCaptureCanvas.getContext("2d", { alpha: false });
  }
  if (!tabCaptureContext) throw new Error("Could not prepare the captured video frame.");
  tabCaptureContext.drawImage(tabCaptureVideo, sx, sy, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
  return {
    bitmap: await createImageBitmap(tabCaptureCanvas),
    animatedFrameCount: 0,
    mimeType: "image/png",
    captureMethod: "tab-capture",
  };
}

async function startTabCapture(message) {
  await stopTabCapture();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.streamId } },
    video: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.streamId },
      // Active videos are sampled every 600 ms; a 10 fps capture leaves fresh
      // frames for each check while avoiding a full-rate duplicate pipeline.
      optional: [{ maxWidth: 1280 }, { maxHeight: 720 }, { maxFrameRate: 10 }],
    },
  });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  document.body.append(video);
  try {
    await video.play();
    tabCaptureAudioContext = new AudioContext();
    const audioSource = tabCaptureAudioContext.createMediaStreamSource(stream);
    audioSource.connect(tabCaptureAudioContext.destination);
    await tabCaptureAudioContext.resume();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    video.remove();
    if (tabCaptureAudioContext) await tabCaptureAudioContext.close().catch(() => undefined);
    tabCaptureAudioContext = undefined;
    throw error;
  }
  tabCaptureStream = stream;
  tabCaptureVideo = video;
  tabCaptureTabId = message.tabId;
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (tabCaptureStream === stream) void stopTabCapture();
  }, { once: true });
  return { active: true, tabId: tabCaptureTabId };
}

async function stopTabCapture() {
  const stream = tabCaptureStream;
  const video = tabCaptureVideo;
  const audioContext = tabCaptureAudioContext;
  tabCaptureStream = undefined;
  tabCaptureVideo = undefined;
  tabCaptureTabId = undefined;
  tabCaptureAudioContext = undefined;
  if (video) {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
  stream?.getTracks().forEach((track) => track.stop());
  if (audioContext && audioContext.state !== "closed") await audioContext.close().catch(() => undefined);
  return { active: false };
}

async function createGifDecoder(cacheKey, blob) {
  let decoder;
  try {
    decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: "image/gif", preferAnimation: true });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const frameCount = Number(track?.frameCount) || 0;
    if (frameCount < 2) {
      decoder.close();
      return null;
    }
    const entry = { decoder, frameCount };
    gifDecoderCache.set(cacheKey, entry);
    while (gifDecoderCache.size > MAX_GIF_DECODERS) {
      evictGifDecoder(gifDecoderCache.keys().next().value);
    }
    return entry;
  } catch (error) {
    decoder?.close();
    throw error;
  }
}

async function decodeCachedGifFrame(cacheKey, frameIndex) {
  const entry = gifDecoderCache.get(cacheKey);
  if (!entry) return undefined;
  // Refresh this entry in the small LRU cache so currently visible GIFs stay warm.
  gifDecoderCache.delete(cacheKey);
  gifDecoderCache.set(cacheKey, entry);
  try {
    return await decodeGifEntry(cacheKey, entry, frameIndex);
  } catch {
    evictGifDecoder(cacheKey);
    return undefined;
  }
}

async function decodeGifEntry(cacheKey, entry, frameIndex) {
  const index = ((Math.trunc(Number(frameIndex) || 0) % entry.frameCount) + entry.frameCount) % entry.frameCount;
  const decoded = await entry.decoder.decode({ frameIndex: index });
  try {
    return {
      bitmap: await createImageBitmap(decoded.image),
      animatedFrameCount: entry.frameCount,
      mimeType: "image/gif",
    };
  } finally {
    decoded.image.close();
  }
}

function evictGifDecoder(cacheKey) {
  const entry = gifDecoderCache.get(cacheKey);
  if (!entry) return;
  gifDecoderCache.delete(cacheKey);
  try { entry.decoder.close(); } catch { /* Already closed. */ }
}

function inferenceCropRects(bitmap, isThumbnail = false) {
  const width = bitmap.width;
  const height = bitmap.height;
  const shortEdge = Math.min(width, height);
  if (shortEdge < 64) return [];

  // Use tighter crops for still thumbnails and ad creatives. Their unsafe
  // subject often occupies a small part of the full image and is diluted by
  // the whole-frame resize. Keep the wider crops for video and larger images.
  const cropRatio = isThumbnail || shortEdge <= 360 ? 0.45 : 0.6;
  const cropSize = Math.min(shortEdge, Math.max(64, Math.round(shortEdge * cropRatio)));
  const spanX = width - cropSize;
  const spanY = height - cropSize;
  const cornersAndCenter = [
    { x: Math.round(spanX / 2), y: Math.round(spanY / 2) },
    { x: 0, y: 0 },
    { x: spanX, y: 0 },
    { x: 0, y: spanY },
    { x: spanX, y: spanY },
  ];
  const unique = new Map(cornersAndCenter.map((point) => [point.x + ":" + point.y, point]));
  return [...unique.values()].map(({ x, y }) => ({ x, y, width: cropSize, height: cropSize }));
}

async function classifyCrops(bitmap, requestSettings, isThumbnail, nsfwResult, exposedPart) {
  const explicitScore = Math.max(nsfwResult.scores.Porn || 0, nsfwResult.scores.Hentai || 0);
  const shouldCheckNsfwCrops = explicitScore >= requestSettings.threshold * 0.35 ||
    (nsfwResult.scores.Sexy || 0) >= 0.50;
  const shouldCheckBodyCrops = Boolean(exposedPart && exposedPart.score >= exposedPart.threshold * 0.55);
  if (!shouldCheckNsfwCrops && !shouldCheckBodyCrops) return undefined;

  for (const rect of inferenceCropRects(bitmap, isThumbnail)) {
    let crop;
    try {
      crop = await createImageBitmap(bitmap, rect.x, rect.y, rect.width, rect.height);
      if (shouldCheckNsfwCrops) {
        const cropNsfw = await classifyNsfw(crop, requestSettings.threshold);
        if (cropNsfw.blurred) return { ...cropNsfw, detector: "image-classifier-crop" };
      }
      if (shouldCheckBodyCrops) {
        const cropPart = await detectExposedPart(crop, requestSettings.partThreshold);
        if (cropPart && cropPart.score >= cropPart.threshold) {
          return {
            blurred: true,
            reason: cropPart.label,
            score: cropPart.score,
            detector: "body-part-crop",
            exposedPartChecked: true,
            scores: nsfwResult.scores,
          };
        }
      }
    } catch {
      // If a crop cannot be decoded or analyzed, retain the whole-image result.
    } finally {
      crop?.close();
    }
  }
  return undefined;
}

async function pixelsAtSize(bitmap, width, height) {
  const size = width + "x" + height;
  if (!inputCanvas) inputCanvas = document.createElement("canvas");
  if (inputCanvasSize !== size) {
    inputCanvas.width = width;
    inputCanvas.height = height;
    inputCanvasContext = inputCanvas.getContext("2d", { alpha: false });
    inputCanvasSize = size;
  }
  if (!inputCanvasContext) throw new Error("Could not prepare image pixels.");
  inputCanvasContext.drawImage(bitmap, 0, 0, width, height);
  return human.tf.browser.fromPixels(inputCanvas);
}

async function classifyNsfw(bitmap, threshold) {
  try {
    await loadNsfwModel();
    return await classifyNsfwOnCurrentBackend(bitmap, threshold);
  } catch (webglError) {
    await switchToCpuBackend(webglError);
    await loadNsfwModel();
    return classifyNsfwOnCurrentBackend(bitmap, threshold);
  }
}

async function classifyNsfwOnCurrentBackend(bitmap, threshold) {
  const tf = human.tf;
  let pixels;
  let batch;
  let input;
  let output;
  try {
    pixels = await pixelsAtSize(bitmap, 224, 224);
    batch = tf.expandDims(pixels, 0);
    input = tf.div(batch, 255);
    output = nsfwModel.predict(input);
    const values = Array.from(await output.data());
    const scores = Object.fromEntries(CLASS_NAMES.map((name, index) => [name, values[index] || 0]));
    const nsfwScore = Math.max(scores.Porn, scores.Hentai);
    scores.NSFW = nsfwScore;
    scores.SFW = (scores.Drawing || 0) + (scores.Neutral || 0);
    return {
      blurred: nsfwScore >= threshold,
      scores,
    };
  } finally {
    tf.dispose([pixels, batch, input].filter(Boolean));
    if (output) tf.dispose(output);
  }
}

async function detectExposedPart(bitmap, threshold) {
  await loadNudeModel();
  const runtime = globalThis.ClearSightOrt;
  const canvasSize = NUDENET_INPUT_SIZE;
  const scale = canvasSize / Math.max(bitmap.width, bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  if (!nudeCanvas) {
    nudeCanvas = document.createElement("canvas");
    nudeCanvas.width = canvasSize;
    nudeCanvas.height = canvasSize;
    nudeCanvasContext = nudeCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
  }
  if (!nudeCanvasContext) throw new Error("Could not prepare NudeNet image pixels.");
  nudeCanvasContext.fillStyle = "#000";
  nudeCanvasContext.fillRect(0, 0, canvasSize, canvasSize);
  nudeCanvasContext.drawImage(bitmap, 0, 0, width, height);
  const rgba = nudeCanvasContext.getImageData(0, 0, canvasSize, canvasSize).data;
  const planeSize = canvasSize * canvasSize;
  const pixels = new Float32Array(3 * planeSize);
  for (let index = 0; index < planeSize; index++) {
    const rgbaIndex = index * 4;
    pixels[index] = rgba[rgbaIndex] / 255;
    pixels[planeSize + index] = rgba[rgbaIndex + 1] / 255;
    pixels[2 * planeSize + index] = rgba[rgbaIndex + 2] / 255;
  }

  let input;
  let nmsConfig;
  let predictions;
  let selections;
  try {
    input = new runtime.Tensor("float32", pixels, [1, 3, canvasSize, canvasSize]);
    nmsConfig = new runtime.Tensor("float32", new Float32Array([100, 0.45, 0.05]));
    predictions = await nudeModel.run({ images: input });
    selections = await nudeNmsModel.run({ detection: predictions.output0, config: nmsConfig });
    const selected = selections.selected;
    const rowSize = selected.dims[2];
    const data = selected.data;
    let best;
    for (let row = 0; row < selected.dims[1]; row++) {
      const rowOffset = row * rowSize;
      let score = -Infinity;
      let classIndex = -1;
      for (let classOffset = 4; classOffset < rowSize; classOffset++) {
        const candidateScore = data[rowOffset + classOffset];
        if (candidateScore > score) {
          score = candidateScore;
          classIndex = classOffset - 4;
        }
      }
      const part = EXPOSED_PARTS.get(NUDENET_CLASS_NAMES[classIndex]);
      if (!part) continue;
      const effectiveThreshold = Math.max(
        part.absoluteFloor,
        part.defaultThreshold + threshold - DEFAULTS.partThreshold,
      );
      if (!best || score > best.score) best = { label: part.label, score, threshold: effectiveThreshold };
    }
    return best || null;
  } finally {
    input?.dispose();
    nmsConfig?.dispose();
    for (const tensor of Object.values(predictions || {})) tensor?.dispose?.();
    for (const tensor of Object.values(selections || {})) tensor?.dispose?.();
  }
}

async function classifyBitmap(
  bitmap,
  requestSettings,
  isVideoFrame,
  mimeType,
  animatedFrameCount = 0,
  isThumbnail = false,
  runExposedPart = true,
) {
  let nsfwResult;
  let classifierError;
  try {
    nsfwResult = await classifyNsfw(bitmap, requestSettings.threshold);
    if (nsfwResult.blurred) {
      return { ...nsfwResult, detector: "image-classifier", exposedPartChecked: false, animatedFrameCount, mimeType };
    }
  } catch (error) {
    classifierError = error?.message || "Image classifier unavailable";
  }

  if (isVideoFrame && !runExposedPart) {
    if (classifierError) throw new Error(classifierError);
    return { ...nsfwResult, blurred: false, detector: "image-classifier", exposedPartChecked: false, animatedFrameCount, mimeType };
  }

  let exposedPart;
  let nudityModelError;
  try {
    exposedPart = await detectExposedPart(bitmap, requestSettings.partThreshold);
  } catch (error) {
    nudityModelError = error?.message || "Body-part model unavailable";
  }
  if (exposedPart && exposedPart.score >= exposedPart.threshold) {
    return {
      blurred: true,
      reason: exposedPart.label,
      score: exposedPart.score,
      detector: "body-part",
      exposedPartChecked: true,
      scores: nsfwResult?.scores || {},
      animatedFrameCount,
      mimeType,
    };
  }
  if (classifierError || nudityModelError) {
    throw new Error([classifierError, nudityModelError].filter(Boolean).join("; "));
  }
  if (!isVideoFrame) {
    const cropResult = await classifyCrops(bitmap, requestSettings, isThumbnail, nsfwResult, exposedPart);
    if (cropResult?.blurred) return { ...cropResult, animatedFrameCount, mimeType };
  }
  return {
    ...nsfwResult,
    blurred: false,
    detector: "image-classifier",
    exposedPartChecked: true,
    animatedFrameCount,
    mimeType,
  };
}

async function readLimitedVideoResponse(response, url) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > REMOTE_VIDEO_MAX_BYTES) {
    if (response.body) await response.body.cancel().catch(() => undefined);
    throw new Error("Remote video exceeds the local analysis size limit.");
  }
  const chunks = [];
  let total = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > REMOTE_VIDEO_MAX_BYTES) {
          await reader.cancel();
          throw new Error("Remote video exceeds the local analysis size limit.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const blob = await response.blob();
    if (blob.size > REMOTE_VIDEO_MAX_BYTES) throw new Error("Remote video exceeds the local analysis size limit.");
    chunks.push(blob);
  }
  const extension = new URL(url).pathname.split(".").pop().toLowerCase();
  const fallbackMime = extension === "webm" ? "video/webm" : extension === "ogv" ? "video/ogg" : "video/mp4";
  const responseMime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const mimeType = responseMime.startsWith("video/") ? responseMime : fallbackMime;
  return new Blob(chunks, { type: mimeType });
}

async function fetchRemoteVideoBlob(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      credentials: "include",
      cache: "force-cache",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Video request failed (" + response.status + ").");
    return await readLimitedVideoResponse(response, url);
  } finally {
    clearTimeout(timeout);
  }
}

function waitForVideoEvent(video, eventName, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The browser could not decode the remote video.")); };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while decoding the remote video."));
    }, timeoutMs);
  });
}

function seekVideoFrame(video, time) {
  if (Math.abs(video.currentTime - time) < 0.03 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The browser could not seek within the remote video.")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while seeking the remote video."));
    }, 8000);
    try {
      video.currentTime = time;
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function classifyRemoteVideo(url, requestSettings) {
  const blob = await fetchRemoteVideoBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;";
  document.body.append(video);
  try {
    const metadataReady = waitForVideoEvent(video, "loadedmetadata");
    video.src = objectUrl;
    video.load();
    await metadataReady;
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > REMOTE_VIDEO_MAX_DURATION_SECONDS) {
      throw new Error("Remote video duration is outside the local analysis limit.");
    }
    const ratios = [0.04, 0.18, 0.32, 0.5, 0.68, 0.82, 0.96];
    const times = [...new Set(ratios.map((ratio) => Math.min(Math.max(0, video.duration - 0.04), video.duration * ratio)))];
    const bestScores = Object.fromEntries(SCORE_NAMES.map((name) => [name, 0]));
    let sampledFrames = 0;
    let confirmedNsfwFrames = 0;
    let confirmedBodyPartFrames = 0;
    for (const [frameIndex, time] of times.entries()) {
      await seekVideoFrame(video, time);
      let frame;
      try {
        frame = await createImageBitmap(video);
        const result = await classifyBitmap(frame, requestSettings, true, blob.type || "video/mp4", 0, false, frameIndex % 2 === 0);
        sampledFrames++;
        for (const [name, score] of Object.entries(result.scores || {})) {
          bestScores[name] = Math.max(bestScores[name] || 0, score || 0);
        }
        const frameScores = result.scores || {};
        if ((frameScores.NSFW || 0) >= requestSettings.threshold) confirmedNsfwFrames++;
        else confirmedNsfwFrames = 0;
        if (result.exposedPartChecked) {
          if (result.detector === "body-part") confirmedBodyPartFrames++;
          else confirmedBodyPartFrames = 0;
        }
        if (confirmedNsfwFrames >= 2 || confirmedBodyPartFrames >= 2) {
          return { ...result, detector: "image-classifier-video", sampledFrames, confirmedNsfwFrames, confirmedBodyPartFrames };
        }
      } finally {
        frame?.close();
      }
    }
    if (!sampledFrames) throw new Error("No frames could be decoded from the remote video.");
    return {
      blurred: confirmedNsfwFrames >= 2 || confirmedBodyPartFrames >= 2,
      scores: bestScores,
      detector: "image-classifier-video",
      sampledFrames,
      confirmedNsfwFrames,
      confirmedBodyPartFrames,
      mimeType: blob.type || "video/mp4",
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

function classificationCacheKey(message, requestSettings) {
  const imageUrl = message.imageUrl;
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl) || imageUrl.length > 4096 || message.isVideo ||
      message.videoUrl || message.dataUrl || message.captureRect || message.animationFrameIndex !== undefined) {
    return undefined;
  }
  return [
    message.senderTabId || "unknown-tab",
    imageUrl,
    requestSettings.threshold,
    requestSettings.partThreshold,
    Boolean(message.isThumbnail),
  ].join("\n");
}

function readClassificationCache(key) {
  if (!key) return undefined;
  const entry = classificationCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > CLASSIFICATION_CACHE_TTL_MS) {
    classificationCache.delete(key);
    return undefined;
  }
  classificationCache.delete(key);
  classificationCache.set(key, entry);
  return { ...entry.result, ...(entry.result.scores ? { scores: { ...entry.result.scores } } : {}) };
}

function writeClassificationCache(key, result) {
  if (!key || result.error || result.skipped) return;
  classificationCache.delete(key);
  classificationCache.set(key, {
    createdAt: Date.now(),
    result: { ...result, ...(result.scores ? { scores: { ...result.scores } } : {}) },
  });
  while (classificationCache.size > MAX_CLASSIFICATION_CACHE_ENTRIES) {
    classificationCache.delete(classificationCache.keys().next().value);
  }
}

async function withImageLoadSlot(load) {
  if (activeImageLoads >= MAX_PARALLEL_IMAGE_LOADS) {
    await new Promise((resolve) => waitingImageLoads.push(resolve));
  } else {
    activeImageLoads++;
  }
  try {
    return await load();
  } finally {
    const next = waitingImageLoads.shift();
    if (next) next();
    else activeImageLoads--;
  }
}

async function prepareImageClassification(message) {
  const requestSettings = normalizeSettings(message.settings || settings);
  if (!requestSettings.enabled) return { blurred: false, skipped: true };
  const cacheKey = classificationCacheKey(message, requestSettings);
  const cachedResult = readClassificationCache(cacheKey);
  if (cachedResult) return { cachedResult };
  const decoded = await withImageLoadSlot(() => bitmapFromRequest(message));
  return { requestSettings, cacheKey, decoded };
}

async function classify(message, prepared) {
  const requestSettings = prepared?.requestSettings || normalizeSettings(message.settings || settings);
  if (!requestSettings.enabled) return { blurred: false, skipped: true };
  if (prepared?.cachedResult) return prepared.cachedResult;
  const cacheKey = prepared?.cacheKey || classificationCacheKey(message, requestSettings);
  if (!prepared) {
    const cachedResult = readClassificationCache(cacheKey);
    if (cachedResult) return cachedResult;
  }
  let videoUrlError;
  if (message.videoUrl) {
    try {
      const remoteResult = await classifyRemoteVideo(message.videoUrl, requestSettings);
      return { ...remoteResult, videoUrlAttempted: true, remoteVideoAnalyzed: true };
    } catch (error) {
      videoUrlError = error;
    }
  }
  let decoded = prepared?.decoded;
  if (!decoded) {
    try {
      decoded = await bitmapFromRequest(message);
    } catch (error) {
      if (!message.videoUrl) throw error;
      return {
        error: videoUrlError?.message || error?.message || "Video could not be analyzed.",
        videoUrlAttempted: true,
        remoteVideoAnalyzed: false,
      };
    }
  }
  const { bitmap, animatedFrameCount, mimeType, captureMethod } = decoded;
  const captureInfo = captureMethod ? { captureMethod } : {};
  try {
    const result = {
      ...(await classifyBitmap(
        bitmap,
        requestSettings,
        Boolean(message.isVideo),
        mimeType,
        animatedFrameCount,
        Boolean(message.isThumbnail),
        message.runExposedPart !== false,
      )),
      ...captureInfo,
      ...(message.videoUrl ? { videoUrlAttempted: true, remoteVideoAnalyzed: false } : {}),
    };
    writeClassificationCache(cacheKey, result);
    return result;
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "offscreen-prewarm") {
    enqueueWarmup(sendResponse);
    return true;
  }
  if (message?.type === "offscreen-tab-capture-start") {
    startTabCapture(message).then(sendResponse).catch((error) => sendResponse({ error: error?.message || "Tab capture could not start." }));
    return true;
  }
  if (message?.type === "offscreen-tab-capture-stop") {
    stopTabCapture().then(sendResponse).catch((error) => sendResponse({ error: error?.message || "Tab capture could not stop." }));
    return true;
  }
  if (message?.type !== "offscreen-classify") return false;
  // Warm image decode/fetch work overlaps across a small bounded pool while
  // TensorFlow inference itself stays serialized on the one shared model.
  if (!message.isVideo && !message.videoUrl && !message.captureRect) {
    void prepareImageClassification(message)
      .then((prepared) => {
        if (prepared?.cachedResult) sendResponse(prepared.cachedResult);
        else if (prepared?.skipped) sendResponse(prepared);
        else enqueueInference(message, sendResponse, prepared);
      })
      .catch((error) => sendResponse({ error: error?.message || "Image could not be prepared." }));
    return true;
  }
  enqueueInference(message, sendResponse);
  return true;
});

function enqueueInference(message, sendResponse, prepared) {
  const job = { message, sendResponse, prepared };
  if (message.isVideo) {
    // Keep only the newest real-time request while the GPU is busy. Hover
    // previews and GIFs can then run between queued thumbnail jobs without
    // building a stale frame backlog.
    if (pendingRealtimeInference) pendingRealtimeInference.sendResponse({ skipped: true });
    pendingRealtimeInference = job;
  } else {
    normalInferenceQueue.push(job);
  }
  void pumpInferenceQueue();
}

function enqueueWarmup(sendResponse) {
  normalInferenceQueue.unshift({ prewarm: true, sendResponse });
  void pumpInferenceQueue();
}

async function pumpInferenceQueue() {
  if (inferenceRunning) return;
  inferenceRunning = true;
  try {
    while (pendingRealtimeInference || normalInferenceQueue.length) {
      let job;
      if (pendingRealtimeInference && (!normalInferenceQueue.length || !lastWasRealtime)) {
        job = pendingRealtimeInference;
        pendingRealtimeInference = undefined;
      } else {
        job = normalInferenceQueue.shift();
      }
      lastWasRealtime = Boolean(job.message?.isVideo);
      try {
        if (job.prewarm) {
          await warmupNsfwModel();
          job.sendResponse({ ready: true });
        } else {
          job.sendResponse(await classify(job.message, job.prepared));
        }
      } catch (error) {
        job.sendResponse({ error: error?.message || "Classification failed" });
      }
    }
  } finally {
    inferenceRunning = false;
    if (pendingRealtimeInference || normalInferenceQueue.length) void pumpInferenceQueue();
  }
}
