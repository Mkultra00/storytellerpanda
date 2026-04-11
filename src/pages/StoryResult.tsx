import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Home, Library, Sparkles } from "lucide-react";

const StoryResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const story = location.state?.story;

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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Sparkles className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">Your Story is Ready!</h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-heading font-bold text-foreground">{story.title}</h2>
          <p className="text-muted-foreground font-body">{story.synopsis}</p>
          <p className="text-sm text-accent">{story.scene_count} scenes</p>
        </div>

        <div className="space-y-4">
          <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" /> Scene Preview
          </h3>
          {story.scenes?.map((scene: any, idx: number) => (
            <Card key={idx} className="border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-accent/20 text-accent text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {scene.scene_number}
                  </span>
                  <span className="text-xs text-muted-foreground">{scene.duration_seconds}s</span>
                </div>
                <p className="font-body text-sm text-foreground leading-relaxed">{scene.narration_text}</p>
                <p className="text-xs text-muted-foreground italic">🎨 {scene.visual_prompt?.slice(0, 100)}...</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" /> Home
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate("/library")}>
            <Library className="h-4 w-4" /> Library
          </Button>
          <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 gap-2" onClick={() => navigate("/create")}>
            <Sparkles className="h-4 w-4" /> New Story
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryResult;
