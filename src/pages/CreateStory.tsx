import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Send, ArrowLeft, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi there! 🌟 I'm StoryWeaver, your magical storytelling companion. Let's create a wonderful story together!\n\nFirst, what's your child's name?",
};

const CreateStory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth");
    });
  }, [navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // For now, simulate AI responses with a placeholder
    // This will be replaced with the story-intake edge function in Phase 2
    setTimeout(() => {
      const step = newMessages.filter((m) => m.role === "user").length;
      let response = "";

      switch (step) {
        case 1:
          response = `What a lovely name! 💛 And how old is ${input.trim()}?`;
          break;
        case 2:
          response = `Perfect! What are some things ${newMessages[1]?.content || "they"} love? Hobbies, favorite animals, superheroes — anything goes! 🎨`;
          break;
        case 3:
          response = `Love it! Now, what kind of story should we create? Here are some ideas:\n\n🏰 **Adventure** — exploring new worlds\n🌙 **Bedtime** — calm & cozy\n🦸 **Superhero** — saving the day\n🧚 **Fantasy** — magic & wonder\n\nOr tell me your own idea!`;
          break;
        case 4:
          response = `Great choice! Is there a lesson or message you'd like the story to include? For example:\n\n💪 Bravery\n🤝 Kindness\n🌱 Growth\n✨ Self-belief\n\nOr just say "surprise me!"`;
          break;
        case 5:
          response = `Wonderful! One last question — how long should the story be?\n\n📖 **Short** (~3 minutes)\n📚 **Medium** (~5 minutes)\n📕 **Long** (~8 minutes)`;
          break;
        default:
          response = `Amazing! I have everything I need to create a magical story. Click the button below when you're ready!\n\n✨ **Generating your story...**\n\n_(Story generation will be available in Phase 2)_`;
          break;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <BookOpen className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">Create a Story</h1>
      </header>

      {/* Chat */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 font-body text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "assistant" && (
                  <Sparkles className="h-4 w-4 text-accent inline mr-1 -mt-0.5" />
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-4 py-3 text-sm">
                <span className="animate-pulse">✨ Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type your answer..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateStory;
