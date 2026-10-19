const OFFSCREEN_PATH = "offscreen.html";
const DEFAULT_SETTINGS = { enabled: true, threshold: 0.77, partThreshold: 0.61, blurVideos: true, privacyConsent: false };
const SETTINGS_SCHEMA = 16;
let creatingOffscreen;
let offscreenReady = false;
let cachedSettings = { ...DEFAULT_SETTINGS };
void chrome.storage.local.remove([
  "clearsightAdultSiteHosts",
  "clearsightAdultSiteCatalogScannedAt",
  "clearsightAdultSiteCatalogSignature",
]).catch(() => {});
const settingsReady = chrome.storage.local.get([...Object.keys(DEFAULT_SETTINGS), "settingsSchema"]).then(async (saved) => {
  const migration = {};
  if ((saved.settingsSchema || 0) < SETTINGS_SCHEMA) {
    const savedSchema = Number(saved.settingsSchema) || 0;
    // Carry known historical default values forward while preserving custom
    // values already stored by the user.
    if (savedSchema === 7 && Number(saved.threshold) === 0.55) migration.threshold = DEFAULT_SETTINGS.threshold;
    else if (savedSchema < 6 && [0.82, 0.65, 0.55].includes(Number(saved.threshold))) {
      migration.threshold = DEFAULT_SETTINGS.threshold;
    }
    if (migration.threshold === undefined && Number(saved.threshold) === 0.72) {
      migration.threshold = DEFAULT_SETTINGS.threshold;
    }
    // The previous Marqo classifier used 0.87 as its default. NSFWJS's class
    // scores use a lower scale, so move that known default while retaining any
    // custom sensitivity value.
    if (migration.threshold === undefined && savedSchema === 14 && Number(saved.threshold) === 0.87) {
      migration.threshold = DEFAULT_SETTINGS.threshold;
    }
    if (Number(saved.partThreshold) === 0.40) {
      migration.partThreshold = DEFAULT_SETTINGS.partThreshold;
    }
    // Video blurring is an explicitly requested core feature for this build.
    if (saved.blurVideos === false) migration.blurVideos = true;
    migration.settingsSchema = SETTINGS_SCHEMA;
    await chrome.storage.local.set(migration);
    await chrome.storage.local.remove(["bodyThreshold"]);
  }
  cachedSettings = { ...DEFAULT_SETTINGS, ...saved, ...migration };
  if (cachedSettings.privacyConsent !== true) cachedSettings.enabled = false;
  delete cachedSettings.settingsSchema;
}).catch(() => undefined);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, change] of Object.entries(changes)) {
    if (Object.hasOwn(DEFAULT_SETTINGS, key)) cachedSettings[key] = change.newValue;
  }
  if (cachedSettings.privacyConsent !== true) cachedSettings.enabled = false;
  if ((changes.enabled?.newValue === true || changes.privacyConsent?.newValue === true) && cachedSettings.enabled) {
    scheduleClassifierPrewarm();
  }
  if (changes.enabled?.newValue === false || changes.privacyConsent?.newValue === false) {
    stopCaptureIfActive();
  }
});

function stopCaptureIfActive() {
  void (async () => {
    const captures = await chrome.tabCapture.getCapturedTabs();
    if (!captures.some((capture) => capture.status === "active" || capture.status === "pending")) return;
    await ensureOffscreenDocument();
    await relayToOffscreen({ type: "offscreen-tab-capture-stop" });
  })().catch(() => undefined);
}

function scheduleClassifierPrewarm() {
  void (async () => {
    await settingsReady;
    if (cachedSettings.privacyConsent !== true || !cachedSettings.enabled) return;
    await relayToOffscreen({ type: "offscreen-prewarm" });
  })().catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(scheduleClassifierPrewarm);
chrome.runtime.onStartup.addListener(scheduleClassifierPrewarm);

async function ensureOffscreenDocument() {
  if (offscreenReady) return;
  if (!creatingOffscreen) {
    creatingOffscreen = (async () => {
      const url = chrome.runtime.getURL(OFFSCREEN_PATH);
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [url],
      });
      if (!contexts.length) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_PATH,
          reasons: ["BLOBS", "USER_MEDIA"],
          justification: "Run the local classifier and, when the user enables it, read a tab-capture video stream locally.",
        });
      }
      offscreenReady = true;
    })().finally(() => { creatingOffscreen = undefined; });
  }
  await creatingOffscreen;
}

