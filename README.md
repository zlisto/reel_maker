# Gemini Movie Maker

Create videos from an idea using AI. Enter a movie concept, and the app generates a script with scenes, then produces static images and narration for each scene. Finally, it assembles everything into a downloadable video.

## What It Does

1. **Script from idea** – AI (Gemini) turns your movie idea into a JSON script with scenes, each with a visual description and narration text.

2. **Images** – AI (Gemini) generates images for each scene from the descriptions. Optional anchor images can be used as style references.

3. **Audio** – TTS for narration using either:
   - **Gemini** – Built-in voices (Kore, Aoede, Callirrhoe)
   - **ElevenLabs** – Higher quality voices (requires API key)

4. **Video assembly** – Assembles images and audio into a video with optional burned-in subtitles. Output is 1280×720 HD.

## How to Run

```bash
git clone <repository-url>
cd hw4
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env` file in the project root with your API keys:

```
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
REACT_APP_ELEVENLABS_API_KEY=your_elevenlabs_api_key  # optional, for ElevenLabs TTS
REACT_APP_ELEVENLABS_VOICE_ID=your_voice_id          # optional, for ElevenLabs TTS
```

- **Gemini** is required for script generation, image generation, and TTS (if you use Gemini).
- **ElevenLabs** is optional; use it only if you prefer ElevenLabs voices over Gemini.

## Build for Production

```bash
npm run build
```

The built app is in the `build` folder.
