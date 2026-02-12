import { GoogleGenAI, Type } from '@google/genai';

const API_KEY = (process.env.REACT_APP_GEMINI_API_KEY || '').trim();
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

async function loadChatPrompt() {
  const res = await fetch('/chat_prompt.txt');
  if (!res.ok) throw new Error('Failed to load chat_prompt.txt');
  return res.text();
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Tool definition for generateMovieScript.
 * Takes an object with a scenes array. Each scene has sceneNumber (int), description (string), narration (string).
 */
export const movieTool = {
  functionDeclarations: [
    {
      name: 'generateMovieScript',
      description: 'Writes the generated movie script with scenes into the scene editor. Call this when the user has described their idea and you are ready to produce the script.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            description: 'Array of scene objects for the video reel',
            items: {
              type: Type.OBJECT,
              properties: {
                sceneNumber: {
                  type: Type.INTEGER,
                  description: 'Scene number (1-based index)',
                },
                description: {
                  type: Type.STRING,
                  description: 'Vivid visual description for image generation',
                },
                narration: {
                  type: Type.STRING,
                  description: 'Narration text with optional TTS tags like [excited] or [whispering]',
                },
              },
              required: ['sceneNumber', 'description', 'narration'],
            },
          },
        },
        required: ['scenes'],
      },
    },
  ],
};

/**
 * Create and return a chat session configured with the movie tool and system prompt.
 * Uses ai.chats.create() (not getGenerativeModel/startChat - those are from the older @google/generative-ai SDK).
 * @returns {Promise<Object|null>} Chat instance or null if API key missing
 */
export async function createAssistantChat() {
  if (!ai) return null;

  const systemInstruction = await loadChatPrompt();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      tools: [movieTool],
      toolConfig: {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      },
    },
  });

  return chat;
}

/**
 * Send a message to the assistant and process the response (streaming).
 * Calls onChunk(text) as text arrives. If the response contains function calls (generateMovieScript), executes onScript.
 * @param {Object} chat - Chat instance from createAssistantChat
 * @param {string} message - User message
 * @param {Function} onScript - Callback (args) => void when generateMovieScript is called
 * @param {Array<Blob|File|null>} [anchorImages] - Optional anchor images [image1, image2, image3] to include in context
 * @param {Function} [onChunk] - Callback (text) => void for streaming text as it arrives
 * @returns {Promise<{text: string, functionCalled: boolean}>}
 */
export async function sendAssistantMessage(chat, message, onScript, anchorImages = [], onChunk) {
  if (!chat) throw new Error('API key not configured');
  console.log('[AI Reel Maker] sendAssistantMessage called');

  let messageContent = message;
  const hasImages = anchorImages?.some((img) => img != null);
  if (hasImages) {
    const parts = [{ text: `Here are my anchor images (image 1, 2, 3) for style reference:\n\n${message}` }];
    for (let i = 0; i < 3; i++) {
      const img = anchorImages[i];
      if (img) {
        const base64 = await blobToBase64(img);
        const mime = img.type || 'image/png';
        parts.push({ inlineData: { mimeType: mime, data: base64 } });
      }
    }
    messageContent = parts;
  }

  // Use non-streaming: streaming + function calls can hang (API waits for function response before stream ends)
  const response = await chat.sendMessage({ message: messageContent });

  // Extract function calls - check both getter and parts (SDK structure can vary)
  let functionCalls = response?.functionCalls;
  if (!functionCalls?.length) {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall).filter(Boolean);
  }
  const text = response?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('')
    .trim() || '';

  console.log('[AI Reel Maker] hasFunctionCalls:', !!functionCalls?.length, '| functionCallNames:', functionCalls?.map((fc) => fc?.name) || [], '| textLength:', text?.length || 0);
  if (functionCalls && functionCalls.length > 0) {
    console.log('[AI Reel Maker] Tool called:', functionCalls.map((fc) => ({ name: fc?.name, args: fc?.args })));
    for (const fc of functionCalls) {
      if (fc?.name === 'generateMovieScript' && fc?.args) {
        console.log('[AI Reel Maker] Executing generateMovieScript, scenes count:', fc.args.scenes?.length);
        onScript(fc.args);
      }
    }
    const confirmText = 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.';
    onChunk?.(confirmText);
    return { text: confirmText, functionCalled: true };
  }

  console.log('[AI Reel Maker] Text response (no tool call), length:', text?.length);

  // Fallback: model sometimes outputs JSON as text instead of calling the tool - try to parse and apply
  const parsed = tryParseScriptFromText(text);
  if (parsed) {
    console.log('[AI Reel Maker] Parsed script from text fallback, scenes count:', parsed.scenes?.length);
    onScript(parsed);
    const confirmText = 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.';
    onChunk?.(confirmText);
    return { text: confirmText, functionCalled: true };
  }

  onChunk?.(text);
  return { text, functionCalled: false };
}

/** Try to extract and parse a scenes array from model text (fallback when model outputs JSON instead of calling tool) */
function tryParseScriptFromText(text) {
  if (!text?.trim()) return null;
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const scenes = arr.filter((s) => s && (s.description || s.narration));
    if (scenes.length === 0) return null;
    return { scenes };
  } catch {
    return null;
  }
}
