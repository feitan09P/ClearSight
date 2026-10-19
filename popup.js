const DEFAULTS = { enabled: true, threshold: 0.77, partThreshold: 0.61, blurVideos: true, privacyConsent: false, language: "en" };
const MIN_THRESHOLD = 0.25;
const MAX_THRESHOLD = 0.98;
const MIN_PART_THRESHOLD = 0.15;
const MAX_PART_THRESHOLD = 0.80;
const enabled = document.querySelector("#enabled");
const threshold = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#threshold-value");
const partThreshold = document.querySelector("#partThreshold");
const partThresholdValue = document.querySelector("#part-threshold-value");
const blurVideos = document.querySelector("#blurVideos");
const status = document.querySelector("#status");
const tabCaptureButton = document.querySelector("#tabCapture");
const consentPanel = document.querySelector("#consent-panel");
const settingsPanel = document.querySelector("#settings-panel");
const consentAccept = document.querySelector("#consent-accept");
const consentEnableButton = document.querySelector("#consent-enable");
const withdrawConsentButton = document.querySelector("#withdraw-consent");
const consentStatus = document.querySelector("#consent-status");
let savedPreferences = { ...DEFAULTS };
const t = (key) => window.ClearSightPopupI18n.t(key);
function setLocalizedText(element, key) {
  element.dataset.i18n = key;
  element.textContent = t(key);
}

function showThreshold() { thresholdValue.value = Math.round(Number(threshold.value) * 100) + "%"; }
function showPartThreshold() { partThresholdValue.value = Math.round(Number(partThreshold.value) * 100) + "%"; }

function applySavedPreferences(saved) {
  enabled.checked = saved.enabled;
  const savedThreshold = Number(saved.threshold);
  threshold.value = !Number.isFinite(savedThreshold) || savedThreshold < MIN_THRESHOLD
    ? DEFAULTS.threshold
    : Math.min(MAX_THRESHOLD, savedThreshold);
  const savedPartThreshold = Number(saved.partThreshold);
  partThreshold.value = !Number.isFinite(savedPartThreshold) || savedPartThreshold < MIN_PART_THRESHOLD
    ? DEFAULTS.partThreshold
    : Math.min(MAX_PART_THRESHOLD, savedPartThreshold);
  blurVideos.checked = saved.blurVideos;
  tabCaptureButton.disabled = !saved.enabled;
  showThreshold();
  showPartThreshold();
}

chrome.storage.local.get(DEFAULTS).then(async (saved) => {
  await window.ClearSightPopupI18n.ready;
  savedPreferences = saved;
  if (saved.privacyConsent !== true) {
    consentPanel.hidden = false;
    settingsPanel.hidden = true;
    return;
  }
  consentPanel.hidden = true;
  settingsPanel.hidden = false;
  applySavedPreferences(saved);
  void refreshTabCapture();
});

consentAccept.addEventListener("change", () => {
  consentEnableButton.disabled = !consentAccept.checked;
});

consentEnableButton.addEventListener("click", async () => {
  if (!consentAccept.checked) return;
  consentEnableButton.disabled = true;
  try {
    await chrome.storage.local.set({ privacyConsent: true, enabled: true });
    consentStatus.removeAttribute("data-i18n");
    consentStatus.textContent = "";
    savedPreferences = { ...savedPreferences, privacyConsent: true, enabled: true };
    consentPanel.hidden = true;
    settingsPanel.hidden = false;
    applySavedPreferences(savedPreferences);
    setLocalizedText(status, "status.protection-on");
    void refreshTabCapture();
  } catch {
    consentEnableButton.disabled = false;
    setLocalizedText(consentStatus, "consent.save-failed");
  }
});

withdrawConsentButton.addEventListener("click", async () => {
  withdrawConsentButton.disabled = true;
  try {
    try { await chrome.runtime.sendMessage({ type: "tab-capture-stop" }); } catch { /* Capture may already be stopped. */ }
    await chrome.storage.local.set({ privacyConsent: false, enabled: false });
    savedPreferences = { ...savedPreferences, privacyConsent: false, enabled: false };
    consentAccept.checked = false;
    consentEnableButton.disabled = true;
    settingsPanel.hidden = true;
    consentPanel.hidden = false;
  } catch {
    setLocalizedText(status, "consent.withdraw-failed");
  } finally {
    withdrawConsentButton.disabled = false;
  }
});

async function refreshTabCapture(updateStatus = true) {
  try {
    const capture = await chrome.runtime.sendMessage({ type: "tab-capture-status" });
    tabCaptureButton.dataset.active = String(Boolean(capture?.active));
    setLocalizedText(tabCaptureButton, capture?.active ? "capture.stop" : "capture.enable");
    if (updateStatus) {
      setLocalizedText(status, capture?.active
        ? "capture.active"
        : capture?.protectionDisabled
          ? "capture.protection-needed"
        : capture?.permission
          ? "capture.off-can-enable"
          : "capture.needs-capture");
    }
  } catch {
    tabCaptureButton.dataset.active = "false";
    if (updateStatus) setLocalizedText(status, "capture.read-failed");
  }
}

tabCaptureButton.addEventListener("click", async () => {
  tabCaptureButton.disabled = true;
  try {
    if (tabCaptureButton.dataset.active === "true") {
      const result = await chrome.runtime.sendMessage({ type: "tab-capture-stop" });
      if (result?.error) throw new Error(result.error);
      setLocalizedText(status, "capture.stopped");
    } else {
      // Ask only after the user chooses to enable this tab's capture.
      const granted = await chrome.permissions.request({ permissions: ["tabCapture"] });
      if (!granted) {
        setLocalizedText(status, "capture.permission-denied");
        return;
      }
      const result = await chrome.runtime.sendMessage({ type: "tab-capture-start" });
      if (result?.error) throw new Error(result.error);
      setLocalizedText(status, "capture.started");
    }
  } catch {
    setLocalizedText(status, "capture.change-failed");
  } finally {
    await refreshTabCapture(false);
    tabCaptureButton.disabled = false;
  }
});

enabled.addEventListener("change", async () => {
  if (!enabled.checked) {
    try { await chrome.runtime.sendMessage({ type: "tab-capture-stop" }); } catch { /* Capture may already be stopped. */ }
  }
  await chrome.storage.local.set({ enabled: enabled.checked });
  tabCaptureButton.disabled = !enabled.checked;
  setLocalizedText(status, enabled.checked ? "status.enabled" : "status.paused");
  if (enabled.checked) void refreshTabCapture(false);
});

threshold.addEventListener("input", showThreshold);
threshold.addEventListener("change", () => chrome.storage.local.set({ threshold: Number(threshold.value) }));
partThreshold.addEventListener("input", showPartThreshold);
partThreshold.addEventListener("change", () => chrome.storage.local.set({ partThreshold: Number(partThreshold.value) }));
blurVideos.addEventListener("change", () => chrome.storage.local.set({ blurVideos: blurVideos.checked }));