async function relayToOffscreen(request) {
  await ensureOffscreenDocument();
  try {
    return await chrome.runtime.sendMessage(request);
  } catch (error) {
    // The offscreen page can be closed independently of the worker cache.
    offscreenReady = false;
    await ensureOffscreenDocument();
    return chrome.runtime.sendMessage(request);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "tab-capture-status") {
    (async () => {
      await settingsReady;
      if (cachedSettings.privacyConsent !== true || !cachedSettings.enabled) {
        const hasPermission = cachedSettings.privacyConsent === true &&
          await chrome.permissions.contains({ permissions: ["tabCapture"] });
        sendResponse({ permission: hasPermission, active: false, protectionDisabled: true });
        return;
      }
      const hasPermission = await chrome.permissions.contains({ permissions: ["tabCapture"] });
      if (!hasPermission) {
        sendResponse({ permission: false, active: false });
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const captures = await chrome.tabCapture.getCapturedTabs();
      sendResponse({
        permission: true,
        active: Boolean(tab?.id && captures.some((capture) => capture.tabId === tab.id && capture.status === "active")),
      });
    })().catch((error) => sendResponse({ error: error?.message || "Could not read tab capture status." }));
    return true;
  }
  if (message?.type === "tab-capture-start" || message?.type === "tab-capture-stop") {
    (async () => {
      if (message.type === "tab-capture-stop") {
        await ensureOffscreenDocument();
        sendResponse(await relayToOffscreen({ type: "offscreen-tab-capture-stop" }));
        return;
      }
      await settingsReady;
      if (cachedSettings.privacyConsent !== true || !cachedSettings.enabled) {
        throw new Error("Agree to the privacy notice and enable Protection before capturing this tab.");
      }
      const hasPermission = await chrome.permissions.contains({ permissions: ["tabCapture"] });
      if (!hasPermission) throw new Error("Grant the optional tab-capture permission in ClearSight first.");
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error("Could not find the active browser tab.");
      const existing = await chrome.tabCapture.getCapturedTabs();
      if (existing.some((capture) => capture.tabId === tab.id && capture.status === "active")) {
        sendResponse({ active: true, tabId: tab.id });
        return;
      }
      await ensureOffscreenDocument();
      if (existing.some((capture) => capture.status === "active" || capture.status === "pending")) {
        await relayToOffscreen({ type: "offscreen-tab-capture-stop" });
      }
      const streamId = await chrome.tabCapture.getMediaStreamId();
      const result = await relayToOffscreen({ type: "offscreen-tab-capture-start", streamId, tabId: tab.id });
      if (result?.error) throw new Error(result.error);
      sendResponse({ active: true, tabId: tab.id });
    })().catch((error) => sendResponse({ error: error?.message || "Could not start video capture." }));
    return true;
  }
  if (message?.type !== "classify-content") return false;
  (async () => {
    try {
      await settingsReady;
      if (cachedSettings.privacyConsent !== true || !cachedSettings.enabled) {
        throw new Error("Protection is off.");
      }
      sendResponse(await relayToOffscreen({
        type: "offscreen-classify",
        imageUrl: message.imageUrl,
        dataUrl: message.dataUrl,
        videoUrl: message.videoUrl,
        isVideo: message.isVideo,
        isThumbnail: Boolean(message.isThumbnail),
        runExposedPart: message.runExposedPart,
        captureRect: message.captureRect,
        senderTabId: _sender.tab?.id,
        animationFrameIndex: message.animationFrameIndex,
        settings: { ...cachedSettings },
      }));
    } catch (error) {
      sendResponse({ error: error?.message || "Classifier unavailable" });
    }
  })();
  return true;
});
