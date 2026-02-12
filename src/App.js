import React, { useState, useCallback } from 'react';
import { generateScenes, generateImage, generateTTS, fetchElevenLabsVoices } from './services/gemini';
import { assembleVideo } from './services/ffmpegService';
import MovieInput from './components/MovieInput';
import AnchorImages from './components/AnchorImages';
import AnimatedDots from './components/AnimatedDots';
import SceneEditor from './components/SceneEditor';
import VideoAssembly from './components/VideoAssembly';

function getProjectName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `video_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const initialScene = (item) => ({
  sceneNumber: item.sceneNumber ?? 0,
  description: item.description ?? '',
  narration: item.narration ?? '',
  imageBlob: null,
  audioBlob: null,
});

function App() {
  const [projectName, setProjectName] = useState(null);
  const [movieIdea, setMovieIdea] = useState('');
  const [anchorImages, setAnchorImages] = useState([null, null, null]);
  const [scenes, setScenes] = useState([]);
  const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
  const [voiceProvider, setVoiceProvider] = useState('gemini');
  const [voice, setVoice] = useState('Kore');
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(null);
  const [assembleProgress, setAssembleProgress] = useState(null);
  const [assembleStatus, setAssembleStatus] = useState({ currentScene: null, totalScenes: 0 });
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerateScenes = useCallback(async () => {
    if (!movieIdea.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const generated = await generateScenes(movieIdea.trim());
      setScenes(generated.map(initialScene));
      setProjectName(getProjectName());
    } catch (err) {
      setError(err?.message || 'Failed to generate scenes');
    } finally {
      setLoading(false);
    }
  }, [movieIdea]);

  const handleUpdateScene = useCallback((index, field, value) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }, []);

  const handleGenerateImage = useCallback(async (index) => {
    const scene = scenes[index];
    if (!scene?.description) return;
    setGeneratingIndex(index);
    setError(null);
    try {
      const blob = await generateImage(scene.description, anchorImages, imageModel);
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, imageBlob: blob } : s))
      );
    } catch (err) {
      setError(err?.message || 'Failed to generate image');
    } finally {
      setGeneratingIndex(null);
    }
  }, [scenes, anchorImages, imageModel]);

  React.useEffect(() => {
    if (voiceProvider === 'elevenlabs') {
      fetchElevenLabsVoices()
        .then((voices) => {
          setElevenLabsVoices(voices);
          if (voices.length > 0 && !elevenLabsVoiceId) setElevenLabsVoiceId(voices[0].id);
        })
        .catch((err) => console.error('Error loading ElevenLabs voices:', err));
    }
  }, [voiceProvider]);

  const handleAnchorChange = useCallback((index, file) => {
    setAnchorImages((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }, []);

  const handleGenerateAudio = useCallback(async (index) => {
    const scene = scenes[index];
    if (!scene?.narration) return;
    setGeneratingIndex(index);
    setError(null);
    try {
      const voiceToUse = voiceProvider === 'elevenlabs' ? elevenLabsVoiceId : voice;
      const blob = await generateTTS(scene.narration, voiceProvider, voiceToUse);
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, audioBlob: blob } : s))
      );
    } catch (err) {
      setError(err?.message || 'Failed to generate audio');
    } finally {
      setGeneratingIndex(null);
    }
  }, [scenes, voice, voiceProvider, elevenLabsVoiceId]);

  const handleAssemble = useCallback(async () => {
    const ready = scenes.filter((s) => s.imageBlob && s.audioBlob);
    if (ready.length !== scenes.length) {
      setError('Generate images and audio for all scenes first');
      return;
    }
    setAssembleProgress(0);
    setAssembleStatus({ currentScene: null, totalScenes: scenes.length });
    setError(null);
    try {
      const blob = await assembleVideo(
        scenes,
        (p, status) => {
          setAssembleProgress(p);
          if (status) setAssembleStatus(status);
        },
        { includeSubtitles }
      );
      setOutputBlob(blob);
      setAssembleProgress(1);
      setAssembleStatus({ currentScene: null, totalScenes: scenes.length });
    } catch (err) {
      setError(err?.message || 'Failed to assemble video');
      setAssembleProgress(null);
      setAssembleStatus({ currentScene: null, totalScenes: 0 });
    }
  }, [scenes, includeSubtitles]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">AI Reel Maker</h1>
          <p className="text-slate-400 mt-1">Create videos from ideas with AI-generated scenes, images, and narration</p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error}
          </div>
        )}

        <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">1. Movie Idea</h2>
          <MovieInput
            value={movieIdea}
            onChange={setMovieIdea}
            disabled={loading}
          />
          <div className="mt-6 pt-6 border-t border-slate-600">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Anchor Images (optional)</h3>
            <AnchorImages anchorImages={anchorImages} onAnchorChange={handleAnchorChange} />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-600">
            <button
              onClick={handleGenerateScenes}
              disabled={loading || !movieIdea.trim()}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {loading ? <AnimatedDots prefix="Generating" /> : 'Generate Scenes'}
            </button>
          </div>
        </section>

        {scenes.length > 0 && (
          <>
            <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">2. Edit Scenes</h2>
              <SceneEditor
                scenes={scenes}
                onUpdate={handleUpdateScene}
                imageModel={imageModel}
                onImageModelChange={setImageModel}
                voiceProvider={voiceProvider}
                onVoiceProviderChange={setVoiceProvider}
                voice={voice}
                onVoiceChange={setVoice}
                elevenLabsVoices={elevenLabsVoices}
                elevenLabsVoiceId={elevenLabsVoiceId}
                onElevenLabsVoiceChange={setElevenLabsVoiceId}
                onGenerateImage={handleGenerateImage}
                onGenerateAudio={handleGenerateAudio}
                generating={generatingIndex}
              />
            </section>

            <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">3. Video Generation</h2>
              <VideoAssembly
                onAssemble={handleAssemble}
                assembleProgress={assembleProgress}
                assembleStatus={assembleStatus}
                includeSubtitles={includeSubtitles}
                onIncludeSubtitlesChange={setIncludeSubtitles}
                outputBlob={outputBlob}
                projectName={projectName}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
