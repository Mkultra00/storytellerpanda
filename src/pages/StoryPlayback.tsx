import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import TavusNarrator from "@/components/TavusNarrator";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  X,
  Gauge,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type PlaybackScene = {
  scene_number: number;
  narration_text: string;
  audio_url?: string;
  image_url?: string;
  duration_seconds?: number;
};

type PlaybackState = "idle" | "playing" | "paused" | "ended";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

const StoryPlayback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, scenes: rawScenes, synopsis, voice_id, child_name, autoPlay } = (location.state || {}) as {
    title?: string;
    scenes?: PlaybackScene[];
    synopsis?: string;
    voice_id?: string;
    child_name?: string;
    autoPlay?: boolean;
  };

  const scenes = rawScenes || [];

  const [currentScene, setCurrentScene] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [crossfading, setCrossfading] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressTimer = useRef<ReturnType<typeof setInterval>>();
  const hasAutoPlayed = useRef(false);

  const scene = scenes[currentScene];

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (playbackState === "playing") {
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  }, [playbackState]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [playbackState, resetControlsTimer]);

  // Progress tracking
  useEffect(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (playbackState === "playing" && audioRef.current) {
      progressTimer.current = setInterval(() => {
        if (audioRef.current) {
          setAudioProgress(audioRef.current.currentTime);
          setAudioDuration(audioRef.current.duration || 0);
        }
      }, 100);
    }
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [playbackState]);

  // Crossfade image on scene change
  useEffect(() => {
    if (currentScene > 0 && scenes[currentScene - 1]?.image_url) {
      setPrevImage(scenes[currentScene - 1].image_url!);
      setCrossfading(true);
      const t = setTimeout(() => {
        setCrossfading(false);
        setPrevImage(null);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [currentScene, scenes]);

  const playScene = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= scenes.length) return;

      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setCurrentScene(idx);
      setAudioProgress(0);
      setAudioDuration(0);

      const s = scenes[idx];
      if (s.audio_url) {
        const audio = new Audio(s.audio_url);
        audio.volume = muted ? 0 : volume;
        audio.playbackRate = speed;
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          setAudioDuration(audio.duration);
        };

        audio.onended = () => {
          // Auto-advance to next scene
          if (idx + 1 < scenes.length) {
            playScene(idx + 1);
          } else {
            setPlaybackState("ended");
          }
        };

        audio.play().catch(console.error);
        setPlaybackState("playing");
      } else {
        // No audio — auto-advance after estimated duration
        setPlaybackState("playing");
        const dur = (s.duration_seconds || 8) * 1000;
        const t = setTimeout(() => {
          if (idx + 1 < scenes.length) {
            playScene(idx + 1);
          } else {
            setPlaybackState("ended");
          }
        }, dur / speed);
        return () => clearTimeout(t);
      }
    },
    [scenes, muted, volume, speed]
  );

  const handlePlayPause = () => {
    if (playbackState === "idle" || playbackState === "ended") {
      playScene(playbackState === "ended" ? 0 : currentScene);
    } else if (playbackState === "playing") {
      audioRef.current?.pause();
      setPlaybackState("paused");
    } else if (playbackState === "paused") {
      audioRef.current?.play();
      setPlaybackState("playing");
    }
  };

  const handleSkipForward = () => {
    if (currentScene + 1 < scenes.length) {
      playScene(currentScene + 1);
    }
  };

  const handleSkipBack = () => {
    // If more than 3s into scene, restart it; else go to previous
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setAudioProgress(0);
    } else if (currentScene > 0) {
      playScene(currentScene - 1);
    }
  };

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    setMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume;
  };

  const handleSpeedChange = (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const handleSeek = (val: number[]) => {
    const t = val[0];
    setAudioProgress(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    navigate(-1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update volume/speed on running audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
      audioRef.current.playbackRate = speed;
    }
  }, [volume, muted, speed]);

  if (!scenes.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No scenes available for playback.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col cursor-pointer select-none"
      onClick={resetControlsTimer}
    >
      {/* Tavus narrator PiP */}
      <TavusNarrator
        storyTitle={title || "Story"}
        storySynopsis={synopsis}
        childName={child_name}
        voiceId={voice_id}
      />

      {/* Scene Image with crossfade */}
      <div className="absolute inset-0">
        {/* Previous image (fading out) */}
        {prevImage && (
          <img
            src={prevImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[800ms]"
            style={{ opacity: crossfading ? 1 : 0 }}
          />
        )}
        {/* Current image */}
        {scene?.image_url ? (
          <img
            src={scene.image_url}
            alt={`Scene ${scene.scene_number}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[800ms]"
            style={{ opacity: crossfading ? 0 : 1 }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(216,49%,14%)] to-[hsl(216,49%,8%)]" />
        )}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </div>

      {/* Top bar */}
      <div
        className={`relative z-10 flex items-center justify-between px-6 py-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-white font-heading font-bold text-lg truncate max-w-[50vw]">
            {title || "Story"}
          </h1>
          <p className="text-white/60 text-xs font-body">
            Scene {currentScene + 1} of {scenes.length}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); setShowCaptions((v) => !v); }}
          className="text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold"
        >
          CC
        </Button>
      </div>

      {/* Captions — positioned at top, below the top bar */}
      {showCaptions && scene?.narration_text && (
        <div
          className={`relative z-10 flex justify-center px-8 -mt-2 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-90"
          }`}
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2.5 max-w-2xl">
            <p className="text-white font-body text-xs leading-relaxed text-center">
              {scene.narration_text}
            </p>
          </div>
        </div>
      )}

      {/* Spacer to push controls to bottom */}
      <div className="flex-1" />

      {/* Bottom controls */}
      <div
        className={`relative z-10 mt-auto transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-3 text-white/60 text-xs font-body">
            <span>{formatTime(audioProgress)}</span>
            <Slider
              value={[audioProgress]}
              max={audioDuration || 1}
              step={0.1}
              onValueChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
            <span>{formatTime(audioDuration)}</span>
          </div>
        </div>

        {/* Scene dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {scenes.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); playScene(i); }}
              className={`rounded-full transition-all duration-300 ${
                i === currentScene
                  ? "w-6 h-2 bg-accent"
                  : i < currentScene
                  ? "w-2 h-2 bg-white/60"
                  : "w-2 h-2 bg-white/30"
              }`}
            />
          ))}
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between px-6 pb-6">
          {/* Volume */}
          <div className="flex items-center gap-2 w-32">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={handleVolumeChange}
              onClick={(e) => e.stopPropagation()}
              className="w-20 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5"
            />
          </div>

          {/* Transport */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); handleSkipBack(); }}
              className="text-white/80 hover:text-white hover:bg-white/10 h-10 w-10"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
              className="text-white hover:bg-white/10 h-14 w-14 rounded-full border border-white/30"
            >
              {playbackState === "playing" ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Play className="h-7 w-7 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); handleSkipForward(); }}
              className="text-white/80 hover:text-white hover:bg-white/10 h-10 w-10"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Speed */}
          <div className="relative w-32 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu((v) => !v); }}
              className="text-white/80 hover:text-white hover:bg-white/10 gap-1 text-xs"
            >
              <Gauge className="h-3.5 w-3.5" />
              {speed}x
            </Button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur rounded-lg border border-white/10 p-1 min-w-[80px]">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); handleSpeedChange(s); }}
                    className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                      speed === s ? "text-accent bg-white/10" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side navigation arrows (large targets) */}
      {showControls && currentScene > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleSkipBack(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/40 hover:text-white/80 transition-colors p-2"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
      {showControls && currentScene < scenes.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleSkipForward(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/40 hover:text-white/80 transition-colors p-2"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* End overlay */}
      {playbackState === "ended" && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
          <div className="text-center space-y-6">
            <h2 className="text-white text-3xl font-heading font-bold">The End ✨</h2>
            <p className="text-white/60 font-body">What a wonderful adventure!</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => { playScene(0); }}
                className="border-white/30 text-white hover:bg-white/10 gap-2"
              >
                <Play className="h-4 w-4" /> Replay
              </Button>
              <Button
                onClick={handleClose}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryPlayback;
