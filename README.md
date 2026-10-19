# ClearSight

ClearSight is a Chromium Manifest V3 extension that covers likely explicit images and videos using bundled on-device NSFWJS and NudeNet models. Media is temporarily blurred before an eligible check starts. A clean result reveals it; a positive result is replaced with the bundled cover. If a check cannot finish, the media stays covered until it can be checked, you reveal it, or you turn Protection off.

## Install for development

1. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium browser.
2. Turn on Developer mode and choose **Load unpacked**.
3. Select this folder and refresh any website tabs that were already open.
4. Open the ClearSight popup to adjust protection and sensitivity.

ClearSight requests access to all sites because it scans page media, nearby link destinations, limited page labels and navigation/header text, and eligible embedded frames. Classification runs locally. ClearSight does not send page URLs, media, or classification results to a ClearSight server. When browser security rules block direct media analysis, the extension may request eligible media from its source using your browser session; the source site receives that request as it normally would. Optional tab capture works only after you grant Chrome's permission and enable it for the current tab. Captured video frames are analyzed locally and audio passes through so playback can continue.

On first use, ClearSight shows a data-use disclosure in its popup and stays inactive until you agree and enable Protection. You can pause Protection or withdraw consent from the popup.

## How coverage works

- Images and videos are blurred as soon as the page script can apply the extension's cover, before classification. Safe results are revealed. Unsafe results show the bundled `assets/unsafe-content.jpeg` cover. Clicking covered media reveals it for 15 seconds.
- CSS background images are covered when ClearSight discovers and checks them. Text outside a covered background stays visible.
- NSFWJS checks the `Porn` and `Hentai` classes. NudeNet 3's 320×320 model checks for exposed buttocks, breasts, genitalia, and anus when the NSFWJS result is not already positive. Still images with borderline scores can receive additional center-and-corner crop checks. GIFs are sampled while visible.
- Video checks run during focused, visible playback, with an immediate sample on playback and additional samples about every 600 ms. Two consecutive positive checks cover the video. NudeNet runs on alternating video samples to reduce inference load. Paused or inaccessible video may stay covered until a frame or poster can be analyzed.
- Known adult-site URLs, explicit URL paths, result links, and selected ad-creative URLs can be covered directly without waiting for a model result.

ClearSight can miss unsafe content or blur safe content by mistake. The NSFWJS threshold defaults to 77%; the exposed-body-part threshold defaults to 61%. Lower settings catch weaker detections and can also flag safe images. NudeNet applies category-specific minimums so lowering its slider does not make every detection equally permissive. No general-purpose model guarantees a particular precision or recall across every site.

## Privacy

When Protection is on, ClearSight reads page URLs, media sources and pixels, and nearby link destinations in order to decide what to cover. These values and classification results are processed locally in memory and are not sent to ClearSight or saved in extension storage. Your protection and threshold settings are saved in Chrome's local extension storage. Source sites may receive normal media requests, including requests made with your existing browser session when direct access is blocked. ClearSight does not use analytics or advertising services.

The NudeNet 3 checkpoint is distributed under AGPL-3.0; see `assets/models/nudenet/NUDENET_LICENSE.txt` before redistributing this project. See [privacy.html](privacy.html) for the full policy and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled software notices.
