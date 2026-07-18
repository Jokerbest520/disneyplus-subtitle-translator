document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const enabledToggle = document.getElementById('enabled-toggle');
  const modeSelect = document.getElementById('mode-select');
  const langSelect = document.getElementById('lang-select');
  const engineSelect = document.getElementById('engine-select');
  
  const apiKeysSection = document.getElementById('api-keys-section');
  const geminiKeyGroup = document.getElementById('gemini-key-group');
  const geminiKeyInput = document.getElementById('gemini-key');
  const openaiKeyGroup = document.getElementById('openai-key-group');
  const openaiKeyInput = document.getElementById('openai-key');
  const deeplKeyGroup = document.getElementById('deepl-key-group');
  const deeplKeyInput = document.getElementById('deepl-key');

  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeVal = document.getElementById('font-size-val');
  const bgOpacitySlider = document.getElementById('bg-opacity-slider');
  const bgOpacityVal = document.getElementById('bg-opacity-val');

  const colorDots = document.querySelectorAll('.color-dot');
  const customColorPicker = document.getElementById('custom-color-picker');

  // Default values
  const defaults = {
    enabled: true,
    mode: 'dual',
    targetLang: 'zh-CN',
    engine: 'google',
    geminiKey: '',
    openaiKey: '',
    deeplKey: '',
    fontSize: 20,
    textColor: '#ffcc00',
    bgOpacity: 0.4
  };

  let currentSettings = { ...defaults };

  // Load settings from storage
  chrome.storage.local.get(Object.keys(defaults), (result) => {
    currentSettings = { ...defaults, ...result };
    initializeUI();
  });

  // Init UI controls with loaded settings
  function initializeUI() {
    enabledToggle.checked = currentSettings.enabled;
    modeSelect.value = currentSettings.mode;
    langSelect.value = currentSettings.targetLang;
    engineSelect.value = currentSettings.engine;
    
    geminiKeyInput.value = currentSettings.geminiKey;
    openaiKeyInput.value = currentSettings.openaiKey;
    deeplKeyInput.value = currentSettings.deeplKey;

    fontSizeSlider.value = currentSettings.fontSize;
    fontSizeVal.textContent = `${currentSettings.fontSize}px`;

    // Convert decimal 0.4 to percentage 40
    const opacityPct = Math.round(currentSettings.bgOpacity * 100);
    bgOpacitySlider.value = opacityPct;
    bgOpacityVal.textContent = `${opacityPct}%`;

    // Initialize API Key groups visibility
    updateKeyGroupVisibility(currentSettings.engine);

    // Initialize subtitle text color dot active states
    updateColorDotsActive(currentSettings.textColor);
  }

  // Save utility
  function saveSetting(key, value) {
    currentSettings[key] = value;
    chrome.storage.local.set({ [key]: value });
  }

  // Engine change key visibility logic
  function updateKeyGroupVisibility(engine) {
    geminiKeyGroup.classList.add('hidden');
    openaiKeyGroup.classList.add('hidden');
    deeplKeyGroup.classList.add('hidden');
    apiKeysSection.classList.remove('hidden');

    if (engine === 'google') {
      apiKeysSection.classList.add('hidden');
    } else if (engine === 'gemini') {
      geminiKeyGroup.classList.remove('hidden');
    } else if (engine === 'openai') {
      openaiKeyGroup.classList.remove('hidden');
    } else if (engine === 'deepl') {
      deeplKeyGroup.classList.remove('hidden');
    }
  }

  // Active color dot visual update
  function updateColorDotsActive(activeColor) {
    let matched = false;
    colorDots.forEach(dot => {
      const dotColor = dot.getAttribute('data-color');
      if (dotColor.toLowerCase() === activeColor.toLowerCase()) {
        dot.classList.add('active');
        matched = true;
      } else {
        dot.classList.remove('active');
      }
    });

    if (!matched) {
      customColorPicker.value = activeColor;
    }
  }

  // Listeners
  enabledToggle.addEventListener('change', (e) => {
    saveSetting('enabled', e.target.checked);
  });

  modeSelect.addEventListener('change', (e) => {
    saveSetting('mode', e.target.value);
  });

  langSelect.addEventListener('change', (e) => {
    saveSetting('targetLang', e.target.value);
  });

  engineSelect.addEventListener('change', (e) => {
    const selectedEngine = e.target.value;
    saveSetting('engine', selectedEngine);
    updateKeyGroupVisibility(selectedEngine);
  });

  // API keys input with debounce or direct input on keyup
  geminiKeyInput.addEventListener('input', (e) => {
    saveSetting('geminiKey', e.target.value.trim());
  });

  openaiKeyInput.addEventListener('input', (e) => {
    saveSetting('openaiKey', e.target.value.trim());
  });

  deeplKeyInput.addEventListener('input', (e) => {
    saveSetting('deeplKey', e.target.value.trim());
  });

  // Slider change triggers
  fontSizeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    fontSizeVal.textContent = `${val}px`;
    saveSetting('fontSize', val);
  });

  bgOpacitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    bgOpacityVal.textContent = `${val}%`;
    saveSetting('bgOpacity', val / 100);
  });

  // Palette selectors
  colorDots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const selectedColor = e.target.getAttribute('data-color');
      updateColorDotsActive(selectedColor);
      saveSetting('textColor', selectedColor);
    });
  });

  customColorPicker.addEventListener('input', (e) => {
    const selectedColor = e.target.value;
    colorDots.forEach(dot => dot.classList.remove('active'));
    saveSetting('textColor', selectedColor);
  });
});
