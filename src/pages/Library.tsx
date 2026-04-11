import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Heart, Play } from "lucide-react";

const Library = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("story_library")
        .select("*, story_scripts(*)")
        .order("created_at", { ascending: false });

      setStories(data || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

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
            {stories.map((item) => (
              <div key={item.id} className="bg-card rounded-lg border border-border p-5 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-heading font-bold text-card-foreground">{item.story_scripts?.title || "Untitled"}</h3>
                <p className="text-sm text-muted-foreground font-body mt-1">{item.story_scripts?.synopsis || ""}</p>
                <div className="flex items-center gap-3 mt-4">
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Play className="h-3 w-3 mr-1" /> Play
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Heart className={`h-4 w-4 ${item.is_favorite ? "fill-destructive text-destructive" : ""}`} />
                  </Button>
                  <span className="text-xs text-muted-foreground font-body ml-auto">
                    Played {item.play_count}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;
