// Default extension settings
let settings = {
  enabled: true,
  mode: 'dual', // 'dual' | 'only_translated'
  targetLang: 'zh-CN', // 'zh-CN' | 'zh-TW'
  engine: 'google', // 'google' | 'gemini' | 'deepl' | 'openai'
  geminiKey: '',
  openaiKey: '',
  deeplKey: '',
  fontSize: 22,
  textColor: '#ffcc00', // Highly readable yellow
  bgOpacity: 0.4
};

// Platform-specific selectors for Disney+
const containerSelectors = [
  ".dss-subtitle-renderer-wrapper",
  ".dss-subtitle-renderer-cue-window",
  ".dss-subtitle-renderer-cue-container",
  ".btm-media-client-subtitle-window",
  "[class*='subtitle-renderer']",
  "[class*='SubtitleRenderer']",
  ".shaka-text-container" // fallback
];

let lastOriginalText = '';
let overlay = null;
let pollInterval = null;

// Walk regular DOM + open shadow roots using DFS
function* walkAllElements(root = document) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.nodeType === 1) { // Element node
      yield node;
      if (node.shadowRoot) {
        stack.push(node.shadowRoot);
      }
    }
    const children = node.children || node.childNodes;
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }
}

// Find all video elements on the page (penetrates open shadow roots)
function getVideos() {
  const videos = [];
  for (const el of walkAllElements(document)) {
    if (el.tagName === "VIDEO") {
      videos.push(el);
    }
  }
  return videos;
}

// Check if an element lies inside the boundaries of a playing video element
function isInsideVideoRegion(el, videos) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  for (const v of videos) {
    const vr = v.getBoundingClientRect();
    if (vr.width < 200 || vr.height < 150) continue;
    
    // Check if element is horizontally aligned inside the video, and vertically overlaps
    const overlapsX = r.left >= vr.left - 50 && r.right <= vr.right + 50;
    const overlapsY = r.top >= vr.top && r.bottom <= vr.bottom + 50;
    if (overlapsX && overlapsY) return true;
  }
  return false;
}

// Look for active subtitles using targeted selectors
function findSubtitleText() {
  const joined = containerSelectors.join(", ");
  const allElements = [];
  
  // Find matches in main document
  try {
    document.querySelectorAll(joined).forEach(el => allElements.push(el));
  } catch (_) {}
  
  // Find matches in all open shadow roots
  for (const el of walkAllElements(document)) {
    if (el.shadowRoot) {
      try {
        el.shadowRoot.querySelectorAll(joined).forEach(x => allElements.push(x));
      } catch (_) {}
    }
  }
  
  // Keep only innermost leaf elements
  const leaves = allElements.filter(el => 
    !allElements.some(other => other !== el && el.contains(other))
  );
  
  // Check visibility and alignment with video region
  const videos = getVideos();
  const visibleSubElements = leaves.filter(el => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    
    // Allow opacity:0 if we are the ones hiding the native subtitles
    if (parseFloat(style.opacity || "1") === 0) {
      if (!document.getElementById("disney-translator-hide-native")) return false;
    }
    
    return isInsideVideoRegion(el, videos);
  });
  
  const seenTexts = new Set();
  const texts = [];
  for (const el of visibleSubElements) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (seenTexts.has(t)) continue;
    seenTexts.add(t);
    texts.push(t);
  }
  
  return texts.join("\n").trim();
}

// Hide the native player subtitles to prevent overlap
function hideNativeSubtitles(on) {
  const styleId = "disney-translator-hide-native";
  let el = document.getElementById(styleId);
  if (!on) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  
  el = document.createElement("style");
  el.id = styleId;
  const selectors = containerSelectors.filter(Boolean).join(", ");
  el.textContent = selectors ? `${selectors} { opacity: 0 !important; }` : "";
  document.documentElement.appendChild(el);
}

// Get the root container for rendering our custom subtitle overlay
function getOverlayTarget() {
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.documentElement;
}

// Ensure the custom overlay exists on the correct DOM level
function ensureOverlay() {
  const target = getOverlayTarget();
  if (overlay && overlay.isConnected && overlay.parentElement === target) {
    return overlay;
  }
  
  if (overlay) {
    overlay.remove();
  }
  
  overlay = document.createElement("div");
  overlay.id = "disney-translator-overlay";
  overlay.className = "disney-translator-overlay";
  overlay.innerHTML = `
    <div class="disney-translated-line"></div>
    <div class="disney-original-line"></div>
  `;
  target.appendChild(overlay);
  return overlay;
}

// Re-position the custom overlay relative to the playing video's screen coordinates
function positionOverlayToVideo() {
  if (!overlay) return;
  const videos = getVideos();
  const activeVideo = videos.find(v => !v.paused && v.readyState >= 2) || videos[0];
  if (!activeVideo) return;

  const vr = activeVideo.getBoundingClientRect();
  if (vr.width < 100 || vr.height < 100) return;

  const centerX = vr.left + vr.width / 2;
  const bottomOffset = window.innerHeight - vr.bottom + Math.max(16, vr.height * 0.08);

  overlay.style.setProperty('left', `${centerX}px`, 'important');
  overlay.style.setProperty('bottom', `${bottomOffset}px`, 'important');
  overlay.style.setProperty('max-width', `${Math.min(vr.width * 0.92, window.innerWidth * 0.92)}px`, 'important');
}

