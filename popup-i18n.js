(() => {
  const messages = {
    en: {
      "common.language": "Language",
      "popup.title": "ClearSight",
      "popup.tagline": "Private, on-device content blur",
      "consent.title": "Before Protection starts",
      "consent.description": "To cover unwanted content, ClearSight reads the current page URL, media URLs and pixels, nearby link destinations, and limited page labels and navigation text, including in eligible embedded frames. It checks them locally while Protection is on. This page information and results are not sent to ClearSight or saved in extension storage. Your settings are saved in Chrome's local extension storage.",
      "consent.source-note": "If a site blocks direct media access, ClearSight may request eligible media from its source using your browser session. That site receives the request.",
      "consent.agreement": "I agree to this local processing so ClearSight can check page content.",
      "consent.enable": "Agree and enable Protection",
      "consent.dismiss": "You can close this popup without enabling ClearSight. Protection stays off until you agree.",
      "consent.withdraw": "Withdraw consent and disable ClearSight",
      "consent.save-failed": "Could not save your choice. Try again.",
      "consent.withdraw-failed": "Could not withdraw consent. Try again.",
      "accuracy.caution": "ClearSight can miss unsafe content or cover safe content by mistake. Model scores are not accuracy guarantees.",
      "policy.read": "Read the full privacy policy",
      "privacy.notice": "With Protection on, ClearSight reads page URLs, media and nearby links to check content locally. This page information and the results are not sent to ClearSight or saved in extension storage.",
      "toggle.protection": "Protection",
      "capture.enable": "Enable video capture for this tab",
      "capture.stop": "Stop video capture for this tab",
      "capture.hint": "Use this when a site blocks video frame access. Capture is local to this tab and passes audio through.",
      "threshold.explicit.title": "NSFW score threshold",
      "threshold.explicit.hint": "Default: 77%. NSFWJS checks explicit-image scores, then NudeNet checks exposed body parts. Still images may receive extra center and corner crop checks. Videos need two positive checks before the cover is applied; NudeNet checks alternate frames.",
      "threshold.body.title": "Exposed-body-part threshold",
      "threshold.body.hint": "Default: 61%. Lower settings catch weaker body-part detections and can also flag safe images.",
      "toggle.videos": "Check videos during playback",
      "video.hint": "Video checks run during focused, visible playback, starting with an immediate sample and continuing about every 600 ms. Checks pause with the video or tab. Visible GIFs are checked about every second while Protection is on. Inaccessible or paused media can remain covered until a usable frame or poster is available.",
      "status.local": "Media is analyzed on this device.",
      "status.protection-on": "Protection is on. Page content is checked locally.",
      "status.paused": "Protection is paused.",
      "status.enabled": "Protection is on.",
      "capture.active": "Video capture is active for this tab. Protected frames can be analyzed locally.",
      "capture.protection-needed": "Turn Protection on to use video capture for this tab.",
      "capture.off-can-enable": "Video capture is off for this tab. Enable it if the site blocks video frames.",
      "capture.needs-capture": "Protected video frames may need capture. Enable it here to grant access for this tab.",
      "capture.read-failed": "Could not read this tab's video-capture status.",
      "capture.stopped": "Video capture stopped.",
      "capture.permission-denied": "Tab capture permission was not granted; protected video frames may remain unanalyzed.",
      "capture.started": "This tab is captured locally; video is analyzed and audio is passed through to preserve playback.",
      "capture.change-failed": "Could not change video capture.",
      "privacy.summary": "Privacy & website access",
      "privacy.access1": "ClearSight needs access to websites you visit to read page URLs, media sources and pixels, and nearby link destinations for images, thumbnails, GIFs, CSS backgrounds, and videos, including eligible embedded frames. Scanning runs while Protection is on. These values and classifier results are processed in memory and are not sent to ClearSight or saved in extension storage.",
      "privacy.access2": "The bundled NSFWJS and NudeNet models analyze media on this device. For protected cross-origin media, the extension may request it from its source website using your browser session; that site receives the normal request.",
      "privacy.access3": "Optional tab capture is only used after you enable it and grant Chrome permission. Captured frames and audio stay local; audio is passed through to keep playback working.",
      "support.aria": "Support ClearSight",
      "support.title": "Enjoying ClearSight?",
      "support.description": "Help this private project grow.",
      "support.link": "Support on Ko-fi",
      "project.source": "Looking for the project's open-source code?",
      "project.github": "Visit my GitHub."
    },
    fr: {
      "common.language": "Langue",
      "popup.title": "ClearSight",
      "popup.tagline": "Floutage privé, directement sur l’appareil",
      "consent.title": "Avant d’activer la protection",
      "consent.description": "Pour masquer les contenus indésirables, ClearSight lit l’URL de la page actuelle, les URL et pixels des médias, les destinations des liens proches ainsi que certaines étiquettes et certains textes de navigation, y compris dans les cadres intégrés compatibles. Lorsque la protection est activée, ces éléments sont vérifiés localement. Les informations de page et les résultats ne sont ni envoyés à ClearSight ni enregistrés dans le stockage de l’extension. Vos paramètres sont enregistrés dans le stockage local de Chrome.",
      "consent.source-note": "Si un site bloque l’accès direct à un média, ClearSight peut demander le média compatible à son site source en utilisant votre session de navigation. Ce site reçoit alors la requête.",
      "consent.agreement": "J’accepte ce traitement local afin que ClearSight puisse vérifier le contenu des pages.",
      "consent.enable": "Accepter et activer la protection",
      "consent.dismiss": "Vous pouvez fermer cette fenêtre sans activer ClearSight. La protection restera désactivée jusqu’à votre accord.",
      "consent.withdraw": "Retirer mon consentement et désactiver ClearSight",
      "consent.save-failed": "Impossible d’enregistrer votre choix. Réessayez.",
      "consent.withdraw-failed": "Impossible de retirer votre consentement. Réessayez.",
      "accuracy.caution": "ClearSight peut manquer des contenus dangereux ou masquer par erreur des contenus sans danger. Les scores du modèle ne garantissent pas l’exactitude.",
      "policy.read": "Lire la politique de confidentialité complète",
      "privacy.notice": "Lorsque la protection est activée, ClearSight lit les URL des pages, les médias et les liens proches pour vérifier le contenu localement. Ces informations et résultats ne sont ni envoyés à ClearSight ni enregistrés dans le stockage de l’extension.",
      "toggle.protection": "Protection",
      "capture.enable": "Activer la capture vidéo pour cet onglet",
      "capture.stop": "Arrêter la capture vidéo de cet onglet",
      "capture.hint": "Utilisez cette option si un site bloque l’accès aux images vidéo. La capture reste locale à cet onglet et le son continue de passer.",
      "threshold.explicit.title": "Seuil du score de contenu explicite",
      "threshold.explicit.hint": "Par défaut : 77 %. NSFWJS vérifie les scores d’images explicites, puis NudeNet détecte les parties du corps découvertes. Les images fixes peuvent aussi être vérifiées avec des recadrages supplémentaires au centre et dans les coins. Deux détections positives sont nécessaires pour masquer une vidéo ; NudeNet vérifie des images alternées.",
      "threshold.body.title": "Seuil des parties du corps découvertes",
      "threshold.body.hint": "Par défaut : 61 %. Un seuil plus bas détecte les signaux corporels plus faibles, mais peut aussi signaler des images sans danger.",
      "toggle.videos": "Vérifier les vidéos pendant leur lecture",
      "video.hint": "Les vidéos sont vérifiées pendant une lecture visible et active : un premier échantillon est pris immédiatement, puis environ toutes les 600 ms. Les vérifications s’arrêtent lorsque la vidéo ou l’onglet est en pause ou inactif. Les GIF visibles sont vérifiés environ chaque seconde lorsque la protection est activée. Les médias inaccessibles ou en pause peuvent rester masqués jusqu’à ce qu’une image ou une miniature exploitable soit disponible.",
      "status.local": "Les médias sont analysés sur cet appareil.",
      "status.protection-on": "La protection est activée. Le contenu des pages est vérifié localement.",
      "status.paused": "La protection est en pause.",
      "status.enabled": "La protection est activée.",
      "capture.active": "La capture vidéo est active pour cet onglet. Les images protégées peuvent être analysées localement.",
      "capture.protection-needed": "Activez la protection pour utiliser la capture vidéo dans cet onglet.",
      "capture.off-can-enable": "La capture vidéo est désactivée pour cet onglet. Activez-la si le site bloque les images vidéo.",
      "capture.needs-capture": "Certaines images vidéo protégées peuvent nécessiter une capture. Activez-la ici pour autoriser cet onglet.",
      "capture.read-failed": "Impossible de lire l’état de capture vidéo de cet onglet.",
      "capture.stopped": "La capture vidéo est arrêtée.",
      "capture.permission-denied": "L’autorisation de capture de l’onglet n’a pas été accordée ; certaines images protégées peuvent ne pas être analysées.",
      "capture.started": "Cet onglet est capturé localement ; la vidéo est analysée et le son est transmis pour préserver la lecture.",
      "capture.change-failed": "Impossible de modifier la capture vidéo.",
      "privacy.summary": "Confidentialité et accès aux sites",
      "privacy.access1": "ClearSight a besoin d’accéder aux sites que vous visitez pour lire les URL des pages, les sources et pixels des médias, ainsi que les destinations des liens proches pour les images, miniatures, GIF, arrière-plans CSS et vidéos, y compris certains cadres intégrés compatibles. L’analyse a lieu lorsque la protection est activée. Ces données et les résultats de classification sont traités en mémoire ; ils ne sont ni envoyés à ClearSight ni enregistrés dans le stockage de l’extension.",
      "privacy.access2": "Les modèles NSFWJS et NudeNet fournis analysent les médias sur cet appareil. Pour les médias protégés provenant d’un autre domaine, l’extension peut les demander au site source en utilisant votre session de navigation ; ce site reçoit une requête normale.",
      "privacy.access3": "La capture facultative d’un onglet est utilisée uniquement après son activation et l’autorisation de Chrome. Les images capturées et le son restent locaux ; le son est transmis pour que la lecture continue.",
      "support.aria": "Soutenir ClearSight",
      "support.title": "ClearSight vous plaît ?",
      "support.description": "Aidez ce projet indépendant à grandir.",
      "support.link": "Soutenir sur Ko-fi",
      "project.source": "Vous cherchez le code source ouvert du projet ?",
      "project.github": "Visitez mon GitHub."
    },
    es: {
      "common.language": "Idioma",
      "popup.title": "ClearSight",
      "popup.tagline": "Desenfoque privado, en el dispositivo",
      "consent.title": "Antes de activar la protección",
      "consent.description": "Para ocultar contenido no deseado, ClearSight lee la URL de la página actual, las URL y los píxeles de los medios, los destinos de enlaces cercanos y algunas etiquetas y texto de navegación de la página, incluso en determinados marcos integrados. Comprueba estos datos localmente mientras la protección está activada. La información de la página y los resultados no se envían a ClearSight ni se guardan en el almacenamiento de la extensión. La configuración se guarda en el almacenamiento local de Chrome.",
      "consent.source-note": "Si un sitio bloquea el acceso directo a un medio, ClearSight puede solicitarlo desde el sitio de origen mediante la sesión del navegador. Ese sitio recibe la solicitud.",
      "consent.agreement": "Acepto este procesamiento local para que ClearSight pueda comprobar el contenido de las páginas.",
      "consent.enable": "Aceptar y activar la protección",
      "consent.dismiss": "Puedes cerrar esta ventana sin activar ClearSight. La protección seguirá desactivada hasta que aceptes.",
      "consent.withdraw": "Retirar el consentimiento y desactivar ClearSight",
      "consent.save-failed": "No se pudo guardar tu elección. Inténtalo de nuevo.",
      "consent.withdraw-failed": "No se pudo retirar el consentimiento. Inténtalo de nuevo.",
      "accuracy.caution": "ClearSight puede no detectar contenido no seguro o desenfocar contenido seguro por error. Las puntuaciones del modelo no garantizan la precisión.",
      "policy.read": "Leer la política de privacidad completa",
      "privacy.notice": "Con la protección activada, ClearSight lee las URL de las páginas, los medios y los enlaces cercanos para comprobar el contenido localmente. Esta información y los resultados no se envían a ClearSight ni se guardan en el almacenamiento de la extensión.",
      "toggle.protection": "Protección",
      "capture.enable": "Activar captura de vídeo para esta pestaña",
      "capture.stop": "Detener la captura de vídeo de esta pestaña",
      "capture.hint": "Usa esta opción si un sitio bloquea el acceso a los fotogramas del vídeo. La captura es local a esta pestaña y el audio sigue reproduciéndose.",
      "threshold.explicit.title": "Umbral de contenido explícito",
      "threshold.explicit.hint": "Valor predeterminado: 77 %. NSFWJS comprueba las puntuaciones de imágenes explícitas y después NudeNet detecta partes del cuerpo expuestas. Las imágenes fijas también pueden comprobarse con recortes adicionales del centro y las esquinas. Se necesitan dos comprobaciones positivas para cubrir un vídeo; NudeNet analiza fotogramas alternos.",
      "threshold.body.title": "Umbral de partes del cuerpo expuestas",
      "threshold.body.hint": "Valor predeterminado: 61 %. Un valor más bajo detecta señales corporales menos intensas, pero también puede marcar imágenes seguras.",
      "toggle.videos": "Comprobar vídeos durante la reproducción",
      "video.hint": "Los vídeos se comprueban durante la reproducción visible y activa: se toma una muestra inmediata y después otra cada 600 ms aproximadamente. Las comprobaciones se pausan con el vídeo o la pestaña. Los GIF visibles se comprueban aproximadamente cada segundo cuando la protección está activada. Los medios inaccesibles o pausados pueden seguir cubiertos hasta que haya un fotograma o una miniatura que se pueda analizar.",
      "status.local": "Los medios se analizan en este dispositivo.",
      "status.protection-on": "La protección está activada. El contenido de la página se comprueba localmente.",
      "status.paused": "La protección está en pausa.",
      "status.enabled": "La protección está activada.",
      "capture.active": "La captura de vídeo está activa para esta pestaña. Los fotogramas protegidos pueden analizarse localmente.",
      "capture.protection-needed": "Activa la protección para usar la captura de vídeo en esta pestaña.",
      "capture.off-can-enable": "La captura de vídeo está desactivada en esta pestaña. Actívala si el sitio bloquea los fotogramas.",
      "capture.needs-capture": "Es posible que algunos fotogramas protegidos necesiten captura. Actívala aquí para dar acceso a esta pestaña.",
      "capture.read-failed": "No se pudo leer el estado de captura de vídeo de esta pestaña.",
      "capture.stopped": "Se detuvo la captura de vídeo.",
      "capture.permission-denied": "No se concedió el permiso para capturar la pestaña; es posible que algunos fotogramas protegidos no se analicen.",
      "capture.started": "Esta pestaña se captura localmente; el vídeo se analiza y el audio continúa para mantener la reproducción.",
      "capture.change-failed": "No se pudo cambiar la captura de vídeo.",
      "privacy.summary": "Privacidad y acceso a sitios web",
      "privacy.access1": "ClearSight necesita acceso a los sitios que visitas para leer las URL de las páginas, las fuentes y los píxeles de los medios, y los destinos de enlaces cercanos a imágenes, miniaturas, GIF, fondos CSS y vídeos, incluidos determinados marcos integrados. El análisis se realiza mientras la protección está activada. Estos datos y los resultados de clasificación se procesan en memoria; no se envían a ClearSight ni se guardan en el almacenamiento de la extensión.",
      "privacy.access2": "Los modelos NSFWJS y NudeNet incluidos analizan los medios en este dispositivo. Para medios protegidos de otro origen, la extensión puede solicitarlos al sitio de origen mediante la sesión del navegador; ese sitio recibe una solicitud normal.",
      "privacy.access3": "La captura opcional de pestañas solo se usa después de que la actives y concedas permiso a Chrome. Los fotogramas y el audio capturados permanecen locales; el audio sigue reproduciéndose para que el vídeo funcione.",
      "support.aria": "Apoyar a ClearSight",
      "support.title": "¿Te gusta ClearSight?",
      "support.description": "Ayuda a crecer a este proyecto independiente.",
      "support.link": "Apoyar en Ko-fi",
      "project.source": "¿Buscas el código fuente abierto del proyecto?",
      "project.github": "Visita mi GitHub."
    },
    ar: {
      "common.language": "اللغة",
      "popup.title": "ClearSight",
      "popup.tagline": "حجب خاص للمحتوى على جهازك",
      "consent.title": "قبل بدء الحماية",
      "consent.description": "لحجب المحتوى غير المرغوب فيه، تقرأ ClearSight عنوان الصفحة الحالي وروابط الوسائط وبيانات صورها ووجهات الروابط القريبة، إضافةً إلى بعض تسميات الصفحة ونصوص التنقل، بما في ذلك الإطارات المضمّنة المؤهلة. تُفحص هذه البيانات محليًا أثناء تشغيل الحماية. لا تُرسل معلومات الصفحة أو النتائج إلى ClearSight ولا تُحفظ في مساحة تخزين الإضافة. تُحفظ إعداداتك في مساحة التخزين المحلية في Chrome.",
      "consent.source-note": "إذا منع أحد المواقع الوصول المباشر إلى الوسائط، فقد تطلب ClearSight الوسائط المؤهلة من موقعها الأصلي باستخدام جلسة المتصفح. سيتلقى ذلك الموقع الطلب.",
      "consent.agreement": "أوافق على هذه المعالجة المحلية كي تتمكن ClearSight من فحص محتوى الصفحات.",
      "consent.enable": "أوافق وأفعّل الحماية",
      "consent.dismiss": "يمكنك إغلاق هذه النافذة دون تفعيل ClearSight. ستظل الحماية متوقفة حتى توافق.",
      "consent.withdraw": "سحب الموافقة وتعطيل ClearSight",
      "consent.save-failed": "تعذر حفظ اختيارك. حاول مرة أخرى.",
      "consent.withdraw-failed": "تعذر سحب الموافقة. حاول مرة أخرى.",
      "accuracy.caution": "قد لا تكتشف ClearSight بعض المحتوى غير الآمن، أو قد تحجب محتوى آمنًا عن طريق الخطأ. نتائج النموذج لا تضمن الدقة.",
      "policy.read": "قراءة سياسة الخصوصية كاملةً",
      "privacy.notice": "عند تشغيل الحماية، تقرأ ClearSight عناوين الصفحات والوسائط والروابط القريبة لفحص المحتوى محليًا. لا تُرسل هذه المعلومات والنتائج إلى ClearSight ولا تُحفظ في مساحة تخزين الإضافة.",
      "toggle.protection": "الحماية",
      "capture.enable": "تفعيل التقاط الفيديو في علامة التبويب هذه",
      "capture.stop": "إيقاف التقاط الفيديو في علامة التبويب هذه",
      "capture.hint": "استخدم هذا الخيار إذا منع موقعٌ ما الوصول إلى إطارات الفيديو. يقتصر الالتقاط على علامة التبويب هذه محليًا ويستمر تمرير الصوت.",
      "threshold.explicit.title": "حدّ درجة المحتوى الصريح",
      "threshold.explicit.hint": "الافتراضي: 77٪. يفحص NSFWJS درجات الصور الصريحة، ثم يكشف NudeNet أجزاء الجسم المكشوفة. قد تُفحص الصور الثابتة أيضًا باقتصاصات إضافية من الوسط والزوايا. يلزم فحصان إيجابيان قبل حجب الفيديو؛ ويفحص NudeNet إطارات متبادلة.",
      "threshold.body.title": "حدّ كشف أجزاء الجسم المكشوفة",
      "threshold.body.hint": "الافتراضي: 61٪. تلتقط الإعدادات الأقل مؤشرات أضعف لأجزاء الجسم، وقد تصنّف صورًا آمنة أيضًا.",
      "toggle.videos": "فحص الفيديو أثناء التشغيل",
      "video.hint": "يُفحص الفيديو أثناء التشغيل النشط والظاهر؛ تبدأ العملية بعينة فورية ثم تتكرر كل 600 مللي ثانية تقريبًا. يتوقف الفحص عند إيقاف الفيديو أو علامة التبويب. تُفحص صور GIF الظاهرة كل ثانية تقريبًا أثناء تشغيل الحماية. قد يظل الوسيط غير المتاح أو المتوقف محجوبًا حتى يتوفر إطار أو ملصق قابل للفحص.",
      "status.local": "تُحلَّل الوسائط على هذا الجهاز.",
      "status.protection-on": "الحماية قيد التشغيل. يُفحص محتوى الصفحة محليًا.",
      "status.paused": "الحماية متوقفة مؤقتًا.",
      "status.enabled": "الحماية قيد التشغيل.",
      "capture.active": "التقاط الفيديو نشط في علامة التبويب هذه. يمكن تحليل الإطارات المحمية محليًا.",
      "capture.protection-needed": "شغّل الحماية لاستخدام التقاط الفيديو في علامة التبويب هذه.",
      "capture.off-can-enable": "التقاط الفيديو متوقف في علامة التبويب هذه. فعّله إذا منع الموقع الوصول إلى إطارات الفيديو.",
      "capture.needs-capture": "قد تحتاج إطارات الفيديو المحمية إلى الالتقاط. فعّل هذا الخيار لمنح علامة التبويب هذه الإذن.",
      "capture.read-failed": "تعذرت قراءة حالة التقاط الفيديو لعلامة التبويب هذه.",
      "capture.stopped": "توقف التقاط الفيديو.",
      "capture.permission-denied": "لم يُمنح إذن التقاط علامة التبويب؛ وقد يتعذر تحليل بعض إطارات الفيديو المحمية.",
      "capture.started": "يجري التقاط علامة التبويب هذه محليًا؛ ويُحلل الفيديو مع تمرير الصوت لمواصلة التشغيل.",
      "capture.change-failed": "تعذر تغيير إعداد التقاط الفيديو.",
      "privacy.summary": "الخصوصية وإمكانية الوصول إلى المواقع",
      "privacy.access1": "تحتاج ClearSight إلى الوصول إلى المواقع التي تزورها لقراءة عناوين الصفحات ومصادر الوسائط وبيانات صورها ووجهات الروابط القريبة للصور المصغرة وصور GIF وخلفيات CSS والفيديو، بما في ذلك بعض الإطارات المضمّنة المؤهلة. يجري الفحص أثناء تشغيل الحماية. تُعالج هذه القيم ونتائج التصنيف في الذاكرة، ولا تُرسل إلى ClearSight أو تُحفظ في مساحة تخزين الإضافة.",
      "privacy.access2": "تحلل نموذجا NSFWJS وNudeNet المضمّنان الوسائط على هذا الجهاز. وقد تطلب الإضافة الوسائط المحمية القادمة من نطاق آخر من موقعها الأصلي باستخدام جلسة المتصفح؛ ويتلقى ذلك الموقع طلبًا عاديًا.",
      "privacy.access3": "لا يُستخدم التقاط علامة التبويب الاختياري إلا بعد تفعيله ومنح Chrome الإذن. تبقى الإطارات والصوت الملتقطان محليين، ويستمر تمرير الصوت لمتابعة التشغيل.",
      "support.aria": "دعم ClearSight",
      "support.title": "هل تعجبك ClearSight؟",
      "support.description": "ساعد هذا المشروع المستقل على النمو.",
      "support.link": "الدعم عبر Ko-fi",
      "project.source": "هل تبحث عن الشيفرة المصدرية المفتوحة للمشروع؟",
      "project.github": "زُر GitHub الخاص بي."
    }
  };

  let currentLanguage = "en";
  const supported = new Set(Object.keys(messages));
  const normalize = (value) => supported.has(value) ? value : "en";
  const t = (key) => messages[currentLanguage][key] ?? messages.en[key] ?? key;
  function apply(language) {
    currentLanguage = normalize(language);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    return currentLanguage;
  }

  const select = document.querySelector("#language");
  const ready = (async () => {
    let language = "en";
    try {
      const saved = await chrome.storage.local.get({ language: "en" });
      language = normalize(saved.language);
    } catch { /* Keep the popup usable in English if local storage is unavailable. */ }
    apply(language);
    if (select) {
      select.value = language;
      select.addEventListener("change", async () => {
        const selected = apply(select.value);
        try {
          await chrome.storage.local.set({ language: selected });
        } catch {
          select.value = currentLanguage;
        }
      });
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.language) return;
      const selected = apply(changes.language.newValue);
      if (select) select.value = selected;
    });
    return currentLanguage;
  })();

  window.ClearSightPopupI18n = Object.freeze({ t, apply, ready });
})();
