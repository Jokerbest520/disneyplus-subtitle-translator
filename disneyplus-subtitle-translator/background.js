// Translation cache to avoid redundant API requests and save costs/rate limits
const CACHE_LIMIT = 500;
const translationCache = new Map();

function getCacheKey(engine, targetLang, text) {
  return `${engine}:${targetLang}:${text.trim()}`;
}

function setCache(key, value) {
  if (translationCache.size >= CACHE_LIMIT) {
    // Delete oldest item (first key)
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

// Listener for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, engine, apiKey, targetLang } = request;
    
    if (!text || !text.trim()) {
      sendResponse({ success: true, translation: '' });
      return true;
    }

    const cacheKey = getCacheKey(engine, targetLang, text);
    if (translationCache.has(cacheKey)) {
      sendResponse({ success: true, translation: translationCache.get(cacheKey) });
      return true;
    }

    // Call appropriate translation service
    translateText(text, engine, apiKey, targetLang)
      .then(translatedText => {
        setCache(cacheKey, translatedText);
        sendResponse({ success: true, translation: translatedText });
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keeps the message channel open for asynchronous response
  }
});

async function translateText(text, engine, apiKey, targetLang) {
  const targetLangLabel = targetLang === 'zh-TW' ? '繁体中文 (Traditional Chinese)' : '简体中文 (Simplified Chinese)';

  switch (engine) {
    case 'gemini':
      return await translateGemini(text, apiKey, targetLangLabel);
    case 'deepl':
      return await translateDeepL(text, apiKey, targetLang);
    case 'openai':
      return await translateOpenAI(text, apiKey, targetLangLabel);
    case 'google':
    default:
      return await translateGoogle(text, targetLang);
  }
}

// 1. Google Translate (Free API)
async function translateGoogle(text, targetLang) {
  const tl = targetLang === 'zh-TW' ? 'zh-TW' : 'zh-CN';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${tl}&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google API returned status ${response.status}`);
  }
  
  const data = await response.json();
  if (data && data[0]) {
    // Map and join all sentences in case there are multiple lines
    return data[0].map(item => item[0]).join('').trim();
  }
  throw new Error('Invalid response structure from Google Translate');
}

// 2. Gemini API
async function translateGemini(text, apiKey, targetLangLabel) {
  if (!apiKey) throw new Error('Gemini API key is required');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `You are a professional video subtitle translator. Translate the following Japanese video subtitle to ${targetLangLabel}. 
Reply with ONLY the final translated subtitle text, and absolutely nothing else. Keep it natural, concise, and matching the tone of a TV show/movie. Do not add quotes.

Subtitle:
${text}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Status ${response.status}`;
    throw new Error(`Gemini API error: ${message}`);
  }

  const data = await response.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (result) {
    return result.trim().replace(/^"|"$/g, ''); // strip any surrounding quotes Gemini might generate
  }
  throw new Error('Gemini API returned an empty response');
}

// 3. DeepL API
async function translateDeepL(text, apiKey, targetLang) {
  if (!apiKey) throw new Error('DeepL API key is required');

  const isFree = apiKey.endsWith(':fx');
  const url = isFree 
    ? 'https://api-free.deepl.com/v2/translate' 
    : 'https://api.deepl.com/v2/translate';

  // DeepL uses ZH-HANS (Simplified) and ZH-HANT (Traditional)
  const targetDeeplLang = targetLang === 'zh-TW' ? 'ZH-HANT' : 'ZH-HANS';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetDeeplLang
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `Status ${response.status}`;
    throw new Error(`DeepL API error: ${message}`);
  }

  const data = await response.json();
  const result = data.translations?.[0]?.text;
  if (result) {
    return result.trim();
  }
  throw new Error('DeepL API returned an empty response');
}

// 4. OpenAI API
async function translateOpenAI(text, apiKey, targetLangLabel) {
  if (!apiKey) throw new Error('OpenAI API key is required');

  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional video subtitle translator. Translate the user's subtitle to ${targetLangLabel}. Reply with ONLY the translation. No explanation, no quotes.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Status ${response.status}`;
    throw new Error(`OpenAI API error: ${message}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content;
  if (result) {
    return result.trim().replace(/^"|"$/g, '');
  }
  throw new Error('OpenAI API returned an empty response');
}
