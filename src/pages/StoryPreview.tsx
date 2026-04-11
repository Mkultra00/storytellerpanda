import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, BookOpen, Clock, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/story-generate`;

const StoryPreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const context = location.state?.context;
  const chatHistory = location.state?.chatHistory;
  const characterImageUrl = location.state?.characterImageUrl || null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  

  if (!context) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No story context found.</p>
          <Button onClick={() => navigate("/create")}>Start a new story</Button>
        </div>
      </div>
    );
  }


  const generateStory = async () => {
    setIsGenerating(true);
    setProgress(10);
    setStatusText("Warming up the story engine...");


    const steps = [
      { pct: 25, text: "Imagining characters..." },
      { pct: 45, text: "Weaving the plot..." },
      { pct: 65, text: "Painting scenes..." },
      { pct: 80, text: "Adding the finishing sparkles..." },
      { pct: 90, text: "Almost there..." },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setStatusText(steps[stepIdx].text);
        stepIdx++;
      }
    }, 2500);

    try {
      const resp = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          context: {
            ...context,
            raw_chat: chatHistory || null,
            character_image_url: characterImageUrl,
          },
          user_id: "00000000-0000-0000-0000-000000000000",
        }),
      });

      clearInterval(interval);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }

      const result = await resp.json();
      setProgress(100);
      setStatusText("Story created! ✨");

      setTimeout(() => {
        navigate("/story-result", { state: { story: result } });
      }, 1000);
    } catch (e: any) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast({
        title: "Generation failed",
        description: e.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
              <Wand2 className="w-10 h-10 text-accent animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <Sparkles className="absolute top-0 right-1/4 w-6 h-6 text-accent animate-bounce" />
            <Sparkles className="absolute bottom-2 left-1/4 w-4 h-4 text-accent/60 animate-bounce" style={{ animationDelay: "0.5s" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Creating Your Story</h2>
            <p className="text-muted-foreground font-body">{statusText}</p>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/create")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Sparkles className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">Story Preview</h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Story Details */}
        <Card className="border-accent/30 bg-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <BookOpen className="h-5 w-5" />
              <span className="font-heading font-bold text-lg">Story Details</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Hero</p>
                <p className="font-body font-medium text-foreground">{context.child_name}, age {context.child_age}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Theme</p>
                <p className="font-body font-medium text-foreground capitalize">{context.theme}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Interests</p>
                <p className="font-body font-medium text-foreground">{(context.interests || []).join(", ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lesson</p>
                <p className="font-body font-medium text-foreground capitalize">{context.moral_lesson}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</p>
                <p className="font-body font-medium text-foreground">~{context.duration_minutes} minutes</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tone</p>
                <p className="font-body font-medium text-foreground capitalize">{context.tone}</p>
              </div>
            </div>

            {context.characters && context.characters.length > 0 && (
              <div>
                <p className="text-muted-foreground text-sm">Characters</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {context.characters.map((c: string, i: number) => (
                    <span key={i} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {context.setting && (
              <div>
                <p className="text-muted-foreground text-sm">Setting</p>
                <p className="font-body text-foreground capitalize">{context.setting}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/create")}>
            Start Over
          </Button>
          <Button
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            onClick={generateStory}
            disabled={false}
          >
            <Wand2 className="h-4 w-4" />
            Generate Story
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryPreview;