import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Headphones, Star, Shuffle, Flame } from "lucide-react";
import xiaobiAvatar from "@/assets/xiaobi-avatar.png";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <img src={xiaobiAvatar} alt="Xiaobi" className="h-10 w-10" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Xiaobi</h1>
        </div>
        <div>
          <Button onClick={() => navigate("/create")} className="bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-bold">
            Create Story
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="text-center space-y-6">
          <img src={xiaobiAvatar} alt="Xiaobi the Storytelling Panda" className="h-80 w-80 mx-auto" width={512} height={512} />

          <div className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-full text-sm font-body text-foreground/80">
            <Sparkles className="h-4 w-4 text-accent" />
            AI-Powered Bedtime Stories
          </div>

          <h2 className="text-5xl md:text-6xl font-heading font-extrabold text-foreground leading-tight max-w-3xl mx-auto">
            Meet <span className="text-accent">Xiaobi</span> — The Storytelling Panda
          </h2>

          <p className="text-lg text-muted-foreground font-body max-w-xl mx-auto">
            Tell Xiaobi about your child's world — their name, interests, and dreams — 
            and he'll weave a personalized story with narration and illustrations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              onClick={() => navigate("/create")}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-bold text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Start Creating
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                const names = ["Luna", "Max", "Aria", "Leo", "Zara", "Kai", "Mia", "Finn", "Nova", "Theo"];
                const ages = [3, 4, 5, 6, 7, 8];
                const genders = ["girl", "boy"];
                const themes = ["adventure", "fantasy", "space", "underwater", "dinosaurs", "fairy tale", "superhero", "pirate"];
                const interests = [["animals", "painting"], ["dinosaurs", "space"], ["fairies", "flowers"], ["robots", "racing"], ["dragons", "castles"], ["music", "dancing"]];
                const morals = ["bravery", "kindness", "teamwork", "honesty", "curiosity", "patience"];
                const tones = ["warm", "adventurous", "playful", "calm"];
                const durations = [3, 5, 8];
                const settings = ["enchanted forest", "magical kingdom", "outer space", "underwater city", "cloud village", "dinosaur island"];
                const pick = <T,>(arr: readonly T[] | T[]) => arr[Math.floor(Math.random() * arr.length)];
                const name = pick(names);
                navigate("/story-preview", {
                  state: {
                    context: {
                      child_name: name, child_age: pick(ages), child_gender: pick(genders),
                      occasion: "just for fun", interests: pick(interests), theme: pick(themes),
                      moral_lesson: pick(morals), duration_minutes: pick(durations),
                      setting: pick(settings), tone: pick(tones), characters: [name],
                    },
                    chatHistory: [],
                  },
                });
              }}
              className="font-heading font-semibold text-lg px-8 py-6 rounded-lg"
            >
              <Shuffle className="h-5 w-5 mr-2" />
              Surprise Me!
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/library")}
              className="font-heading font-semibold text-lg px-8 py-6 rounded-lg"
            >
              <BookOpen className="h-5 w-5 mr-2" />
              My Stories
            </Button>
            <Button
              size="lg"
              onClick={() => navigate("/create", { state: { unchained: true } })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-heading font-bold text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Flame className="h-5 w-5 mr-2" />
              Unchained Mode 🔥
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            {
              icon: Sparkles,
              title: "AI Story Creation",
              description: "Xiaobi crafts unique stories based on your child's personality, interests, and favorite characters.",
            },
            {
              icon: Headphones,
              title: "Narrated Audio",
              description: "Professional-quality voice narration brings each scene to life with warmth and expression.",
            },
            {
              icon: Star,
              title: "Beautiful Illustrations",
              description: "Every scene is accompanied by stunning, AI-generated artwork matching the story's mood.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-lg p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
            >
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-heading font-bold text-card-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground font-body">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
