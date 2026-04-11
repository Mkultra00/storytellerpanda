import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Send, ArrowLeft, Sparkles, Shuffle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { streamIntakeChat, parseStoryContext, stripStoryContextTag } from "@/lib/streamChat";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi there! 🌟 I'm Xiaobi, your storytelling panda! Let's create a wonderful story together!\n\nTo get started, tell me:\n• What's your child's **name**?\n• How **old** are they?\n• What's their **gender**?\n• And what's the **occasion** — is this a bedtime story, a birthday surprise, a confidence booster, or something else? 😊",
};

const CreateStory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [storyContext, setStoryContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    });
    // Refocus input after assistant reply
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > newMessages.length) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      // Send only user/assistant messages (skip system)
      const chatMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamIntakeChat({
        messages: chatMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false);
          // Check if the final message contains a STORY_CONTEXT
          const ctx = parseStoryContext(assistantSoFar);
          if (ctx) {
            setStoryContext(ctx);
            // Update the displayed message to strip the JSON block
            const cleanContent = stripStoryContextTag(assistantSoFar);
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: cleanContent } : m
              )
            );
          }
        },
      });
    } catch (e: any) {
      setIsLoading(false);
      toast({
        title: "Oops!",
        description: e.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSurpriseMe = () => {
    const names = ["Luna", "Max", "Aria", "Leo", "Zara", "Kai", "Mia", "Finn", "Nova", "Theo"];
    const ages = [3, 4, 5, 6, 7, 8];
    const genders = ["girl", "boy"];
    const themes = ["adventure", "fantasy", "space", "underwater", "dinosaurs", "fairy tale", "superhero", "pirate"];
    const interests = [["animals", "painting"], ["dinosaurs", "space"], ["fairies", "flowers"], ["robots", "racing"], ["dragons", "castles"], ["music", "dancing"]];
    const morals = ["bravery", "kindness", "teamwork", "honesty", "curiosity", "patience"];
    const tones = ["warm", "adventurous", "playful", "calm"] as const;
    const durations = [3, 5, 8];
    const settings = ["enchanted forest", "magical kingdom", "outer space", "underwater city", "cloud village", "dinosaur island"];

    const pick = <T,>(arr: readonly T[] | T[]) => arr[Math.floor(Math.random() * arr.length)];
    const name = pick(names);
    const gender = pick(genders);

    const randomContext = {
      child_name: name,
      child_age: pick(ages),
      child_gender: gender,
      occasion: "just for fun",
      interests: pick(interests),
      theme: pick(themes),
      moral_lesson: pick(morals),
      duration_minutes: pick(durations),
      setting: pick(settings),
      tone: pick(tones),
      characters: [name],
    };

    navigate("/story-preview", {
      state: { context: randomContext, chatHistory: [] },
    });
  };

  const handleContinue = () => {
    if (storyContext) {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      navigate("/story-preview", {
        state: { context: storyContext, chatHistory },
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <BookOpen className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">
          Xiaobi — Create a Story
        </h1>
      </header>

      {/* Chat */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
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
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-4 py-3 text-sm">
                <span className="animate-pulse">✨ Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input / Continue */}
      <div className="border-t border-border p-4">
        <div className="max-w-2xl mx-auto">
          {storyContext ? (
            <Button
              onClick={handleContinue}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-base py-6"
            >
              <Sparkles className="h-5 w-5" />
              Preview & Generate Story
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
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
              {messages.length <= 1 && (
                <Button
                  variant="outline"
                  onClick={handleSurpriseMe}
                  disabled={isLoading}
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Shuffle className="h-4 w-4" />
                  Just Surprise Me!
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateStory;
