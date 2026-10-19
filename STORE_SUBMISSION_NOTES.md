# Chrome Web Store submission notes

Use this draft when filling in the Chrome Web Store Developer Dashboard. Keep the final disclosures consistent with the extension and its hosted privacy policy.

## Single purpose

ClearSight helps users avoid unwanted explicit imagery while browsing by locally classifying and covering images, videos, GIFs, and CSS background images on websites they visit.

## Store listing draft

### Short description

Locally checks and covers potentially explicit images and videos as you browse.

### Full description

ClearSight helps reduce unwanted explicit imagery by checking images, animated GIFs, video frames, and CSS background images on websites you visit. It covers media while it is checked and reveals media that passes the selected thresholds. While Protection is on, it also uses scroll events locally to schedule media checks and clicks on covered media to reveal it for 15 seconds; it does not log or transmit these interactions.

Protection starts only after you review the disclosure, agree, and enable it. To provide this feature, ClearSight reads page URLs, eligible media URLs and pixels, nearby link destinations, limited page labels and navigation/header text, and local classification results. Analysis runs in your browser with models bundled in the extension. ClearSight does not send this page information or the results to its developer or a ClearSight server, save them in extension storage, sell them, or use them for advertising or analytics.

Some websites restrict direct access to media pixels. In those cases ClearSight may request eligible media from its source using your browser's existing session; that website or media host receives the request and applies its own privacy practices. Optional tab capture is used only after you enable it for the current tab; frames are analyzed locally and audio passes through for playback.

ClearSight can miss unsafe content or cover safe content by mistake. Its scores are not accuracy guarantees. You can change the thresholds, pause Protection, or withdraw consent in the extension popup.

Keep the listing screenshots, promotional images, and website neutral. Do not include explicit media or links to pornography.

## Dashboard data-use draft

Declare website content and resources and web-browsing activity. Also declare user activity because ClearSight uses scroll events to schedule checks and clicks on covered media to reveal it. The page URLs, media URLs and pixels, nearby link destinations, limited page labels/navigation text, classifier results, and these transient interaction events are used only for the disclosed content-covering feature, after the user agrees and enables Protection. Processing is local; ClearSight does not log or transmit these values to its developer, sell them, use them for advertising, or allow people to read them. When protected media must be requested from its source, that source receives a normal browser-session request. Keep the dashboard answers consistent with this listing, the in-product disclosure, and the hosted privacy policy.

## Permission justifications

- `storage`: saves the user's protection choice, sensitivity settings, consent choice, and settings-version migration state in Chrome local extension storage.
- `offscreen`: runs the bundled classifier and local media-processing work in an offscreen extension document.
- `<all_urls>` host access and matching content scripts: required for the user-facing protection feature to inspect page URLs, media sources and pixels, and nearby result links across the websites where the user chooses to browse. Eligible embedded frames are included. Scanning starts only after the user accepts the popup disclosure and enables Protection. The user can pause Protection or withdraw consent in the popup.
- Optional `tabCapture`: requested only after the user chooses to capture the current tab. It lets ClearSight analyze video frames on sites that block direct frame access. It is stopped when Protection is disabled or consent is withdrawn.

## Remote code

Select **No, I am not using remote code**. The JavaScript runtime and models are bundled with the extension. Remote requests are limited to eligible media from the website being viewed when browser security rules prevent direct analysis; ClearSight does not download or execute remote JavaScript.

## Data use disclosure

ClearSight handles web browsing activity and website content/resources, including the current page URL, eligible media URLs and pixels, nearby link destinations, and local classifier results. It also uses scroll events to schedule media checks and clicks on covered media to reveal it for 15 seconds. These interactions are not logged or transmitted. Declare web-browsing activity, website content/resources, and user activity in the dashboard. Processing is local; ClearSight does not send these values to the developer or a ClearSight server, sell them, use them for advertising, or let people read them. Protection and sensitivity settings are stored locally. When inaccessible media must be fetched, the source website may receive a request made with the browser's existing session. Certify the Limited Use disclosures only after checking them against the final build and hosted privacy policy.

## Detection limitations

The popup and privacy policy disclose that ClearSight can miss unsafe content or cover safe content by mistake. You reported 95% detection of unsafe items and 7% false positives on your check. Only publish those figures if you can state the dataset, sample size, thresholds, and test method; describe them as results from that test set, not general accuracy guarantees.

## Before submission

1. **Your account action:** publish `privacy.html` and `privacy.css` together at a stable public HTTPS URL, then enter that URL in the dashboard's privacy-policy field. The local extension page is not a public policy URL.
2. **Your account action:** fill in the Store listing using the draft above, including the single purpose, the fact that it scans pages you visit, and the types of data it accesses. Add the required icon and screenshots; use neutral screenshots and promotional art.
3. **Your account action:** complete the dashboard fields for permission justifications, remote code, data use, maturity, distribution, and listing assets. Set the Mature content flag because ClearSight includes adult-site-specific media masking. Select “No” for remote code: the runtime and models are bundled, and media requests do not download or execute code. Justify `<all_urls>` as required for the user-facing scanning feature. Verify every privacy answer against the final package and hosted policy.
4. **Before redistributing:** review the NudeNet model's AGPL-3.0 terms and confirm how you will satisfy any applicable source and notice requirements. The license text is included at `assets/models/nudenet/NUDENET_LICENSE.txt`; the license notice alone does not establish that all redistribution obligations are met.
5. **Final release check:** test the packaged extension in Chrome, including first-use consent, declining consent, enable/pause/withdraw, safe and unsafe image/video results, inaccessible media, and optional tab capture. You reported checking detection results; don't put the 95%/7% figures in the listing unless you can describe the dataset and test method accurately.
