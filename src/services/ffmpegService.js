import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;

export async function loadFFmpeg() {
  if (loaded && ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  loaded = true;
  return ffmpeg;
}

/**
 * Get audio duration in seconds using Web Audio API.
 * @param {Blob} blob - Audio blob (WAV or MP3)
 * @returns {Promise<number>}
 */
async function getAudioDuration(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const duration = audioBuffer.duration;
  await audioContext.close();
  return duration;
}

/**
 * Remove [relaxed], [laughter], [pause], etc. from narration before subtitling.
 */
function cleanNarrationForSubtitles(text) {
  return (text || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim() || ' ';
}

/**
 * Generate SRT for a single scene (one subtitle entry).
 */
function sceneToSRT(narration, startSec, endSec) {
  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(3).replace('.', ',');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const text = cleanNarrationForSubtitles(narration);
  return `1\n${fmt(startSec)} --> ${fmt(endSec)}\n${text}\n`;
}

/**
 * Assemble scenes into final video with burned-in subtitles.
 * Each scene's image displays for the full duration of its audio.
 * @param {Array<{imageBlob: Blob, audioBlob: Blob, narration: string}>} scenes
 * @param {Function} onProgress - (progress: number) => void
 * @param {Object} options - { includeSubtitles: boolean }
 * @returns {Promise<Blob>} - Final output.mp4
 */
// Font for subtitles - ffmpeg.wasm needs an explicit font (libass can't find system fonts)
const FONT_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf/ttf/DejaVuSans.ttf';

async function loadFontForSubtitles(f) {
  // Create the directory first - FFmpeg.wasm needs it explicitly
  try {
    await f.createDir('fonts');
  } catch (e) {
    // Directory might already exist, which is fine
  }

  const urls = ['/fonts/DejaVuSans.ttf', FONT_URL];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const fontData = await res.arrayBuffer();
      await f.writeFile('fonts/DejaVuSans.ttf', new Uint8Array(fontData));
      return;
    } catch (_) {}
  }
}

export async function assembleVideo(scenes, onProgress, options = {}) {
  const { includeSubtitles = true } = options;
  onProgress?.(0);
  const f = await loadFFmpeg();
  const totalSteps = scenes.length + 1; // scenes + concat

  if (includeSubtitles) await loadFontForSubtitles(f);

  const sceneVideos = [];
  const audioExts = [];
  const audioDurations = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (!s.imageBlob || !s.audioBlob) throw new Error(`Scene ${i + 1} missing image or audio`);
    const imgData = await fetchFile(s.imageBlob);
    const audioData = await fetchFile(s.audioBlob);
    const ext = (s.audioBlob?.type || '').includes('mpeg') ? 'mp3' : 'wav';
    audioExts.push(ext);
    audioDurations.push(await getAudioDuration(s.audioBlob));
    await f.writeFile(`scene_${i}_img.png`, imgData);
    await f.writeFile(`scene_${i}_audio.${ext}`, audioData);
  }

  let currentStep = 0;
  f.on('progress', ({ progress }) => {
    const overall = Math.min(1, (currentStep + Math.min(1, progress)) / totalSteps);
    // Pass: progress 0-1, currentScene 1-based, totalScenes
    const currentScene = currentStep < scenes.length ? currentStep + 1 : null; // null during concat
    onProgress?.(overall, { currentScene, totalScenes: scenes.length });
  });

  const GAP_SEC = 0.1; // silence between scenes

  for (let i = 0; i < scenes.length; i++) {
    currentStep = i;
    onProgress?.(i / totalSteps, { currentScene: i + 1, totalScenes: scenes.length });
    const duration = audioDurations[i];
    const totalDuration = duration + GAP_SEC;

    const srtPath = `scene_${i}.srt`;
    const srtContent = sceneToSRT(scenes[i].narration, 0, duration);
    await f.writeFile(srtPath, new TextEncoder().encode(srtContent));

    const out = `scene_${i}_vid.mp4`;
    const audioFile = `scene_${i}_audio.${audioExts[i]}`;
    // Reel format 9:16 (720x1280). Scale → subtitles → pad so subs stay inside image (not on black bars)
    const scaleFilter = 'scale=720:1280:force_original_aspect_ratio=decrease';
    const padFilter = 'pad=720:1280:(ow-iw)/2:(oh-ih)/2';
    const subFilter = `subtitles=${srtPath}:fontsdir=/fonts:force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF&,Outline=2,BorderStyle=1,Alignment=2'`;
    const vf = includeSubtitles
      ? `${scaleFilter},${subFilter},${padFilter}`
      : `${scaleFilter},${padFilter}`;

    try {
      await f.exec([
        '-loop', '1',
        '-t', String(totalDuration),
        '-i', `scene_${i}_img.png`,
        '-i', audioFile,
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '15',
        '-af', `apad=pad_dur=${GAP_SEC}`,
        '-c:a', 'aac',
        '-shortest',
        '-y', out,
      ]);
    } catch (err) {
      console.error('FFmpeg Scene Error:', err);
      await f.exec([
        '-loop', '1',
        '-t', String(totalDuration),
        '-i', `scene_${i}_img.png`,
        '-i', audioFile,
        '-vf', `${scaleFilter},${padFilter}`,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '15',
        '-af', `apad=pad_dur=${GAP_SEC}`,
        '-c:a', 'aac',
        '-shortest',
        '-y', out,
      ]);
    }
    sceneVideos.push(out);
  }

  const listContent = sceneVideos.map((name) => `file '${name}'`).join('\n');
  await f.writeFile('concat.txt', new TextEncoder().encode(listContent));

  currentStep = scenes.length;
  onProgress?.(scenes.length / totalSteps, { currentScene: null, totalScenes: scenes.length }); // "Merging..." or similar
  await f.exec([
    '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    '-c', 'copy', '-y', 'output.mp4',
  ]);

  const data = await f.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}

