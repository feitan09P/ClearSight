(() => {
  let initialized = false;
  function initialize(initialSettings) {
  if (initialized) return;
  initialized = true;
  const BLUR_CLASS = "clearsight-blurred";
  const MAX_PARALLEL_IMAGE_REQUESTS = 4;
  const BACKGROUND_BLUR_CLASS = "clearsight-background-blurred";
  const READY_MEDIA_CLASS = "clearsight-media-ready";
  const PENDING_MEDIA_CLASS = "clearsight-media-pending";
  const PENDING_BACKGROUND_CLASS = "clearsight-background-pending";
  const PROTECTION_DISABLED_CLASS = "clearsight-protection-disabled";
  const VIDEO_PROTECTION_DISABLED_CLASS = "clearsight-video-protection-disabled";
  const revealedPendingMedia = new WeakSet();
  let checked = new WeakMap();
  const retryState = new WeakMap();
  const activeBlurs = new Set();
  const observedShadowRoots = new WeakSet();
  const videoEventRoots = new WeakSet();
  const observedImages = new WeakSet();
  const deferredImages = new Set();
  const deferredBackgrounds = new Set();
  const backgroundStates = new WeakMap();
  const mediaFilterStates = new WeakMap();
  const imageBlobData = new WeakMap();
  let settings = { enabled: false, threshold: 0.77, partThreshold: 0.61, blurVideos: true, privacyConsent: false };
  settings = { ...settings, ...initialSettings };
  settings.enabled = settings.privacyConsent === true && settings.enabled === true;
  const mediaInferenceQueue = [];
  let mediaInferenceQueueRunning = false;
  let activeMediaInferenceJobs = 0;
  let mediaInferenceQueueSequence = 0;
  let mediaInferenceQueueScheduled = false;
  const videoStates = new WeakMap();
  const videoPosterStates = new WeakMap();
  const pausedVideoStates = new WeakMap();
  const trackedVideos = new Set();
  const gifStates = new WeakMap();
  const trackedGifs = new Set();
  const tabCaptureStickyBlurredVideos = new WeakSet();
  const directlyMaskedVideos = new WeakSet();
  let adultNavigationDetected = false;
  let lastAdultNavigationScanAt = 0;
  const frameWindowElements = new WeakMap();
  const pendingCaptureRectRequests = new Map();
  const pendingCaptureRectForwards = new Map();
  const FRAME_CAPTURE_MESSAGE = "__clearsight_capture_rect_v1";
  const revealTimers = new WeakMap();
  let realtimeInferenceInFlight = false;
  let mediaSamplerTimer;
  let videoCursor = 0;
  let gifCursor = 0;
  let videoSamplesSinceGif = 0;
  let lastScrollAt = 0;
  let scrollIdleTimer;
  let videoCaptureCanvas;
  let videoCaptureContext;
  let videoCaptureSize = "";
  let videoFrameWorker;
  let videoFrameWorkerUnavailable = false;
  let videoFrameRequestId = 0;
  const pendingVideoFrameRequests = new Map();
  let extensionContextInvalidated = false;
  const invalidationCleanups = new Set();
  const MEDIA_SAMPLER_INTERVAL_MS = 200;
  const VIDEO_SAMPLE_INTERVAL_MS = 600;
  const GIF_SAMPLE_INTERVAL_MS = 1000;
  const VIDEO_BLUR_RECHECK_MS = 1000;
  const VIDEO_NSFW_VOTE_COUNT = 2;
  const REALTIME_SAMPLE_INTERVAL_MS = 200;
  const VIDEO_CAPTURE_MAX_EDGE = 512;
  let lastRealtimeInferenceAt = 0;
  const SCROLL_IDLE_MS = 180;
  const IMAGE_MARGIN_PX = 320;
  const BACKGROUND_MARGIN_PX = 160;
  const BACKGROUND_CANDIDATE_SELECTOR = "div,a,span,section,article,li,aside,figure,main,header,footer,nav,button,picture,[role='img'],[style*='background' i],[class*='thumb' i],[class*='advert' i],[class*='banner' i],[class*='creative' i],[class*='preview' i],[class*='ad-' i],[class*='-ad' i],[class~='ad' i],[class~='ads' i],[id*='ad-' i],[id~='ad' i],[data-ad],[data-bg],[data-bg-src],[data-background],[data-background-image],[data-background-src]";
  const LAZY_MEDIA_ATTRIBUTES = [
    "data-src", "data-srcset", "data-lazy-src", "data-lazy-srcset", "data-original", "data-original-src",
    "data-original-srcset", "data-image", "data-image-url", "data-thumb", "data-thumb-url", "data-thumb_url",
    "data-thumbnail", "data-thumbnail-url", "data-poster", "data-poster-url", "data-bg", "data-bg-src",
    "data-background", "data-background-image", "data-background-src",
  ];
  const VIDEO_POSTER_ATTRIBUTES = [
    "data-original", "data-original-src", "data-image", "data-image-url", "data-thumb", "data-thumb-url",
    "data-thumb_url", "data-thumbnail", "data-thumbnail-url", "data-poster", "data-poster-url",
  ];
  const KNOWN_ADULT_HOSTS = [
    "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com",
    "tube8.com", "spankbang.com", "eporner.com", "beeg.com", "tnaflix.com", "brazzers.com",
  ];
  const KNOWN_ADULT_HOST_SET = new Set(KNOWN_ADULT_HOSTS);
  const ADULT_REDIRECT_PARAMETERS = new Set([
    "adurl", "imgrefurl", "imgurl", "mediaurl", "redirect", "redirect_url", "target", "u", "url",
  ]);
  const ADULT_PATH_TOKEN = /(?:^|[._/-])(?:porn(?:hub|stars?)?|porno|xxx|nude|nudity)(?=$|[._/?#-])/i;

  function matchesAdultHost(hostname) {
    for (let candidate = hostname; candidate; ) {
      if (KNOWN_ADULT_HOST_SET.has(candidate)) return true;
      const dot = candidate.indexOf(".");
      if (dot < 0) break;
      candidate = candidate.slice(dot + 1);
    }
    return false;
  }

  function installBlurStyle(root) {
    const style = document.createElement("style");
    const unsafePlaceholder = "url(\"" + chrome.runtime.getURL("assets/unsafe-content.jpeg") + "\")";
    const pendingMediaSelector = root.nodeType === Node.DOCUMENT_NODE
      ? "html:not(." + PROTECTION_DISABLED_CLASS + ") img:not(." + READY_MEDIA_CLASS + "):not(." + BLUR_CLASS + ")," +
        " html:not(." + PROTECTION_DISABLED_CLASS + "):not(." + VIDEO_PROTECTION_DISABLED_CLASS + ")" +
        " video:not(." + READY_MEDIA_CLASS + "):not(." + BLUR_CLASS + ")"
      : "img." + PENDING_MEDIA_CLASS + ":not(." + BLUR_CLASS + "), video." + PENDING_MEDIA_CLASS + ":not(." + BLUR_CLASS + ")," +
        ":host-context(html:not(." + PROTECTION_DISABLED_CLASS + ")) img:not(." + READY_MEDIA_CLASS + "):not(." + BLUR_CLASS + ")," +
        ":host-context(html:not(." + PROTECTION_DISABLED_CLASS + "):not(." + VIDEO_PROTECTION_DISABLED_CLASS + "))" +
        " video:not(." + READY_MEDIA_CLASS + "):not(." + BLUR_CLASS + ")";
    style.textContent = "img." + BLUR_CLASS + ", video." + BLUR_CLASS +
      " { content: " + unsafePlaceholder + " !important; object-fit: cover !important; object-position: center !important; " +
      "visibility: visible !important; filter: none !important; transition: none !important; }" +
      "img." + BLUR_CLASS + " { aspect-ratio: var(--clearsight-original-aspect-ratio, auto) !important; }" +
      pendingMediaSelector + " { filter: blur(40px) !important; transition: none !important; }" +
      "." + PENDING_MEDIA_CLASS + ":not(." + BLUR_CLASS + ") { filter: blur(40px) !important; transition: none !important; }" +
      "." + PENDING_BACKGROUND_CLASS + " { background-image: linear-gradient(#444, #444) !important; }" +
      "." + BACKGROUND_BLUR_CLASS + " { background-color: transparent !important; background-image: none !important; " +
      "isolation: isolate !important; position: var(--clearsight-background-position, relative) !important; }" +
      "." + BACKGROUND_BLUR_CLASS + "::before { content: \"\"; position: absolute; inset: 0; z-index: -1; " +
      "pointer-events: none; border-radius: inherit; background-image: " + unsafePlaceholder + " !important; " +
      "background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; }";
    const target = root.nodeType === Node.DOCUMENT_NODE
      ? (root.head || root.documentElement)
      : (root.head || root);
    if (target) target.append(style);
    else if (root.nodeType === Node.DOCUMENT_NODE) {
      const waitForRoot = new MutationObserver(() => {
        const readyTarget = root.head || root.documentElement;
        if (!readyTarget) return;
        readyTarget.append(style);
        waitForRoot.disconnect();
      });
      waitForRoot.observe(root, { childList: true, subtree: true });
      invalidationCleanups.add(() => waitForRoot.disconnect());
    }
  }

  function markExtensionContextInvalidated() {
    if (extensionContextInvalidated) return;
    extensionContextInvalidated = true;
    collectOpenShadowMedia(document)
      .filter((media) => media.classList.contains(PENDING_MEDIA_CLASS))
      .forEach(blurElement);
    collectOpenShadowElements(document, "." + PENDING_BACKGROUND_CLASS).forEach(blurElement);
    document.querySelectorAll("." + PENDING_MEDIA_CLASS + ", ." + PENDING_BACKGROUND_CLASS).forEach(blurElement);
    setProtectionDisabled(true);
    if (mediaSamplerTimer) clearInterval(mediaSamplerTimer);
    mediaSamplerTimer = undefined;
    trackedVideos.clear();
    trackedGifs.clear();
    for (const pending of pendingVideoFrameRequests.values()) {
      clearTimeout(pending.timeout);
      pending.resolve(undefined);
    }
    pendingVideoFrameRequests.clear();
    for (const cleanup of invalidationCleanups) cleanup();
    invalidationCleanups.clear();
    console.info("[ClearSight] The extension was reloaded or removed. Refresh this tab to resume protection.");
  }

  function isExtensionContextInvalidatedError(error) {
    return /extension context invalidated/i.test(error?.message || String(error || ""));
  }

  async function sendExtensionMessage(message) {
    if (extensionContextInvalidated) return { skipped: true, contextInvalidated: true };
    try {
      if (!chrome?.runtime?.id) {
        markExtensionContextInvalidated();
        return { skipped: true, contextInvalidated: true };
      }
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
        return { skipped: true, contextInvalidated: true };
      }
      throw error;
    }
  }

  function blurElement(element) {
    revealedPendingMedia.delete(element);
    restoreMediaFilter(element);
    element.classList.remove(READY_MEDIA_CLASS);
    element.classList.remove(PENDING_MEDIA_CLASS, PENDING_BACKGROUND_CLASS);
    if (element instanceof HTMLImageElement && element.naturalWidth && element.naturalHeight) {
      element.style.setProperty("--clearsight-original-aspect-ratio", element.naturalWidth + " / " + element.naturalHeight);
    }
    const background = backgroundStates.get(element);
    if (background) {
      element.style.setProperty("--clearsight-background-position", background.position === "static" ? "relative" : background.position);
      element.style.setProperty("--clearsight-background-color", background.color);
      element.style.setProperty("--clearsight-background-image", background.image);
      element.style.setProperty("--clearsight-background-size", background.size);
      element.style.setProperty("--clearsight-background-positioning", background.positioning);
      element.style.setProperty("--clearsight-background-repeat", background.repeat);
      element.style.setProperty("--clearsight-background-origin", background.origin);
      element.style.setProperty("--clearsight-background-clip", background.clip);
      element.classList.add(BACKGROUND_BLUR_CLASS);
    } else {
      element.classList.add(BLUR_CLASS);
    }
    activeBlurs.add(element);
  }

  function unblurElement(element) {
    element.classList.remove(BLUR_CLASS);
    element.classList.remove(PENDING_MEDIA_CLASS, PENDING_BACKGROUND_CLASS);
    restoreMediaFilter(element);
    if (element instanceof HTMLImageElement) element.style.removeProperty("--clearsight-original-aspect-ratio");
    if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement) element.classList.add(READY_MEDIA_CLASS);
    if (backgroundStates.has(element)) {
      element.classList.remove(BACKGROUND_BLUR_CLASS);
      for (const property of [
        "--clearsight-background-position", "--clearsight-background-color", "--clearsight-background-image",
        "--clearsight-background-size", "--clearsight-background-positioning", "--clearsight-background-repeat",
        "--clearsight-background-origin", "--clearsight-background-clip",
      ]) element.style.removeProperty(property);
    }
    activeBlurs.delete(element);
  }

  function clearAllBlurs() {
    activeBlurs.forEach(unblurElement);
    const selector = "." + BLUR_CLASS + ", ." + BACKGROUND_BLUR_CLASS + ", ." + PENDING_MEDIA_CLASS + ", ." + PENDING_BACKGROUND_CLASS;
    collectOpenShadowElements(document, selector).forEach(unblurElement);
    document.querySelectorAll(selector).forEach(unblurElement);
  }

  function collectOpenShadowMedia(root, media = []) {
    root.querySelectorAll?.("img, video").forEach((element) => media.push(element));
    root.querySelectorAll?.("*").forEach((host) => {
      if (host.shadowRoot) collectOpenShadowMedia(host.shadowRoot, media);
    });
    return media;
  }

  function collectOpenShadowElements(root, selector, elements = []) {
    root.querySelectorAll?.(selector).forEach((element) => elements.push(element));
    root.querySelectorAll?.("*").forEach((host) => {
      if (host.shadowRoot) collectOpenShadowElements(host.shadowRoot, selector, elements);
    });
    return elements;
  }

  function markMediaSafe(element) {
    revealedPendingMedia.delete(element);
    unblurElement(element);
  }

  function markMediaPending(element) {
    if (!settings.enabled || extensionContextInvalidated || revealTimers.has(element) ||
        !(element instanceof HTMLImageElement || element instanceof HTMLVideoElement) ||
        (element instanceof HTMLVideoElement && !settings.blurVideos) || element.classList.contains(BLUR_CLASS)) return;
    element.classList.remove(READY_MEDIA_CLASS);
    element.classList.add(PENDING_MEDIA_CLASS);
    if (!mediaFilterStates.has(element)) {
      mediaFilterStates.set(element, {
        value: element.style.getPropertyValue("filter"),
        priority: element.style.getPropertyPriority("filter"),
      });
    }
    element.style.setProperty("filter", "blur(40px)", "important");
  }

  function restoreMediaFilter(element) {
    const previous = mediaFilterStates.get(element);
    if (!previous || !(element instanceof HTMLImageElement || element instanceof HTMLVideoElement)) return;
    if (previous.value) element.style.setProperty("filter", previous.value, previous.priority);
    else element.style.removeProperty("filter");
    mediaFilterStates.delete(element);
  }

  function markBackgroundPending(element, background) {
    if (!settings.enabled || extensionContextInvalidated || revealTimers.has(element)) return;
    backgroundStates.set(element, background);
    element.classList.add(PENDING_BACKGROUND_CLASS);
  }

  function setProtectionDisabled(disabled) {
    const apply = () => {
      const root = document.documentElement;
      if (!root) return false;
      const wasDisabled = root.classList.contains(PROTECTION_DISABLED_CLASS);
      const wasVideoDisabled = root.classList.contains(VIDEO_PROTECTION_DISABLED_CLASS);
      root.classList.toggle(PROTECTION_DISABLED_CLASS, disabled);
      root.classList.toggle(VIDEO_PROTECTION_DISABLED_CLASS, disabled || !settings.blurVideos);
      collectOpenShadowMedia(document).forEach((media) => {
        if (disabled || (media instanceof HTMLVideoElement && !settings.blurVideos)) {
          media.classList.remove(PENDING_MEDIA_CLASS);
          media.classList.add(READY_MEDIA_CLASS);
          restoreMediaFilter(media);
        } else if (wasDisabled || (media instanceof HTMLVideoElement && wasVideoDisabled)) {
          media.classList.remove(READY_MEDIA_CLASS);
          markMediaPending(media);
        }
      });
      if (disabled) {
        collectOpenShadowElements(document, "." + PENDING_BACKGROUND_CLASS).forEach(unblurElement);
        document.querySelectorAll("." + PENDING_BACKGROUND_CLASS).forEach(unblurElement);
      }
      return true;
    };
    if (apply()) return;
    const waitForRoot = new MutationObserver(() => {
      if (apply()) waitForRoot.disconnect();
    });
    waitForRoot.observe(document, { childList: true, subtree: true });
    invalidationCleanups.add(() => waitForRoot.disconnect());
  }

  if (!settings.enabled && document.documentElement) {
    document.documentElement.classList.add(PROTECTION_DISABLED_CLASS, VIDEO_PROTECTION_DISABLED_CLASS);
  }
  installBlurStyle(document);

  function revealForAwhile(element) {
    const wasPending = element.classList.contains(PENDING_MEDIA_CLASS) ||
      element.classList.contains(PENDING_BACKGROUND_CLASS) ||
      ((element instanceof HTMLImageElement || element instanceof HTMLVideoElement) &&
        !element.classList.contains(READY_MEDIA_CLASS) && !element.classList.contains(BLUR_CLASS));
    if (wasPending) revealedPendingMedia.add(element);
    unblurElement(element);
    clearTimeout(revealTimers.get(element));
    revealTimers.set(element, setTimeout(() => {
      revealTimers.delete(element);
      if (element.isConnected && settings.enabled && (!wasPending || revealedPendingMedia.has(element))) {
        blurElement(element);
      }
    }, 15000));
  }

  document.addEventListener("click", (event) => {
    if (!settings.enabled) return;
    const element = event.composedPath?.().find((target) =>
      target instanceof Element && (target.classList.contains(BLUR_CLASS) || target.classList.contains(BACKGROUND_BLUR_CLASS) ||
        target.classList.contains(PENDING_MEDIA_CLASS) || target.classList.contains(PENDING_BACKGROUND_CLASS) ||
        ((target instanceof HTMLImageElement || target instanceof HTMLVideoElement) &&
          !target.classList.contains(READY_MEDIA_CLASS))))
      || event.target?.closest?.("img." + BLUR_CLASS + ", video." + BLUR_CLASS + ", ." + BACKGROUND_BLUR_CLASS +
        ", img." + PENDING_MEDIA_CLASS + ", video." + PENDING_MEDIA_CLASS + ", ." + PENDING_BACKGROUND_CLASS);
    if (element) revealForAwhile(element);
  }, true);

  function ensureVideoFrameWorker() {
    if (videoFrameWorker) return videoFrameWorker;
    if (videoFrameWorkerUnavailable || typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return undefined;
    try {
      const worker = new Worker(chrome.runtime.getURL("video-frame-worker.js"));
      worker.onmessage = ({ data }) => {
        const pending = pendingVideoFrameRequests.get(data?.requestId);
        if (!pending) return;
        clearTimeout(pending.timeout);
        pendingVideoFrameRequests.delete(data.requestId);
        pending.resolve({ dataUrl: data.dataUrl, securityError: data.errorName === "SecurityError" });
      };
      const failWorker = () => {
        worker.terminate();
        if (videoFrameWorker === worker) videoFrameWorker = undefined;
        videoFrameWorkerUnavailable = true;
        for (const [requestId, pending] of pendingVideoFrameRequests) {
          clearTimeout(pending.timeout);
          pending.resolve(undefined);
          pendingVideoFrameRequests.delete(requestId);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        failWorker();
      };
      worker.onmessageerror = failWorker;
      videoFrameWorker = worker;
      return worker;
    } catch {
      videoFrameWorkerUnavailable = true;
      return undefined;
    }
  }

  async function captureVideoFrameInWorker(video, width, height) {
    const worker = ensureVideoFrameWorker();
    if (!worker || typeof createImageBitmap !== "function") return undefined;
    let bitmap;
    try {
      bitmap = await createImageBitmap(video, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      });
    } catch {
      return undefined;
    }
    const requestId = ++videoFrameRequestId;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingVideoFrameRequests.delete(requestId);
        resolve(undefined);
      }, 2000);
      pendingVideoFrameRequests.set(requestId, { resolve, timeout });
      try {
        worker.postMessage({ requestId, bitmap }, [bitmap]);
      } catch {
        clearTimeout(timeout);
        pendingVideoFrameRequests.delete(requestId);
        bitmap.close();
        resolve(undefined);
      }
    });
  }

  window.addEventListener("pagehide", () => {
    videoFrameWorker?.terminate();
    videoFrameWorker = undefined;
    for (const [requestId, pending] of pendingVideoFrameRequests) {
      clearTimeout(pending.timeout);
      pending.resolve(undefined);
      pendingVideoFrameRequests.delete(requestId);
    }
  }, { once: true });

  async function captureVideoFrame(video) {
    if (!video.videoWidth || !video.videoHeight) return undefined;
    const scale = Math.min(1, VIDEO_CAPTURE_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    try {
      const workerResult = await captureVideoFrameInWorker(video, width, height);
      if (workerResult?.dataUrl) return workerResult.dataUrl;
      if (workerResult?.securityError) return undefined;
    } catch {
      // Fall through to the compatible page-canvas capture path below.
    }
    const size = width + "x" + height;
    try {
      if (!videoCaptureCanvas) videoCaptureCanvas = document.createElement("canvas");
      if (videoCaptureSize !== size) {
        videoCaptureCanvas.width = width;
        videoCaptureCanvas.height = height;
        videoCaptureContext = videoCaptureCanvas.getContext("2d", { alpha: false });
        videoCaptureSize = size;
      }
      if (!videoCaptureContext) return undefined;
      videoCaptureContext.drawImage(video, 0, 0, width, height);
      const blob = await new Promise((resolve) => videoCaptureCanvas.toBlob(resolve, "image/jpeg", 0.75));
      if (!blob) return undefined;
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }

  function captureImageFrame(image) {
    if (!image.naturalWidth || !image.naturalHeight) return undefined;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    try {
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return undefined;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.78);
    } catch {
      return undefined;
    }
  }

  async function imageBlobDataUrl(image, source) {
    const existing = imageBlobData.get(image);
    if (existing?.source === source) return existing.promise;
    const promise = readBlobUrlAsDataUrl(source);
    imageBlobData.set(image, { source, promise });
    try {
      return await promise;
    } catch (error) {
      if (imageBlobData.get(image)?.source === source) imageBlobData.delete(image);
      throw error;
    }
  }

  async function classify(element, source, options = {}) {
    let dataUrl;
    let imageUrl;
    let videoUrl;
    let animationFrameIndex;
    let captureRect;
    if (element instanceof HTMLImageElement) {
      if (options.renderedFrame) {
        dataUrl = captureImageFrame(element);
        if (!dataUrl) throw new Error("The current animated image frame cannot be read.");
      } else if (source.startsWith("data:image/")) dataUrl = source;
      else if (source.startsWith("blob:")) dataUrl = await imageBlobDataUrl(element, source);
      else imageUrl = source;
      animationFrameIndex = options.animationFrameIndex;
    }
    if (element instanceof HTMLVideoElement) {
      dataUrl = await captureVideoFrame(element);
      if (!dataUrl) {
        if (options.includeRemoteVideo) {
          const mediaSource = element.currentSrc || element.src;
          if (isDownloadableVideoUrl(mediaSource)) videoUrl = mediaSource;
        }
        captureRect = await captureRectForVideo(element);
        if (!captureRect && !videoUrl) return { error: "This video is inside a frame whose position cannot be mapped for tab capture." };
      }
    }
    return sendExtensionMessage({
      type: "classify-content",
      imageUrl,
      dataUrl,
      videoUrl,
      isVideo: element instanceof HTMLVideoElement || Boolean(options.realtime),
      isThumbnail: !(element instanceof HTMLVideoElement) && isThumbnailLike(element),
      runExposedPart: options.runExposedPart,
      captureRect,
      animationFrameIndex,
    });
  }

  function isDownloadableVideoUrl(source) {
    try {
      const url = new URL(source, document.baseURI);
      return /^https?:$/.test(url.protocol) && /\.(?:mp4|m4v|webm)$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function normalizeImageSource(raw) {
    const value = String(raw || "").trim().replace(/^url\(["']?|["']?\)$/gi, "");
    if (!value || value.startsWith("#")) return undefined;
    try {
      const url = new URL(value, document.baseURI);
      return /^(https?:|data:image\/|blob:)/i.test(url.href) ? url.href : undefined;
    } catch {
      return undefined;
    }
  }

  function isThumbnailLike(element) {
    if (!(element instanceof Element)) return false;
    const labels = [element.id, element.getAttribute("class"), element.getAttribute("role"),
      element.getAttribute("aria-label"), element.getAttribute("alt")].filter(Boolean).join(" ");
    if (/(?:thumb|preview|poster|advert|banner|creative|(?:^|[\s_-])ads?(?:$|[\s_-]))/i.test(labels)) return true;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.width <= 520 && rect.height <= 360;
  }

  function isPornhubVideoThumbnail(element) {
    const hostname = location.hostname.toLowerCase();
    if (hostname !== "pornhub.com" && !hostname.endsWith(".pornhub.com")) return false;
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 22) return false;
    if (element.closest("a[href*='view_video.php'], a[href*='viewkey=']")) return true;
    for (let ancestor = element, depth = 0; ancestor && depth < 5; ancestor = ancestor.parentElement, depth++) {
      const labels = [ancestor.id, ancestor.getAttribute("class"), ancestor.getAttribute("data-testid"),
        ancestor.getAttribute("data-type")].filter(Boolean).join(" ").toLowerCase();
      if (/(?:video.?thumb|thumb.?video|related.?video|recommended.?video)/i.test(labels)) return true;
    }
    // Some pages render recommendations as plain lazy images with no useful
    // class or link metadata. On Pornhub, treat landscape media tiles as
    // thumbnails so small previews do not depend on the classifier score.
    const aspectRatio = rect.width / rect.height;
    return rect.width <= 600 && rect.height <= 400 && aspectRatio >= 1.2 && aspectRatio <= 3.4;
  }

  function isDirectAdultContentUrl(source) {
    if (!source) return false;
    return isDirectAdultContentUrlAtDepth(source, 0);
  }

  function isDirectAdultContentUrlAtDepth(source, depth) {
    try {
      const url = new URL(source, document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return false;
      const hostname = url.hostname.toLowerCase();
      if (matchesAdultHost(hostname)) return true;
      if (ADULT_PATH_TOKEN.test(hostname + url.pathname)) return true;
      // Search engines wrap the result destination in parameters such as
      // imgrefurl, imgurl, or url while serving the thumbnail from their CDN.
      // Follow only URL-valued redirect parameters, never search-query text.
      if (depth >= 2) return false;
      for (const [name, value] of url.searchParams) {
        if (!ADULT_REDIRECT_PARAMETERS.has(name.toLowerCase())) continue;
        try {
          const nestedUrl = new URL(value);
          if (/^https?:$/.test(nestedUrl.protocol) &&
              isDirectAdultContentUrlAtDepth(nestedUrl.href, depth + 1)) return true;
        } catch {
          // Ignore non-URL values and keep checking other redirect fields.
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function isDirectAdultContentPage() {
    if (isDirectAdultContentUrl(location.href)) return true;
    if (adultNavigationDetected) return true;
    if (Date.now() - lastAdultNavigationScanAt < 1000) return false;
    lastAdultNavigationScanAt = Date.now();
    // Some adult sites use a neutral branded domain and neutral media URLs.
    // A Pornstars navigation item is a strong page-level signal for those sites.
    const navigationText = [...document.querySelectorAll("nav, header, [role='navigation']")]
      .slice(0, 4)
      .map((navigation) => navigation.innerText || navigation.textContent || "")
      .join(" ")
      .slice(0, 6000);
    adultNavigationDetected = /\bpornstars?\b|\bporn(?:ographic)?\s+(?:videos?|content)\b/i.test(navigationText);
    return adultNavigationDetected;
  }

  function shouldDirectlyMaskAdultMedia(sources = []) {
    return isDirectAdultContentPage() || sources.some(isDirectAdultContentUrl);
  }

  function isKnownAdCreative(source) {
    if (!source) return false;
    try {
      const url = new URL(source, document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return false;
      const hostname = url.hostname.toLowerCase();
      if ((hostname === "trafficjunky.net" || hostname.endsWith(".trafficjunky.net")) &&
          /\/video\/.+\.(?:mp4|m4v|webm)$/i.test(url.pathname)) return true;
      return (hostname === "adtng.com" || hostname.endsWith(".adtng.com")) &&
        /\/creatives\//i.test(url.pathname) && /\.(?:png|jpe?g|gif|webp|avif|mp4|m4v|webm)$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function updateDirectVideoMask(video) {
    const sourceElements = [...video.querySelectorAll("source")];
    const sources = [video.currentSrc, video.src, video.getAttribute("data-src"), video.getAttribute("data-lazy-src"),
      video.getAttribute("data-original"), video.getAttribute("data-original-src"), video.poster,
      ...sourceElements.flatMap((source) => [source.src, source.getAttribute("data-src"), source.getAttribute("data-lazy-src"),
        source.getAttribute("data-original"), source.getAttribute("data-original-src")])];
    const isAdCreative = sources.some(isKnownAdCreative);
    const isAdultContent = shouldDirectlyMaskAdultMedia(sources);
    if (isAdCreative || isAdultContent) {
      directlyMaskedVideos.add(video);
      if (!revealTimers.has(video)) {
        blurElement(video);
        video.title = isAdultContent
          ? "ClearSight masked media from an explicit-content page. Click to reveal for 15 seconds."
          : "ClearSight masked this ad media. Click to reveal for 15 seconds.";
      }
    } else if (directlyMaskedVideos.delete(video)) {
      unblurElement(video);
      markMediaPending(video);
    }
    return isAdCreative || isAdultContent;
  }

  function addSrcsetSources(target, sources) {
    if (!(target instanceof Element)) return;
    for (const attribute of ["srcset", "data-srcset", "data-lazy-srcset", "data-original-srcset"]) {
      const value = target.getAttribute(attribute);
      if (!value) continue;
      for (const candidate of value.split(",")) {
        const source = normalizeImageSource(candidate.trim().split(/\s+/)[0]);
        if (source) sources.push(source);
      }
    }
  }

  function imageSources(image) {
    const sources = [image.currentSrc, image.getAttribute("src")];
    for (let element = image, depth = 0; element && depth < 5; element = element.parentElement, depth++) {
      if (element !== image && (element.querySelectorAll?.("img").length || 0) > 1) break;
      for (const attribute of LAZY_MEDIA_ATTRIBUTES) {
        if (attribute.endsWith("srcset")) continue;
        const source = normalizeImageSource(element.getAttribute(attribute));
        if (source) sources.push(source);
      }
      addSrcsetSources(element, sources);
    }
    const picture = image.closest("picture");
    picture?.querySelectorAll("source").forEach((source) => {
      addSrcsetSources(source, sources);
      for (const attribute of LAZY_MEDIA_ATTRIBUTES) {
        if (attribute.endsWith("srcset")) continue;
        const candidate = normalizeImageSource(source.getAttribute(attribute));
        if (candidate) sources.push(candidate);
      }
    });
    return [...new Set(sources.map(normalizeImageSource).filter(Boolean))].slice(0, 6);
  }

  function lazyImageSources(image) {
    const sources = [];
    const addLazyAttributes = (element) => {
      if (!(element instanceof Element)) return;
      for (const attribute of [
        "data-src", "data-srcset", "data-lazy-src", "data-lazy-srcset", "data-original",
        "data-original-src", "data-original-srcset", "data-image", "data-image-url",
        "data-thumb", "data-thumb-url", "data-thumb_url", "data-thumbnail", "data-thumbnail-url",
      ]) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        if (attribute.endsWith("srcset")) addSrcsetSources(element, sources);
        else {
          const source = normalizeImageSource(value);
          if (source) sources.push(source);
        }
      }
    };

    // The image itself and its <picture> sources are reliable alternates for
    // this exact image. Some lazy loaders put the URL on a small wrapper, so
    // inspect only nearby ancestors that contain no other images.
    addLazyAttributes(image);
    image.closest("picture")?.querySelectorAll("source").forEach(addLazyAttributes);
    for (let ancestor = image.parentElement, depth = 0; ancestor && depth < 4; ancestor = ancestor.parentElement, depth++) {
      if ((ancestor.querySelectorAll?.("img").length || 0) > 1) break;
      addLazyAttributes(ancestor);
    }
    return [...new Set(sources.map(normalizeImageSource).filter(Boolean))].slice(0, 5);
  }

  function mediaContextUrls(element) {
    const urls = [];
    const add = (value) => {
      const url = normalizeImageSource(value);
      if (url) urls.push(url);
    };
    const enclosingLink = element.closest?.("a[href]");
    if (enclosingLink) add(enclosingLink.href);

    // Some image search layouts put the image and its result link in separate
    // anchors inside one result card. Use the nearest small link-containing
    // ancestor, rather than scanning the whole results grid.
    for (let ancestor = element.parentElement, depth = 0; ancestor && depth < 4; ancestor = ancestor.parentElement, depth++) {
      const links = ancestor.querySelectorAll?.("a[href]");
      const images = ancestor.querySelectorAll?.("img");
      if ((links?.length || 0) > 6 || (images?.length || 0) > 1) break;
      for (const attribute of ["data-href", "data-lpage", "data-url", "data-destination-url"]) {
        add(ancestor.getAttribute(attribute));
      }
      if (links?.length) {
        for (const link of links) add(link.href);
        break;
      }
    }
    return [...new Set(urls)];
  }

  function imageSourcesKey(image) {
    return [...imageSources(image), ...lazyImageSources(image), ...mediaContextUrls(image)].join("\n");
  }

  async function captureRectForVideo(video) {
    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || innerWidth <= 0 || innerHeight <= 0) return undefined;
    const localRect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
    if (window === window.top) return localRect;
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingCaptureRectRequests.delete(id);
        resolve(undefined);
      }, 1800);
      pendingCaptureRectRequests.set(id, { resolve, timeout });
      window.parent.postMessage({
        type: FRAME_CAPTURE_MESSAGE,
        kind: "request",
        id,
        rect: localRect,
      }, "*");
    });
  }

  function findChildFrame(source) {
    const cached = frameWindowElements.get(source);
    if (cached?.isConnected && cached.contentWindow === source) return cached;
    const roots = [document];
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index];
      for (const frame of root.querySelectorAll("iframe,frame")) {
        if (frame.contentWindow === source) {
          frameWindowElements.set(source, frame);
          return frame;
        }
      }
      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    return undefined;
  }

  function mapChildRectToThisViewport(frame, rect) {
    const frameRect = frame.getBoundingClientRect();
    const scaleX = frame.offsetWidth > 0 ? frameRect.width / frame.offsetWidth : 1;
    const scaleY = frame.offsetHeight > 0 ? frameRect.height / frame.offsetHeight : 1;
    const style = getComputedStyle(frame);
    const borderLeft = (Number.parseFloat(style.borderLeftWidth) || 0) * scaleX;
    const borderTop = (Number.parseFloat(style.borderTopWidth) || 0) * scaleY;
    const childScaleX = rect.viewportWidth > 0 ? (frame.clientWidth * scaleX) / rect.viewportWidth : 1;
    const childScaleY = rect.viewportHeight > 0 ? (frame.clientHeight * scaleY) / rect.viewportHeight : 1;
    return {
      x: frameRect.left + borderLeft + rect.x * childScaleX,
      y: frameRect.top + borderTop + rect.y * childScaleY,
      width: rect.width * childScaleX,
      height: rect.height * childScaleY,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type !== FRAME_CAPTURE_MESSAGE) return;
    if (message.kind === "response") {
      const pending = pendingCaptureRectRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingCaptureRectRequests.delete(message.id);
        pending.resolve(message.rect);
        return;
      }
      const forward = pendingCaptureRectForwards.get(message.id);
      if (forward) {
        clearTimeout(forward.timeout);
        pendingCaptureRectForwards.delete(message.id);
        forward.child.postMessage(message, "*");
      }
      return;
    }
    if (message.kind !== "request" || !event.source || !message.rect) return;
    const frame = findChildFrame(event.source);
    if (!frame) return;
    const mappedRect = mapChildRectToThisViewport(frame, message.rect);
    if (window === window.top) {
      event.source.postMessage({ type: FRAME_CAPTURE_MESSAGE, kind: "response", id: message.id, rect: mappedRect }, "*");
      return;
    }
    const timeout = setTimeout(() => pendingCaptureRectForwards.delete(message.id), 1800);
    pendingCaptureRectForwards.set(message.id, { child: event.source, timeout });
    window.parent.postMessage({ ...message, rect: mappedRect }, "*");
  });

  async function classifyBackgroundSource(source, isThumbnail = false) {
    let dataUrl;
    let imageUrl;
    if (source.startsWith("data:image/")) dataUrl = source;
    else if (source.startsWith("blob:")) dataUrl = await readBlobUrlAsDataUrl(source);
    else imageUrl = source;
    return sendExtensionMessage({ type: "classify-content", imageUrl, dataUrl, isVideo: false, isThumbnail });
  }

  async function readBlobUrlAsDataUrl(source) {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Image request failed (" + response.status + ").");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > 12 * 1024 * 1024) {
      throw new Error("Unsupported or oversized image.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not read image data."));
      reader.readAsDataURL(blob);
    });
  }

  function queueImage(image) {
    const allSources = imageSources(image);
    const lazySources = lazyImageSources(image);
    const contextUrls = mediaContextUrls(image);
    const source = [...allSources, ...lazySources, ...contextUrls].join("\n");
    if (extensionContextInvalidated || !settings.enabled) return;
    if (!allSources.length) {
      markMediaSafe(image);
      return;
    }
    const candidateSources = [...new Set([...allSources, ...lazySources])];
    const isAdultContent = shouldDirectlyMaskAdultMedia([...candidateSources, ...contextUrls]);
    if (checked.get(image) !== source) markMediaPending(image);
    if (isAdultContent || isPornhubVideoThumbnail(image) || candidateSources.some(isKnownAdCreative)) {
      checked.set(image, source);
      if (!revealTimers.has(image)) {
        blurElement(image);
        image.title = isAdultContent
          ? "ClearSight masked this media using its page, source, or result link. Click to reveal for 15 seconds."
          : isPornhubVideoThumbnail(image)
          ? "ClearSight masked this video thumbnail. Click to reveal for 15 seconds."
          : "ClearSight masked this ad creative. Click to reveal for 15 seconds.";
      }
      return;
    }
    const displayedSource = normalizeImageSource(image.currentSrc || image.getAttribute("src"));
    const hasFallbackSource = candidateSources.some((candidate) => candidate !== displayedSource);
    if ((image.naturalWidth < 48 || image.naturalHeight < 48) && !hasFallbackSource) {
      if (image.complete) markMediaSafe(image);
      return;
    }
    const sources = image.naturalWidth >= 48 && image.naturalHeight >= 48
      ? [...new Set([displayedSource, image.getAttribute("src"), ...lazySources]
        .map(normalizeImageSource).filter(Boolean))].slice(0, 6)
      : candidateSources;
    if (checked.get(image) === source) return;
    checked.set(image, source);
    enqueueMediaInference(image, "image", async () => {
      if (extensionContextInvalidated || !image.isConnected || !settings.enabled) {
        forgetCheckedSource(image, source);
        return;
      }
      // Classify on-screen images immediately. Keep nearby off-screen work
      // deferred during active scrolling so it does not create a long backlog.
      if (isScrollSettling() && !isVisible(image)) {
        forgetCheckedSource(image, source);
        deferredImages.add(image);
        return;
      }
      if (!isNearViewport(image, IMAGE_MARGIN_PX)) {
        forgetCheckedSource(image, source);
        intersection.observe(image);
        return;
      }
      if (imageSourcesKey(image) !== source) {
        forgetCheckedSource(image, source);
        queueImage(image);
        return;
      }
      try {
        let result;
        let sourceError;
        for (const candidateSource of sources) {
          try {
            const candidate = await classify(image, candidateSource);
            if (candidate?.blurred) {
              result = candidate;
              break;
            }
            if (candidate?.error) sourceError = candidate;
            else if (!result) result = candidate;
          } catch (error) {
            sourceError = { error: error?.message || "Image source could not be analyzed." };
          }
        }
        if (!result && sourceError) result = sourceError;
        if (result?.contextInvalidated || extensionContextInvalidated) return;
        if (!image.isConnected || !settings.enabled || imageSourcesKey(image) !== source) {
          forgetCheckedSource(image, source);
          if (image.isConnected && settings.enabled) queueImage(image);
          return;
        }
        if (!result || result.error) {
          forgetCheckedSource(image, source);
          scheduleImageRetry(image, source, result?.error);
          return;
        }
        retryState.delete(image);
        if (result?.blurred && settings.enabled && image.isConnected) {
          blurElement(image);
          image.title = "ClearSight blurred this image. Click to reveal for 15 seconds.";
        } else {
          markMediaSafe(image);
        }
        if (result.mimeType === "image/gif" || result.animatedFrameCount > 1 || sources.some((candidate) => /\.gif(?:$|[?#])/i.test(candidate))) {
          startGif(image, image.currentSrc || image.src, Number(result.animatedFrameCount) || 0);
        } else {
          stopGif(image);
        }
      } catch (error) {
        forgetCheckedSource(image, source);
        scheduleImageRetry(image, source, error);
      }
    }, () => {
      forgetCheckedSource(image, source);
      scheduleImageRetry(image, source, new Error("Image classification did not complete."));
    });
  }

  function forgetCheckedSource(image, source) {
    if (checked.get(image) === source) checked.delete(image);
  }

  function scheduleImageRetry(image, source, error) {
    const previous = retryState.get(image);
    const state = previous?.source === source ? previous : { source, attempts: 0 };
    if (state.attempts >= 2) {
      if (!state.errorReported) {
        state.errorReported = true;
        console.warn("[ClearSight] Image could not be classified after retries; it remains covered:",
          error?.message || error || "Unknown classification error.");
      }
      return;
    }
    const delays = [1200, 4000];
    const delay = delays[state.attempts++];
    retryState.set(image, state);
    setTimeout(() => {
      if (!image.isConnected || !settings.enabled) return;
      if (imageSourcesKey(image) !== source) {
        retryState.delete(image);
        queueImage(image);
        return;
      }
      queueImage(image);
    }, delay);
  }

  function readBackground(element) {
    if (!(element instanceof HTMLElement) || element instanceof HTMLImageElement ||
        element instanceof HTMLVideoElement || element === document.body || element === document.documentElement) return null;
    const style = getComputedStyle(element);
    const backgroundAttributes = ["data-bg", "data-bg-src", "data-background", "data-background-image", "data-background-src"];
    const imageValues = [
      { value: style.backgroundImage, allowDirectUrl: false },
      ...backgroundAttributes.map((attribute) => element.getAttribute(attribute))
        .filter(Boolean).map((value) => ({ value, allowDirectUrl: true })),
    ];
    const image = imageValues.map(({ value }) => value).join(" | ");
    const urls = [];
    const matcher = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
    for (const { value, allowDirectUrl } of imageValues) {
      matcher.lastIndex = 0;
      let match;
      let foundCssUrl = false;
      while ((match = matcher.exec(value))) {
        foundCssUrl = true;
        const source = normalizeImageSource(match[1] ?? match[2] ?? match[3]);
        if (source) urls.push(source);
      }
      if (!foundCssUrl && allowDirectUrl && /^(?:https?:|data:image\/|blob:|\/|\.\.?\/|[^\s]+\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$)/i.test(value.trim())) {
        const source = normalizeImageSource(value);
        if (source) urls.push(source);
      }
    }
    if (!urls.length) return null;
    return {
      image,
      urls: [...new Set(urls)],
      color: style.backgroundColor,
      size: style.backgroundSize,
      positioning: style.backgroundPosition,
      repeat: style.backgroundRepeat,
      origin: style.backgroundOrigin,
      clip: style.backgroundClip,
      position: style.position,
    };
  }

  function queueBackground(element) {
    const background = readBackground(element);
    if (!background) {
      if (element.classList.contains(PENDING_BACKGROUND_CLASS) || element.classList.contains(BACKGROUND_BLUR_CLASS)) {
        markMediaSafe(element);
      }
      return;
    }
    if (extensionContextInvalidated || !settings.enabled) return;
    const contextUrls = mediaContextUrls(element);
    const source = "background:" + background.image + "\n" + contextUrls.join("\n");
    if (checked.get(element) !== source) markBackgroundPending(element, background);
    const isAdultContent = shouldDirectlyMaskAdultMedia([...background.urls, ...contextUrls]);
    if (isAdultContent || isPornhubVideoThumbnail(element) || background.urls.some(isKnownAdCreative)) {
      checked.set(element, source);
      backgroundStates.set(element, background);
      if (!revealTimers.has(element)) {
        blurElement(element);
        element.title = isAdultContent
          ? "ClearSight masked this media using its page, source, or result link. Click to reveal for 15 seconds."
          : isPornhubVideoThumbnail(element)
          ? "ClearSight masked this video thumbnail. Click to reveal for 15 seconds."
          : "ClearSight masked this ad creative. Click to reveal for 15 seconds.";
      }
      return;
    }
    if (checked.get(element) === source) return;
    checked.set(element, source);
    enqueueMediaInference(element, "background", async () => {
      if (extensionContextInvalidated || !element.isConnected || !settings.enabled) {
        forgetCheckedSource(element, source);
        return;
      }
      if (isScrollSettling() && !isVisible(element)) {
        forgetCheckedSource(element, source);
        deferredBackgrounds.add(element);
        return;
      }
      if (!isNearViewport(element, BACKGROUND_MARGIN_PX)) {
        forgetCheckedSource(element, source);
        backgroundIntersection.observe(element);
        return;
      }
      const currentBackground = readBackground(element);
      if (!currentBackground || currentBackground.image !== background.image) {
        forgetCheckedSource(element, source);
        queueBackground(element);
        return;
      }
      try {
        let result;
        let sourceError;
        for (const url of background.urls) {
          try {
            const candidate = await classifyBackgroundSource(url, isThumbnailLike(element));
            if (candidate?.blurred) {
              result = candidate;
              break;
            }
            if (candidate?.error) sourceError = candidate;
            else if (!result) result = candidate;
          } catch (error) {
            sourceError = { error: error?.message || "Background image could not be read." };
          }
        }
        if (extensionContextInvalidated) return;
        if (!result?.blurred && sourceError) result = sourceError;
        if (!element.isConnected || !settings.enabled || readBackground(element)?.image !== background.image) {
          forgetCheckedSource(element, source);
          if (element.isConnected && settings.enabled) queueBackground(element);
          return;
        }
        if (!result || result.error) {
          forgetCheckedSource(element, source);
          scheduleBackgroundRetry(element, source);
          return;
        }
        retryState.delete(element);
        if (result.blurred) {
          backgroundStates.set(element, background);
          blurElement(element);
          element.title = "ClearSight blurred this background image. Click to reveal for 15 seconds.";
        } else {
          markMediaSafe(element);
        }
      } catch {
        forgetCheckedSource(element, source);
        scheduleBackgroundRetry(element, source);
      }
    }, () => {
      forgetCheckedSource(element, source);
      scheduleBackgroundRetry(element, source);
    });
  }

  function scheduleBackgroundRetry(element, source) {
    const previous = retryState.get(element);
    const state = previous?.source === source ? previous : { source, attempts: 0 };
    if (state.attempts >= 2) return;
    const delay = [1200, 4000][state.attempts++];
    retryState.set(element, state);
    setTimeout(() => {
      if (!element.isConnected || !settings.enabled) return;
      if ("background:" + (readBackground(element)?.image || "") !== source) {
        retryState.delete(element);
        queueBackground(element);
        return;
      }
      queueBackground(element);
    }, delay);
  }

  function isVisible(video) {
    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < innerHeight && rect.left < innerWidth;
  }

  function isScrollSettling() {
    return lastScrollAt > 0 && performance.now() - lastScrollAt < SCROLL_IDLE_MS;
  }

  function isNearViewport(element, margin) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > -margin && rect.right > -margin &&
      rect.top < innerHeight + margin && rect.left < innerWidth + margin;
  }

  function viewportDistance(element) {
    const rect = element.getBoundingClientRect();
    const dx = rect.right < 0 ? -rect.right : rect.left > innerWidth ? rect.left - innerWidth : 0;
    const dy = rect.bottom < 0 ? -rect.bottom : rect.top > innerHeight ? rect.top - innerHeight : 0;
    return Math.hypot(dx, dy);
  }

  function mediaInferencePriority(element) {
    if (!(element instanceof Element) || !element.isConnected) return Number.POSITIVE_INFINITY;
    const rect = element.getBoundingClientRect();
    if (isVisible(element)) {
      const dx = rect.left + rect.width / 2 - innerWidth / 2;
      const dy = rect.top + rect.height / 2 - innerHeight / 2;
      return -1_000_000 + Math.hypot(dx, dy);
    }
    return viewportDistance(element);
  }

  function enqueueMediaInference(element, kind, run, onError) {
    for (let index = mediaInferenceQueue.length - 1; index >= 0; index--) {
      const queued = mediaInferenceQueue[index];
      if (queued.element === element && queued.kind === kind) mediaInferenceQueue.splice(index, 1);
    }
    mediaInferenceQueue.push({ element, kind, run, onError, sequence: mediaInferenceQueueSequence++ });
    if (mediaInferenceQueueScheduled) return;
    mediaInferenceQueueScheduled = true;
    queueMicrotask(() => {
      mediaInferenceQueueScheduled = false;
      void pumpMediaInferenceQueue();
    });
  }

  async function pumpMediaInferenceQueue() {
    if (mediaInferenceQueueRunning) return;
    mediaInferenceQueueRunning = true;
    try {
      while (mediaInferenceQueue.length && activeMediaInferenceJobs < MAX_PARALLEL_IMAGE_REQUESTS) {
        mediaInferenceQueue.sort((left, right) =>
          mediaInferencePriority(left.element) - mediaInferencePriority(right.element) ||
          left.sequence - right.sequence);
        const job = mediaInferenceQueue.shift();
        activeMediaInferenceJobs++;
        void runMediaInferenceJob(job);
      }
    } finally {
      mediaInferenceQueueRunning = false;
    }
  }

  async function runMediaInferenceJob(job) {
    try {
      await job.run();
    } catch (error) {
      job.onError?.(error);
    } finally {
      activeMediaInferenceJobs--;
      if (mediaInferenceQueue.length && !mediaInferenceQueueScheduled) {
        mediaInferenceQueueScheduled = true;
        queueMicrotask(() => {
          mediaInferenceQueueScheduled = false;
          void pumpMediaInferenceQueue();
        });
      }
    }
  }

  function flushDeferredImages() {
    scrollIdleTimer = undefined;
    if (isScrollSettling()) {
      scrollIdleTimer = setTimeout(flushDeferredImages, SCROLL_IDLE_MS);
      return;
    }
    const images = [...deferredImages].filter((image) =>
      image.isConnected && isNearViewport(image, IMAGE_MARGIN_PX));
    const backgrounds = [...deferredBackgrounds].filter((element) =>
      element.isConnected && isNearViewport(element, BACKGROUND_MARGIN_PX));
    deferredImages.clear();
    deferredBackgrounds.clear();
    const jobs = [...images, ...backgrounds].sort((a, b) => viewportDistance(a) - viewportDistance(b));
    for (const element of jobs) {
      if (element instanceof HTMLImageElement) {
        queueImage(element);
        intersection.unobserve(element);
      } else {
        queueBackground(element);
        backgroundIntersection.unobserve(element);
      }
    }
  }

  window.addEventListener("scroll", () => {
    if (!settings.enabled) return;
    lastScrollAt = performance.now();
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(flushDeferredImages, SCROLL_IDLE_MS);
  }, { capture: true, passive: true });

  function ensureMediaSampler() {
    if (!extensionContextInvalidated && !mediaSamplerTimer && !document.hidden && document.hasFocus() &&
        (trackedVideos.size || trackedGifs.size)) {
      mediaSamplerTimer = setInterval(sampleMediaOnce, MEDIA_SAMPLER_INTERVAL_MS);
    }
  }

  function updateMediaSamplerFocus() {
    if (document.hidden || !document.hasFocus()) {
      if (mediaSamplerTimer) clearInterval(mediaSamplerTimer);
      mediaSamplerTimer = undefined;
      return;
    }
    ensureMediaSampler();
  }

  document.addEventListener("visibilitychange", updateMediaSamplerFocus);
  window.addEventListener("blur", updateMediaSamplerFocus);
  window.addEventListener("focus", updateMediaSamplerFocus);

  function stopMediaSamplerIfIdle() {
    if (trackedVideos.size || trackedGifs.size || !mediaSamplerTimer) return;
    clearInterval(mediaSamplerTimer);
    mediaSamplerTimer = undefined;
    videoCursor = 0;
    gifCursor = 0;
    videoSamplesSinceGif = 0;
  }

  async function sampleMediaOnce(preferredVideo) {
    if (extensionContextInvalidated || !settings.enabled || document.hidden || !document.hasFocus() || realtimeInferenceInFlight || isScrollSettling() ||
        performance.now() - lastRealtimeInferenceAt < REALTIME_SAMPLE_INTERVAL_MS) return;
    const videoCandidates = [];
    const gifCandidates = [];
    if (settings.blurVideos) {
      for (const video of trackedVideos) {
        const state = videoStates.get(video);
        if (!video.isConnected || !state) {
          stopVideo(video);
          continue;
        }
        if (performance.now() >= state.nextSampleAt && !video.paused && !video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.videoWidth > 0 && isVisible(video)) videoCandidates.push({ kind: "video", element: video, state });
      }
    }
    for (const image of trackedGifs) {
      const state = gifStates.get(image);
      if (!image.isConnected || !state) {
        stopGif(image);
        continue;
      }
      const source = image.currentSrc || image.src;
      if (source !== state.source) {
        stopGif(image);
        queueImage(image);
        continue;
      }
      if (performance.now() >= state.nextSampleAt && image.complete && image.naturalWidth > 0 &&
          image.naturalHeight > 0 && isVisible(image)) {
        gifCandidates.push({ kind: "gif", element: image, state });
      }
    }
    if (!videoCandidates.length && !gifCandidates.length) return;
    const preferredIndex = preferredVideo
      ? videoCandidates.findIndex((candidate) => candidate.element === preferredVideo)
      : -1;
    let selected;
    if (preferredIndex >= 0) {
      selected = videoCandidates[preferredIndex];
      videoCursor = (preferredIndex + 1) % videoCandidates.length;
      videoSamplesSinceGif++;
    } else if (videoCandidates.length && (!gifCandidates.length || videoSamplesSinceGif < 9)) {
      selected = videoCandidates[videoCursor % videoCandidates.length];
      videoCursor = (videoCursor + 1) % videoCandidates.length;
      videoSamplesSinceGif++;
    } else {
      selected = gifCandidates[gifCursor % gifCandidates.length];
      gifCursor = (gifCursor + 1) % gifCandidates.length;
      videoSamplesSinceGif = 0;
    }
    const now = performance.now();
    lastRealtimeInferenceAt = now;
    selected.state.nextSampleAt = now + (selected.kind === "video"
      ? VIDEO_SAMPLE_INTERVAL_MS
      : GIF_SAMPLE_INTERVAL_MS);
    realtimeInferenceInFlight = true;
    try {
      if (selected.kind === "video") await sampleVideo(selected.element, selected.state);
      else await sampleGif(selected.element, selected.state);
    } finally {
      realtimeInferenceInFlight = false;
    }
  }

  async function sampleVideo(video, state) {
    if (extensionContextInvalidated) return;
    try {
      const sampledSource = video.currentSrc || video.src;
      if (state.source !== sampledSource) {
        if (tabCaptureStickyBlurredVideos.delete(video)) unblurElement(video);
        markMediaPending(video);
        state.source = sampledSource;
        state.votes = [];
        state.partVotes = [];
        state.runPartDetectorNext = true;
        state.posterFallbackChecked = false;
        state.posterFallbackSource = undefined;
        state.firstSample = true;
        state.remoteVideoAttempted = false;
        state.remoteVideoAnalyzed = false;
        state.issueReported = false;
      }
      if (updateDirectVideoMask(video)) return;
      if (state.remoteVideoAnalyzed) return;
      // Tab capture includes ClearSight's own CSS blur. Keep a positive decision
      // stable for this media source rather than treating the blurred output as clean.
      if (tabCaptureStickyBlurredVideos.has(video)) return;
      const runExposedPart = state.runPartDetectorNext !== false;
      let result = await classify(video, "video-frame", {
        realtime: true,
        runExposedPart,
        includeRemoteVideo: !state.remoteVideoAttempted,
      });
      if (result?.exposedPartChecked) state.runPartDetectorNext = !runExposedPart;
      if (result?.videoUrlAttempted) state.remoteVideoAttempted = true;
      if (result?.remoteVideoAnalyzed) state.remoteVideoAnalyzed = true;
      if (result?.contextInvalidated || extensionContextInvalidated) return;
      if (result?.captureMethod === "tab-capture" &&
          !result.blurred && !video.classList.contains(READY_MEDIA_CLASS)) return;
      const posterState = videoPosterStates.get(video);
      const posterKey = videoPosterSources(video).join("\n");
      const posterNeedsCheck = Boolean(posterKey &&
        (!posterState || posterState.source !== posterKey || posterState.status === "failed"));
      const canCheckFallback = (result?.skipped || result?.error)
        ? (!posterKey || posterNeedsCheck)
        : state.firstSample && posterNeedsCheck && result && !result.blurred;
      state.firstSample = false;
      if (canCheckFallback && !state.posterFallbackChecked) {
        state.posterFallbackChecked = true;
        state.posterFallbackSource = videoPosterSources(video)[0] ||
          ((result?.skipped || result?.error) ? findRelatedVideoThumbnail(video) : undefined);
        if (state.posterFallbackSource) {
          const thumbnailResult = await classifyVideoPoster(state.posterFallbackSource, isThumbnailLike(video));
          if (thumbnailResult?.contextInvalidated || extensionContextInvalidated) return;
          // A poster is only positive evidence for blurring. Do not let a clean
          // poster hide an unreadable live frame, and do not replace the useful
          // capture error with a 403 from the site's poster endpoint.
          if (thumbnailResult?.blurred) result = thumbnailResult;
        }
      }
      if (!result || result.error || result.skipped || (video.currentSrc || video.src) !== sampledSource) {
        state.votes = [];
        state.partVotes = [];
        if (!state.issueReported) {
          state.issueReported = true;
          const message = result?.error || "frame pixels were unavailable";
          if (/Chrome blocks direct pixels|Video capture is not active/i.test(message)) {
            console.info("[ClearSight] This site's video frame is protected. Enable video capture for this tab in the extension popup to analyze it.");
          } else {
            console.warn("[ClearSight] A video frame could not be analyzed:", message);
          }
        }
        return;
      }
      state.issueReported = false;
      const scores = result.scores || {};
      const nsfwPositive = (scores.NSFW || 0) >= settings.threshold;
      if (nsfwPositive) {
        state.votes.push(true);
        if (state.votes.length > VIDEO_NSFW_VOTE_COUNT) state.votes.shift();
      } else {
        state.votes = [];
      }
      const repeatedNsfwPositive = state.votes.length === VIDEO_NSFW_VOTE_COUNT &&
        state.votes.every(Boolean);
      if (result.exposedPartChecked) {
        if (result.detector === "body-part") {
          state.partVotes.push(true);
          if (state.partVotes.length > VIDEO_NSFW_VOTE_COUNT) state.partVotes.shift();
        } else {
          state.partVotes = [];
        }
      }
      const repeatedBodyPartPositive = state.partVotes.length === VIDEO_NSFW_VOTE_COUNT &&
        state.partVotes.every(Boolean);
      const remoteVideoPositive = Number(result.confirmedNsfwFrames) >= VIDEO_NSFW_VOTE_COUNT ||
        Number(result.confirmedBodyPartFrames) >= VIDEO_NSFW_VOTE_COUNT;
      if (repeatedNsfwPositive || repeatedBodyPartPositive || remoteVideoPositive) {
        blurElement(video);
        // Keep the blur in place for at least one second before the next
        // frame can clear it. A further positive result starts that hold again.
        state.nextSampleAt = performance.now() + VIDEO_BLUR_RECHECK_MS;
        // Tab capture sees the rendered blur itself, so its clean score cannot
        // safely prove the underlying frame is clean.
        if (result.captureMethod === "tab-capture") tabCaptureStickyBlurredVideos.add(video);
        video.title = "ClearSight detected explicit video frames. Click to reveal for 15 seconds.";
      } else if (nsfwPositive || result.blurred || state.partVotes.length > 0) {
        markMediaPending(video);
      } else {
        markMediaSafe(video);
      }
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
        return;
      }
      state.votes = [];
      state.partVotes = [];
      if (!state.issueReported) {
        state.issueReported = true;
        console.warn("[ClearSight] Video classification failed; the next frame will be retried:", error?.message || error);
      }
    }
  }

  function findRelatedVideoThumbnail(video) {
    const videoRect = video.getBoundingClientRect();
    const videoArea = Math.max(1, videoRect.width * videoRect.height);
    let ancestor = video.parentElement;
    for (let depth = 0; ancestor && depth < 6; depth++, ancestor = ancestor.parentElement) {
      let best;
      for (const image of ancestor.querySelectorAll("img")) {
        if (image === video || !image.complete || image.naturalWidth < 80) continue;
        const rect = image.getBoundingClientRect();
        const imageArea = rect.width * rect.height;
        if (imageArea < videoArea * 0.25) continue;
        const overlapWidth = Math.max(0, Math.min(videoRect.right, rect.right) - Math.max(videoRect.left, rect.left));
        const overlapHeight = Math.max(0, Math.min(videoRect.bottom, rect.bottom) - Math.max(videoRect.top, rect.top));
        const overlap = (overlapWidth * overlapHeight) / Math.max(1, Math.min(videoArea, imageArea));
        if (overlap >= 0.6 && (!best || overlap > best.overlap)) {
          best = { source: image.currentSrc || image.src, overlap };
        }
      }
      if (best?.source) return best.source;
    }
    return undefined;
  }

  async function classifyVideoPoster(source, isThumbnail = false) {
    if (!source) return { skipped: true };
    let dataUrl;
    let imageUrl;
    if (source.startsWith("data:image/")) dataUrl = source;
    else if (source.startsWith("blob:")) dataUrl = await readBlobUrlAsDataUrl(source);
    else imageUrl = source;
    return sendExtensionMessage({
      type: "classify-content",
      imageUrl,
      dataUrl,
      // Posters are still images; borderline scores can use the crop fallback.
      isVideo: false,
      isThumbnail,
    });
  }

  function videoPosterSources(video) {
    const sources = [video.poster];
    for (const element of [video, video.parentElement]) {
      if (!element) continue;
      for (const attribute of VIDEO_POSTER_ATTRIBUTES) {
        const source = normalizeImageSource(element.getAttribute(attribute));
        if (source) sources.push(source);
      }
    }
    return [...new Set(sources.map(normalizeImageSource).filter(Boolean))].slice(0, 5);
  }

  function queueVideoPoster(video, force = false) {
    const sources = videoPosterSources(video);
    if (extensionContextInvalidated || !settings.enabled || !settings.blurVideos) return;
    if (!sources.length) {
      if (video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) queuePausedVideoFrame(video);
      return;
    }
    const source = sources.join("\n");
    const previous = videoPosterStates.get(video);
    if (!force && previous?.source === source) return;
    markMediaPending(video);
    const state = { source, status: "queued", blurred: false };
    videoPosterStates.set(video, state);
    enqueueMediaInference(video, "poster", async () => {
      if (videoPosterStates.get(video) !== state) return;
      if (extensionContextInvalidated || !video.isConnected || !settings.enabled || !settings.blurVideos) {
        videoPosterStates.delete(video);
        return;
      }
      if (videoPosterSources(video).join("\n") !== source) {
        videoPosterStates.delete(video);
        queueVideoPoster(video);
        return;
      }
      state.status = "checking";
      let result;
      let sourceError;
      for (const posterSource of sources) {
        try {
          const candidate = await classifyVideoPoster(posterSource, isThumbnailLike(video));
          if (candidate?.blurred) {
            result = candidate;
            break;
          }
          if (candidate?.error) sourceError = candidate;
          else if (!result) result = candidate;
        } catch (error) {
          sourceError = { error: error?.message || "Video poster could not be analyzed." };
        }
      }
      if (!result && sourceError) result = sourceError;
      if (videoPosterStates.get(video) !== state || !video.isConnected || videoPosterSources(video).join("\n") !== source ||
          extensionContextInvalidated) return;
      if (!result || result.error || result.skipped) {
        state.status = "failed";
        return;
      }
      state.status = "done";
      if (result.blurred && settings.enabled && settings.blurVideos) {
        state.blurred = true;
        blurElement(video);
        video.title = "ClearSight detected an explicit video poster. Click to reveal for 15 seconds.";
      } else if (video.paused && !directlyMaskedVideos.has(video)) {
        markMediaSafe(video);
      }
    }, () => {
      if (videoPosterStates.get(video) === state) state.status = "failed";
    });
  }

  function queuePausedVideoFrame(video) {
    if (extensionContextInvalidated || !settings.enabled || !settings.blurVideos || !video.paused ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0) return;
    const mediaSource = video.currentSrc || video.src || "paused-frame";
    const source = mediaSource + "\npaused-at:" + video.currentTime.toFixed(2);
    const previous = pausedVideoStates.get(video);
    if (previous?.source === source && (previous.status !== "failed" || Date.now() - previous.attemptedAt < 4000)) return;
    const state = { source, status: "queued", attemptedAt: Date.now() };
    pausedVideoStates.set(video, state);
    markMediaPending(video);
    enqueueMediaInference(video, "poster", async () => {
      if (pausedVideoStates.get(video) !== state) return;
      if (extensionContextInvalidated || !video.isConnected || !settings.enabled || !settings.blurVideos) return;
      if (!video.paused || (video.currentSrc || video.src || "paused-frame") + "\npaused-at:" + video.currentTime.toFixed(2) !== source) {
        pausedVideoStates.delete(video);
        return;
      }
      state.status = "checking";
      const result = await classify(video, "video-frame", {
        realtime: true,
        includeRemoteVideo: true,
      });
      if (result?.contextInvalidated || extensionContextInvalidated || pausedVideoStates.get(video) !== state) return;
      if (!result || result.error || result.skipped) {
        state.status = "failed";
        return;
      }
      state.status = "done";
      if (result.blurred && !directlyMaskedVideos.has(video)) {
        blurElement(video);
        video.title = "ClearSight detected an explicit paused video frame. Click to reveal for 15 seconds.";
      } else if (!directlyMaskedVideos.has(video)) {
        markMediaSafe(video);
      }
    }, () => {
      if (pausedVideoStates.get(video) === state) state.status = "failed";
    });
  }

  async function sampleGif(image, state) {
    markMediaPending(image);
    try {
      const frameIndex = state.decoderFrames ? state.nextFrameIndex : undefined;
      const result = await classify(image, state.source, {
        animationFrameIndex: frameIndex,
        realtime: true,
        renderedFrame: !state.decoderFrames,
      });
      if (!result || result.error || result.skipped || !image.isConnected ||
          (image.currentSrc || image.src) !== state.source) return;
      if (result.animatedFrameCount > 1) {
        state.decoderFrames = true;
        state.frameCount = result.animatedFrameCount;
      } else if (state.decoderFrames && result.mimeType === "image/gif") {
        // WebCodecs can reject a malformed or unsupported GIF later. Fall back
        // to sampling the image element's currently rendered animation frame.
        state.decoderFrames = false;
      }
      if (state.decoderFrames && state.frameCount > 1) {
        state.nextFrameIndex = (state.nextFrameIndex + 1) % state.frameCount;
      }
      if (result.blurred) {
        blurElement(image);
        image.title = "ClearSight detected an explicit GIF frame. Click to reveal for 15 seconds.";
      } else {
        markMediaSafe(image);
      }
    } catch { /* Cross-origin GIFs may prevent reading the rendered frame. */ }
  }

  function startGif(image, source, frameCount) {
    if (extensionContextInvalidated || !settings.enabled) return;
    let state = gifStates.get(image);
    if (state?.source !== source) {
      state = {
        source,
        frameCount,
        decoderFrames: frameCount > 1,
        nextFrameIndex: frameCount > 1 ? 1 : 0,
        nextSampleAt: 0,
      };
      gifStates.set(image, state);
    } else if (frameCount > 1) {
      state.frameCount = frameCount;
      state.decoderFrames = true;
    }
    gifIntersection.observe(image);
  }

  function stopGif(image) {
    if (!gifStates.has(image)) return;
    gifStates.delete(image);
    gifIntersection.unobserve(image);
    trackedGifs.delete(image);
    stopMediaSamplerIfIdle();
  }

  function startVideo(video) {
    if (extensionContextInvalidated || !settings.enabled || !settings.blurVideos || videoStates.has(video)) return;
    markMediaPending(video);
    videoStates.set(video, {
      votes: [], partVotes: [], runPartDetectorNext: true, nextSampleAt: 0, firstSample: true,
      source: video.currentSrc || video.src,
      remoteVideoAttempted: false, remoteVideoAnalyzed: false,
    });
    trackedVideos.add(video);
    ensureMediaSampler();
  }

  function stopVideo(video) {
    if (!videoStates.has(video)) return;
    videoStates.delete(video);
    trackedVideos.delete(video);
    stopMediaSamplerIfIdle();
  }

  function scanVideos(root = document, refreshPosters = false) {
    const maybeStart = (video) => {
      if (!settings.enabled) {
        markMediaSafe(video);
        return;
      }
      updateDirectVideoMask(video);
      if (directlyMaskedVideos.has(video)) return;
      const liveState = videoStates.get(video);
      const sourceChanged = liveState && liveState.source !== (video.currentSrc || video.src);
      if (settings.blurVideos && (refreshPosters || sourceChanged || !video.classList.contains(READY_MEDIA_CLASS))) {
        markMediaPending(video);
      } else if (!settings.blurVideos) {
        markMediaSafe(video);
      }
      queueVideoPoster(video, refreshPosters);
      if (!video.paused && !video.ended) startVideo(video);
      else if (settings.blurVideos && !videoPosterSources(video).length) queuePausedVideoFrame(video);
    };
    if (root instanceof HTMLVideoElement) maybeStart(root);
    root.querySelectorAll?.("video").forEach(maybeStart);
  }

  function observeVideoEvents(root) {
    if (videoEventRoots.has(root)) return;
    videoEventRoots.add(root);
    root.addEventListener("play", (event) => {
      if (!settings.enabled) return;
      if (event.target instanceof HTMLVideoElement) {
        startVideo(event.target);
        void sampleMediaOnce(event.target);
      }
    }, true);
    root.addEventListener("playing", (event) => {
      if (!settings.enabled) return;
      if (event.target instanceof HTMLVideoElement) {
        startVideo(event.target);
        void sampleMediaOnce(event.target);
      }
    }, true);
    root.addEventListener("pointerover", (event) => {
      if (!settings.enabled) return;
      const video = event.composedPath?.().find((target) => target instanceof HTMLVideoElement);
      if (!video || video.paused) return;
      startVideo(video);
      void sampleMediaOnce(video);
    }, true);
    root.addEventListener("pause", (event) => {
      if (!settings.enabled) return;
      if (event.target instanceof HTMLVideoElement) {
        stopVideo(event.target);
        if (event.target.currentTime > 0.05) queuePausedVideoFrame(event.target);
        else queueVideoPoster(event.target);
      }
    }, true);
    const resetCapturedVideo = (event) => {
      if (!settings.enabled) return;
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      resetVideoSourceState(video);
    };
    root.addEventListener("emptied", resetCapturedVideo, true);
    root.addEventListener("loadedmetadata", resetCapturedVideo, true);
  }

  function resetVideoSourceState(video) {
    if (!settings.enabled || !(video instanceof HTMLVideoElement)) return;
    if (tabCaptureStickyBlurredVideos.delete(video)) unblurElement(video);
    updateDirectVideoMask(video);
    if (!directlyMaskedVideos.has(video) && settings.blurVideos) markMediaPending(video);
    queueVideoPoster(video);
    if (video.paused && !videoPosterSources(video).length) queuePausedVideoFrame(video);
    const state = videoStates.get(video);
    if (state) {
      state.source = video.currentSrc || video.src;
      state.votes = [];
      state.firstSample = true;
      state.remoteVideoAttempted = false;
      state.remoteVideoAnalyzed = false;
      state.posterFallbackChecked = false;
      state.posterFallbackSource = undefined;
      state.issueReported = false;
    }
  }
  observeVideoEvents(document);

  const intersection = new IntersectionObserver((entries) => {
    if (!settings.enabled) return;
    const visibleEntries = entries.filter((entry) => entry.isIntersecting)
      .sort((a, b) => viewportDistance(a.target) - viewportDistance(b.target));
    for (const entry of visibleEntries) {
      if (isScrollSettling() && !isVisible(entry.target)) {
          deferredImages.add(entry.target);
      } else {
        queueImage(entry.target);
        intersection.unobserve(entry.target);
      }
    }
  }, { rootMargin: IMAGE_MARGIN_PX + "px" });
  invalidationCleanups.add(() => intersection.disconnect());

  const backgroundIntersection = new IntersectionObserver((entries) => {
    if (!settings.enabled) return;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!readBackground(entry.target)) continue;
      backgroundIntersection.unobserve(entry.target);
      if (isScrollSettling() && !isVisible(entry.target)) deferredBackgrounds.add(entry.target);
      else queueBackground(entry.target);
    }
  }, { rootMargin: BACKGROUND_MARGIN_PX + "px" });
  invalidationCleanups.add(() => backgroundIntersection.disconnect());

  const gifIntersection = new IntersectionObserver((entries) => {
    if (!settings.enabled) return;
    for (const entry of entries) {
      if (entry.isIntersecting && settings.enabled && gifStates.has(entry.target)) {
        trackedGifs.add(entry.target);
        ensureMediaSampler();
      } else {
        trackedGifs.delete(entry.target);
        stopMediaSamplerIfIdle();
      }
    }
  });
  invalidationCleanups.add(() => gifIntersection.disconnect());

  function scanBackgrounds(root = document) {
    const observe = (element) => {
      if (!(element instanceof HTMLElement) || element instanceof HTMLImageElement ||
          element instanceof HTMLVideoElement || element === document.body || element === document.documentElement) return;
      backgroundIntersection.observe(element);
    };
    if (root instanceof Element && root.matches(BACKGROUND_CANDIDATE_SELECTOR)) observe(root);
    root.querySelectorAll?.(BACKGROUND_CANDIDATE_SELECTOR).forEach(observe);
  }

  function inspectBackground(element) {
    if (!(element instanceof HTMLElement) || !element.matches(BACKGROUND_CANDIDATE_SELECTOR) ||
        element instanceof HTMLImageElement || element instanceof HTMLVideoElement ||
        element === document.body || element === document.documentElement) return;
    if (!isNearViewport(element, BACKGROUND_MARGIN_PX)) {
      backgroundIntersection.observe(element);
      return;
    }
    const background = readBackground(element);
    if (!background) return;
    const source = "background:" + background.image;
    if (checked.get(element) === source) {
      backgroundIntersection.unobserve(element);
      return;
    }
    if (isScrollSettling() && !isVisible(element)) {
      deferredBackgrounds.add(element);
      backgroundIntersection.unobserve(element);
      return;
    }
    backgroundIntersection.unobserve(element);
    queueBackground(element);
  }

  function observeImages(root = document) {
    const visibleImages = [];
    const observe = (image) => {
      if (settings.enabled) {
        if (!image.classList.contains(READY_MEDIA_CLASS)) markMediaPending(image);
      } else {
        markMediaSafe(image);
      }
      if (!observedImages.has(image)) {
        observedImages.add(image);
        image.addEventListener("load", () => {
          if (!settings.enabled) return;
          // Queue loaded images directly. Re-observing an image already in
          // IntersectionObserver does not guarantee a new notification.
          if (isNearViewport(image, IMAGE_MARGIN_PX)) {
            intersection.unobserve(image);
            queueImage(image);
          } else {
            intersection.observe(image);
          }
        });
      }
      // Queue visible images as soon as they enter the DOM, even before load.
      // That lets direct adult-source matches mask immediately; the load
      // listener retries model analysis once pixels are available.
      if (isNearViewport(image, IMAGE_MARGIN_PX)) {
        intersection.unobserve(image);
        visibleImages.push(image);
      } else if (image.complete) {
        intersection.observe(image);
      }
    };
    if (root instanceof HTMLImageElement) observe(root);
    root.querySelectorAll?.("img").forEach(observe);
    // Defer any direct masking until all viewport rectangles have been read,
    // avoiding forced layout between images in large result grids.
    visibleImages.forEach(queueImage);
  }

  function refreshImagesFor(target) {
    let root = target;
    if (target instanceof HTMLSourceElement && target.closest("picture")) root = target.closest("picture");
    const images = root instanceof HTMLImageElement
      ? [root]
      : [...(root.querySelectorAll?.("img") || [])];
    for (const image of images) {
      checked.delete(image);
      retryState.delete(image);
      imageBlobData.delete(image);
      markMediaPending(image);
      intersection.unobserve(image);
      observeImages(image);
    }
  }

  function refreshImagesForLinkedCard(link) {
    const linkedImages = link.querySelectorAll("img");
    refreshImagesFor(link);
    if (linkedImages.length) return;
    for (let ancestor = link.parentElement, depth = 0; ancestor && depth < 4; ancestor = ancestor.parentElement, depth++) {
      const images = ancestor.querySelectorAll("img");
      if (images.length > 3) break;
      if (images.length) {
        refreshImagesFor(ancestor);
        return;
      }
    }
  }

  function visitRemoved(node) {
    if (node instanceof Element) {
      backgroundIntersection.unobserve(node);
      node.querySelectorAll?.(BACKGROUND_CANDIDATE_SELECTOR)
        .forEach((element) => backgroundIntersection.unobserve(element));
    }
    if (node instanceof Element) activeBlurs.delete(node);
    node.querySelectorAll?.("." + BLUR_CLASS).forEach((element) => activeBlurs.delete(element));
    node.querySelectorAll?.("." + BACKGROUND_BLUR_CLASS).forEach((element) => activeBlurs.delete(element));
    activeBlurs.forEach((element) => { if (!element.isConnected) activeBlurs.delete(element); });
    if (node instanceof HTMLVideoElement && !node.isConnected) stopVideo(node);
    node.querySelectorAll?.("video").forEach((video) => { if (!video.isConnected) stopVideo(video); });
    if (node instanceof HTMLImageElement && !node.isConnected) stopGif(node);
    node.querySelectorAll?.("img").forEach((image) => { if (!image.isConnected) stopGif(image); });
    [...trackedVideos].forEach((video) => {
      if (!video.isConnected) {
        unblurElement(video);
        stopVideo(video);
      }
    });
    [...trackedGifs].forEach((image) => {
      if (!image.isConnected) stopGif(image);
    });
    deferredImages.forEach((image) => {
      if (!image.isConnected) deferredImages.delete(image);
    });
    deferredBackgrounds.forEach((element) => {
      if (!element.isConnected) deferredBackgrounds.delete(element);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const settingChanges = Object.entries(changes).filter(([key]) => Object.hasOwn(settings, key));
    if (!settingChanges.length) return;
    if (settingChanges.some(([key]) => key === "threshold" || key === "partThreshold") ||
        changes.enabled?.newValue === true) checked = new WeakMap();
    for (const [key, change] of settingChanges) settings[key] = change.newValue;
    if (!settings.privacyConsent) settings.enabled = false;
    const threshold = Number(settings.threshold);
    settings.threshold = !Number.isFinite(threshold) || threshold < 0.25 ? 0.77 : Math.min(0.98, threshold);
    const partThreshold = Number(settings.partThreshold);
    settings.partThreshold = !Number.isFinite(partThreshold) || partThreshold < 0.15
      ? 0.61
      : Math.min(0.80, partThreshold);
    if (!settings.enabled) {
      clearAllBlurs();
      setProtectionDisabled(true);
      observer.disconnect();
      intersection.disconnect();
      backgroundIntersection.disconnect();
      gifIntersection.disconnect();
      [...trackedVideos].forEach(stopVideo);
      [...trackedGifs].forEach(stopGif);
    } else {
      setProtectionDisabled(false);
      observeKnownMutationRoots();
      if (!settings.blurVideos) {
        [...trackedVideos].forEach((video) => {
          unblurElement(video);
          stopVideo(video);
        });
      }
      const refreshPosters = Boolean(changes.threshold || changes.partThreshold ||
        changes.enabled?.newValue === true || changes.blurVideos?.newValue === true);
      scanVideos(document, refreshPosters);
      observeImages();
      scanBackgrounds();
      scanOpenShadowRoots(document);
    }
    if (changes.threshold || changes.partThreshold) [...trackedVideos].forEach((video) => {
      const state = videoStates.get(video);
      if (state) {
        state.votes = [];
        state.partVotes = [];
      }
    });
  });

  const backgroundAttributeTargets = new Set();
  const backgroundAttributeSubtrees = new Set();
  let backgroundAttributeFrame;
  invalidationCleanups.add(() => {
    if (backgroundAttributeFrame !== undefined) cancelAnimationFrame(backgroundAttributeFrame);
  });

  function flushBackgroundAttributeChanges() {
    backgroundAttributeFrame = undefined;
    const subtrees = [...backgroundAttributeSubtrees];
    const targets = [...backgroundAttributeTargets];
    backgroundAttributeSubtrees.clear();
    backgroundAttributeTargets.clear();
    const roots = subtrees.filter((root) => !subtrees.some((other) => other !== root && other.contains(root)));
    for (const root of roots) {
      inspectBackground(root);
      root.querySelectorAll?.(BACKGROUND_CANDIDATE_SELECTOR).forEach(inspectBackground);
    }
    for (const target of targets) {
      if (!roots.some((root) => root === target || root.contains(target))) inspectBackground(target);
    }
  }

  function scheduleBackgroundAttributeScan() {
    if (backgroundAttributeFrame === undefined) {
      backgroundAttributeFrame = requestAnimationFrame(flushBackgroundAttributeChanges);
    }
  }

  const observer = new MutationObserver((records) => {
    if (!settings.enabled) return;
    const added = new Set();
    for (const record of records) {
      if (record.type === "attributes") {
        const target = record.target;
        if (record.attributeName === "poster" && target instanceof HTMLVideoElement) {
          queueVideoPoster(target, true);
        }
        if (record.attributeName === "href" && target instanceof HTMLAnchorElement) {
          refreshImagesForLinkedCard(target);
          backgroundAttributeSubtrees.add(target.parentElement || target);
        } else if (["src", "srcset", ...LAZY_MEDIA_ATTRIBUTES].includes(record.attributeName)) {
          refreshImagesFor(target);
          const video = target instanceof HTMLVideoElement ? target : target.closest?.("video");
          if (video instanceof HTMLVideoElement) resetVideoSourceState(video);
        }
        if (record.attributeName === "style") backgroundAttributeTargets.add(target);
        else if (record.attributeName === "class" || record.attributeName === "id" ||
            LAZY_MEDIA_ATTRIBUTES.includes(record.attributeName)) {
          backgroundAttributeSubtrees.add(target);
        }
        continue;
      }
      for (const node of record.removedNodes) if (node.nodeType === Node.ELEMENT_NODE) visitRemoved(node);
      for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) added.add(node);
    }
    if (backgroundAttributeTargets.size || backgroundAttributeSubtrees.size) scheduleBackgroundAttributeScan();
    // A page often reports nested additions in one mutation batch. Scanning only
    // the highest added roots avoids repeatedly walking the same large subtree.
    for (const node of added) {
      let parent = node.parentElement;
      let coveredByAddedRoot = false;
      while (parent) {
        if (added.has(parent)) {
          coveredByAddedRoot = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (coveredByAddedRoot) continue;
      scanVideos(node);
      observeImages(node);
      scanBackgrounds(node);
      scanOpenShadowRoots(node);
    }
  });
  invalidationCleanups.add(() => observer.disconnect());
  const mutationOptions = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "id", "src", "srcset", "href", "poster", ...LAZY_MEDIA_ATTRIBUTES],
  };
  const observedMutationRoots = new Set();
  function observeMutationRoot(root) {
    observer.observe(root, mutationOptions);
    observedMutationRoots.add(root);
  }
  function observeKnownMutationRoots() {
    if (!observedMutationRoots.has(document)) observeMutationRoot(document);
    for (const root of observedMutationRoots) {
      if (root === document || root.host?.isConnected) observer.observe(root, mutationOptions);
    }
  }
  if (settings.enabled) {
    observeMutationRoot(document);
    setProtectionDisabled(false);
    scanVideos();
    observeImages();
    scanBackgrounds();
    scanOpenShadowRoots(document);
  } else {
    setProtectionDisabled(true);
  }

  function scanOpenShadowRoots(root) {
    const hosts = [];
    if (root instanceof Element) hosts.push(root);
    root.querySelectorAll?.("*").forEach((element) => hosts.push(element));
    for (const host of hosts) {
      const shadowRoot = host.shadowRoot;
      if (!shadowRoot || observedShadowRoots.has(shadowRoot)) continue;
      observedShadowRoots.add(shadowRoot);
      installBlurStyle(shadowRoot);
      observeVideoEvents(shadowRoot);
      observeMutationRoot(shadowRoot);
      scanVideos(shadowRoot);
      observeImages(shadowRoot);
      scanBackgrounds(shadowRoot);
      scanOpenShadowRoots(shadowRoot);
    }
  }
  }

  const settingKeys = ["enabled", "threshold", "partThreshold", "blurVideos", "privacyConsent"];
  const latestSettingsChanges = {};
  const initializeAfterConsent = () => {
    chrome.storage.local.get(settingKeys).then((saved) => {
      const latest = { ...saved, ...latestSettingsChanges };
      if (latest.privacyConsent === true) initialize(latest);
    }).catch(() => undefined);
  };
  initializeAfterConsent();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of settingKeys) {
      if (Object.hasOwn(changes, key)) latestSettingsChanges[key] = changes[key].newValue;
    }
    if (changes.privacyConsent?.newValue === true) initializeAfterConsent();
  });
})();