// Re-render text contents and style properties inside our custom overlay
function renderOverlay(translatedText, originalText) {
  if (!settings.enabled) {
    if (overlay) overlay.style.display = "none";
    hideNativeSubtitles(false);
    return;
  }
  
  const hasText = translatedText || originalText;
  const ov = ensureOverlay();
  ov.style.display = hasText ? "flex" : "none";

  const tEl = ov.querySelector(".disney-translated-line");
  const oEl = ov.querySelector(".disney-original-line");

  tEl.textContent = translatedText || "";
  
  if (settings.mode === 'dual' && originalText) {
    oEl.style.display = "block";
    oEl.textContent = originalText;
  } else {
    oEl.style.display = "none";
    oEl.textContent = "";
  }

  // Scale font sizes based on video height (reference: 1080p height)
  // Scale font sizes based on video height (reference: 1080p height for desktop, 400p for mobile)
  let scale = 1;
  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
  const videos = getVideos();
  const activeVideo = videos.find(v => !v.paused && v.readyState >= 2) || videos[0];
  if (activeVideo) {
    const h = activeVideo.getBoundingClientRect().height;
    if (h > 0) {
      if (isMobile) {
        scale = Math.max(0.7, Math.min(2.5, h / 400));
      } else {
        scale = Math.max(0.5, Math.min(3.0, h / 1080));
      }
    }
  }
  
  const baseSize = settings.fontSize || 22;
  const sz = baseSize * scale;

  tEl.style.fontSize = `${sz}px`;
  tEl.style.color = settings.textColor;
  tEl.style.backgroundColor = `rgba(0, 0, 0, ${settings.bgOpacity})`;

  oEl.style.fontSize = `${Math.round(sz * 0.65)}px`;
}

// Load configurations from storage
function loadSettings(callback) {
  chrome.storage.local.get(Object.keys(settings), (result) => {
    settings = { ...settings, ...result };
    if (callback) callback();
  });
}

// Core subtitle processor: triggers translation on change
async function handleSubtitleChange(originalText) {
  if (!settings.enabled) {
    if (overlay) overlay.style.display = "none";
    hideNativeSubtitles(false);
    return;
  }
  
  if (!originalText) {
    lastOriginalText = '';
    renderOverlay('', '');
    return;
  }

  // De-duplicate repeats
  if (originalText === lastOriginalText) {
    return;
  }
  
  lastOriginalText = originalText;
  console.log('Disney+ Translator: Original subtitle text detected:', originalText);

  // Resolve correct API key based on engine
  const apiKey = settings.engine === 'gemini' ? settings.geminiKey
               : settings.engine === 'openai' ? settings.openaiKey
               : settings.engine === 'deepl' ? settings.deeplKey : '';

  // Request translation from the background worker (which bypasses CORS)
  chrome.runtime.sendMessage({
    action: 'translate',
    text: originalText,
    engine: settings.engine,
    apiKey: apiKey,
    targetLang: settings.targetLang
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Disney+ Translator: Extension message error:', chrome.runtime.lastError);
      return;
    }

    if (response && response.success && response.translation) {
      console.log('Disney+ Translator: Translation completed:', response.translation);
      renderOverlay(response.translation, originalText);
    } else if (response && !response.success) {
      console.error('Disney+ Translator: Translation request failed:', response.error);
    }
  });
}

// Start subtitle checking loops
function startObserving() {
  if (pollInterval) clearInterval(pollInterval);
  
  hideNativeSubtitles(true);
  
  pollInterval = setInterval(() => {
    const text = findSubtitleText();
    handleSubtitleChange(text);
    positionOverlayToVideo();
  }, 200);
}

// Stop subtitle checking loops
function stopObserving() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  
  hideNativeSubtitles(false);
  if (overlay) overlay.style.display = "none";
  lastOriginalText = '';
}

// Fullscreen event listener handler
function onFullscreenChange() {
  if (!overlay) return;
  const target = getFullscreenTarget();
  if (overlay.parentElement !== target) {
    target.appendChild(overlay);
  }
}

// Setup extension runtime listeners
function init() {
  console.log('Disney+ Translator: Subtitle viewport overlay script initialized.');
  
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("mozfullscreenchange", onFullscreenChange);

  loadSettings(() => {
    // Monitor storage updates
    chrome.storage.onChanged.addListener((changes) => {
      let activeStateChanged = false;
      
      for (let [key, { newValue }] of Object.entries(changes)) {
        settings[key] = newValue;
        if (key === 'enabled') {
          activeStateChanged = true;
        }
      }
      
      // Update running loops and native subtitles styles
      const isActive = !!settings.enabled;
      hideNativeSubtitles(isActive);
      if (isActive) {
        startObserving();
      } else {
        stopObserving();
      }
      
      // Force overlay re-rendering to apply styles immediately
      if (overlay && overlay.style.display !== "none") {
        renderOverlay(overlay.querySelector('.disney-translated-line').textContent, lastOriginalText);
      }
    });

    const isActive = !!settings.enabled;
    if (isActive) {
      startObserving();
    }
  });
}

init();
