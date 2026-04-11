import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, VideoOff, Loader2 } from "lucide-react";

const TAVUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-narrator`;

const requestMediaPermissions = async (): Promise<{ granted: boolean; error?: string }> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err: any) {
    if (err.name === "NotAllowedError") return { granted: false, error: "Please allow camera & microphone access." };
    if (err.name === "NotFoundError") return { granted: false, error: "No camera or microphone found." };
    return { granted: false, error: "Could not access camera/microphone." };
  }
};

const TalkToXiaobi = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, synopsis, childName, voiceId, scenes } = (location.state || {}) as {
    title?: string;
    synopsis?: string;
    childName?: string;
    voiceId?: string;
    scenes?: Array<{ narration_text?: string; image_url?: string; scene_number?: number }>;
  };

  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startConversation = async () => {
    setIsLoading(true);
    setError(null);

    const media = await requestMediaPermissions();
    if (!media.granted) {
      setError(media.error || "Camera/microphone access required.");
      setIsLoading(false);
      return;
    }

    try {
      // Build a rich synopsis including scene details so Xiaobi knows the story
      const sceneDetails = scenes
        ?.map((s) => `Scene ${s.scene_number}: ${s.narration_text}`)
        .join("\n") || "";
      const fullSynopsis = `${synopsis || ""}\n\nFull story scenes:\n${sceneDetails}`.trim();

      const resp = await fetch(TAVUS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          story_title: title || "Story",
          story_synopsis: fullSynopsis,
          child_name: childName,
          voice_id: voiceId,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.conversation_url) {
        throw new Error(data?.error || "Failed to start Xiaobi");
      }

      setConversationUrl(data.conversation_url);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Video className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-heading font-bold text-foreground">
          Talk to Xiaobi about "{title || "your story"}"
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {conversationUrl ? (
          <div className="w-full max-w-2xl aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-accent/30 bg-black">
            <iframe
              src={conversationUrl}
              allow="camera *; microphone *; autoplay *; display-capture *; fullscreen *"
              className="w-full h-full"
              style={{ border: "none" }}
            />
          </div>
        ) : (
          <div className="text-center space-y-6 max-w-md">
            <div className="w-24 h-24 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <Video className="w-10 h-10 text-accent" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-heading font-bold text-foreground">Chat with Xiaobi 🐼</h2>
              <p className="text-muted-foreground font-body">
                Have a video conversation with Xiaobi about the story "{title}". 
                Ask questions, discuss characters, or just chat about the adventure!
              </p>
            </div>
            <Button
              onClick={startConversation}
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-lg px-8 py-6"
            >
              {isLoading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Connecting to Xiaobi...</>
              ) : (
                <><Video className="h-5 w-5" /> Start Video Chat</>
              )}
            </Button>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TalkToXiaobi;
