import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Heart, Play, Trash2, SlidersHorizontal, BookText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PlayMode = "narration" | "slideshow";

const Library = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [playModes, setPlayModes] = useState<Record<string, PlayMode>>({});

  const togglePlayMode = (id: string) => {
    setPlayModes((prev) => ({
      ...prev,
      [id]: prev[id] === "slideshow" ? "narration" : "slideshow",
    }));
  };

  const loadStories = async () => {
    const { data } = await supabase
      .from("story_library")
      .select("*, story_scripts(*)")
      .order("created_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(
        data.map(async (item) => {
          const { data: scenes } = await supabase
            .from("story_scenes")
            .select("*")
            .eq("script_id", item.script_id)
            .order("scene_number");
          return { ...item, scenes: scenes || [] };
        })
      );
      setStories(enriched);
    } else {
      setStories([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStories();
  }, []);

  const playStory = (item: any) => {
    const mode = playModes[item.id] || "narration";
    const playbackScenes = item.scenes.map((s: any) => ({
      scene_number: s.scene_number,
      narration_text: s.narration_text,
      audio_url: s.audio_url,
      image_url: s.image_url,
      duration_seconds: s.duration_seconds,
    }));
    navigate("/playback", {
      state: {
        title: item.story_scripts?.title,
        scenes: playbackScenes,
        synopsis: item.story_scripts?.synopsis,
        voice_id: item.story_scripts?.voice_id,
        autoPlay: mode === "narration",
        playMode: mode,
      },
    });
  };

  const deleteStory = async (item: any) => {
    setDeleting(item.id);
    try {
      await supabase.from("story_library").delete().eq("id", item.id);
      setStories((prev) => prev.filter((s) => s.id !== item.id));
      toast({ title: "Story deleted", description: `"${item.story_scripts?.title}" removed from your library.` });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <BookOpen className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">My Stories</h1>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-20 font-body">Loading your stories...</div>
        ) : stories.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-heading font-bold text-foreground">No stories yet</h2>
            <p className="text-muted-foreground font-body">Create your first magical story!</p>
            <Button
              onClick={() => navigate("/create")}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-bold"
            >
              Create a Story
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {stories.map((item) => {
              const hasMedia = item.scenes.some((s: any) => s.audio_url || s.image_url);
              const coverImage = item.scenes.find((s: any) => s.image_url)?.image_url;
              const mode = playModes[item.id] || "narration";
              return (
                <div
                  key={item.id}
                  className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow"
                >
                  {coverImage && (
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <img src={coverImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-heading font-bold text-card-foreground">
                      {item.story_scripts?.title || "Untitled"}
                    </h3>
                    <p className="text-sm text-muted-foreground font-body mt-1">
                      {item.story_scripts?.synopsis || ""}
                    </p>

                    {/* Play mode toggle */}
                    <button
                      onClick={() => togglePlayMode(item.id)}
                      className="mt-3 flex items-center gap-2 text-xs font-body rounded-full border border-border px-3 py-1.5 hover:bg-muted transition-colors"
                    >
                      {mode === "narration" ? (
                        <>
                          <Play className="h-3 w-3 text-accent" />
                          <span className="text-muted-foreground">Narration</span>
                        </>
                      ) : (
                        <>
                          <BookText className="h-3 w-3 text-accent" />
                          <span className="text-muted-foreground">Slideshow</span>
                        </>
                      )}
                      <span className="text-muted-foreground/50 ml-1">tap to switch</span>
                    </button>

                    <div className="flex items-center gap-3 mt-3">
                      <Button
                        size="sm"
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                        onClick={() => playStory(item)}
                        disabled={!hasMedia && mode === "narration"}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {mode === "slideshow" ? "View" : hasMedia ? "Play" : "Not rendered"}
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Heart className={`h-4 w-4 ${item.is_favorite ? "fill-destructive text-destructive" : ""}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteStory(item)}
                        disabled={deleting === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-body ml-auto">
                        {item.scenes.length} scenes
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;