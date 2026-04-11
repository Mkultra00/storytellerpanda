import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Home, Library, Sparkles, Play, Pause, Volume2, Image, Music, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TavusNarrator from "@/components/TavusNarrator";

const RENDER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-story`;

type SceneRenderResult = {
  scene_id: string;
  scene_number: number;
  audio_url?: string;
  image_url?: string;
  error?: string;
};

const StoryResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const story = location.state?.story;

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState("");
  const [renderedScenes, setRenderedScenes] = useState<SceneRenderResult[]>([]);
  const [playingScene, setPlayingScene] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRender = useRef(false);

  // Auto-render on mount
  useEffect(() => {
    if (story?.script_id && !hasStartedRender.current && renderedScenes.length === 0) {
      hasStartedRender.current = true;
      // Delay slightly to let component mount
      const t = setTimeout(() => {
        renderStoryRef.current?.();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [story?.script_id]);

  if (!story) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No story data found.</p>
          <Button onClick={() => navigate("/create")}>Create a story</Button>
        </div>
      </div>
    );
  }

  const renderStory = async () => {
    if (!story.script_id) {
      toast({ title: "Error", description: "No script ID available for rendering.", variant: "destructive" });
      return;
    }

    setIsRendering(true);
    setRenderProgress(5);
    setRenderStatus("Starting rendering pipeline...");

    // Simulate progress while waiting
    const totalScenes = story.scene_count || story.scenes?.length || 1;
    const interval = setInterval(() => {
      setRenderProgress((prev) => Math.min(prev + 2, 90));
    }, 3000);

    const statusMessages = [
      "Generating voice narration...",
      "Painting scene illustrations...",
      "Adding magical details...",
      "Polishing the artwork...",
      "Almost ready...",
    ];
    let msgIdx = 0;
    const statusInterval = setInterval(() => {
      if (msgIdx < statusMessages.length) {
        setRenderStatus(statusMessages[msgIdx]);
        msgIdx++;
      }
    }, 5000);

    try {
      const resp = await fetch(RENDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ script_id: story.script_id }),
      });

      clearInterval(interval);
      clearInterval(statusInterval);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Rendering failed");
      }

      const result = await resp.json();
      setRenderProgress(100);
      setRenderStatus("Rendering complete! ✨");
      setRenderedScenes(result.scenes || []);
      setIsRendering(false);

      toast({
        title: "Story rendered!",
        description: `${result.scenes?.length || 0} scenes with audio and illustrations.`,
      });
    } catch (e: any) {
      clearInterval(interval);
      clearInterval(statusInterval);
      setIsRendering(false);
      setRenderProgress(0);
      toast({
        title: "Rendering failed",
        description: e.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const playScene = (sceneNum: number) => {
    const scene = renderedScenes.find((s) => s.scene_number === sceneNum);
    if (!scene?.audio_url) return;

    if (playingScene === sceneNum && audioRef.current) {
      audioRef.current.pause();
      setPlayingScene(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(scene.audio_url);
    audioRef.current = audio;
    audio.onended = () => setPlayingScene(null);
    audio.play();
    setPlayingScene(sceneNum);
  };

  const getRenderedScene = (sceneNum: number) =>
    renderedScenes.find((s) => s.scene_number === sceneNum);

  // Auto-render on mount
  useEffect(() => {
    if (story?.script_id && !hasStartedRender.current && renderedScenes.length === 0) {
      hasStartedRender.current = true;
      renderStory();
    }
  }, [story?.script_id]);

  if (isRendering) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <Wand2 className="w-10 h-10 text-accent animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <Music className="absolute top-0 right-1/4 w-5 h-5 text-accent animate-bounce" />
            <Image className="absolute bottom-2 left-1/4 w-5 h-5 text-accent/60 animate-bounce" style={{ animationDelay: "0.5s" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Rendering Your Story</h2>
            <p className="text-muted-foreground font-body">{renderStatus}</p>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{renderProgress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TavusNarrator
        storyTitle={story.title}
        storySynopsis={story.synopsis}
        childName={story.scenes?.[0]?.narration_text?.match(/\b[A-Z][a-z]+\b/)?.[0]}
        voiceId={story.voice_id}
      />
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Sparkles className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">
          {renderedScenes.length > 0 ? "Your Story is Ready!" : "Story Generated"}
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-heading font-bold text-foreground">{story.title}</h2>
          <p className="text-muted-foreground font-body">{story.synopsis}</p>
          <p className="text-sm text-accent">{story.scene_count} scenes</p>
        </div>

        {renderedScenes.length > 0 && (
          <Button
            onClick={() => {
              const playbackScenes = story.scenes?.map((s: any) => {
                const rendered = getRenderedScene(s.scene_number);
                return {
                  scene_number: s.scene_number,
                  narration_text: s.narration_text,
                  audio_url: rendered?.audio_url,
                  image_url: rendered?.image_url,
                  duration_seconds: s.duration_seconds,
                };
              });
              navigate("/playback", { state: { title: story.title, scenes: playbackScenes, synopsis: story.synopsis, voice_id: story.voice_id, child_name: story.scenes?.[0]?.narration_text?.match(/\b[A-Z][a-z]+\b/)?.[0] } });
            }}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-lg py-6"
          >
            <Play className="h-5 w-5" /> Play Full Story
          </Button>
        )}


        <div className="space-y-4">
          <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" /> Scenes
          </h3>
          {story.scenes?.map((scene: any, idx: number) => {
            const rendered = getRenderedScene(scene.scene_number);
            return (
              <Card key={idx} className="border-border overflow-hidden">
                {rendered?.image_url && (
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <img
                      src={rendered.image_url}
                      alt={`Scene ${scene.scene_number}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-accent/20 text-accent text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {scene.scene_number}
                      </span>
                      <span className="text-xs text-muted-foreground">{scene.duration_seconds}s</span>
                    </div>
                    {rendered?.audio_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playScene(scene.scene_number)}
                        className="gap-1 text-accent"
                      >
                        {playingScene === scene.scene_number ? (
                          <><Pause className="h-3 w-3" /> Pause</>
                        ) : (
                          <><Play className="h-3 w-3" /> Listen</>
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="font-body text-sm text-foreground leading-relaxed">{scene.narration_text}</p>
                  {!rendered && (
                    <p className="text-xs text-muted-foreground italic">🎨 {scene.visual_prompt?.slice(0, 100)}...</p>
                  )}
                  {rendered?.error && (
                    <p className="text-xs text-destructive">⚠️ {rendered.error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" /> Home
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate("/library")}>
            <Library className="h-4 w-4" /> Library
          </Button>
          <Button
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            onClick={() => navigate("/create")}
          >
            <Sparkles className="h-4 w-4" /> New Story
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryResult;
