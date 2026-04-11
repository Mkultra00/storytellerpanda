import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Loader2 } from "lucide-react";

const TAVUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-narrator`;

type TavusNarratorProps = {
  storyTitle: string;
  storySynopsis?: string;
  childName?: string;
  voiceId?: string;
};

const requestMediaPermissions = async (): Promise<{ granted: boolean; error?: string }> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    // Stop all tracks immediately — we just needed the permission grant
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      return { granted: false, error: "Please allow camera & microphone access in your browser settings, then try again." };
    }
    if (err.name === "NotFoundError") {
      return { granted: false, error: "No camera or microphone found on this device." };
    }
    if (err.name === "NotReadableError") {
      return { granted: false, error: "Camera or microphone is in use by another app." };
    }
    return { granted: false, error: "Could not access camera/microphone." };
  }
};

const TavusNarrator = ({ storyTitle, storySynopsis, childName, voiceId }: TavusNarratorProps) => {
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNarrator = async () => {
    setIsLoading(true);
    setError(null);

    // Pre-request camera + mic so the browser prompt appears before Tavus loads
    const media = await requestMediaPermissions();
    if (!media.granted) {
      setError(media.error || "Camera/microphone access required.");
      setIsLoading(false);
      return;
    }

    try {
      const resp = await fetch(TAVUS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          story_title: storyTitle,
          story_synopsis: storySynopsis,
          child_name: childName,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start narrator");
      }

      const data = await resp.json();
      setConversationUrl(data.conversation_url);
      setIsVisible(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible && !conversationUrl) {
    return (
      <div className="fixed top-20 right-4 z-50">
        <Button
          onClick={startNarrator}
          disabled={isLoading}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 shadow-lg rounded-full px-4 py-2"
          size="sm"
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Starting Xiaobi...</>
          ) : (
            <><Video className="h-4 w-4" /> Talk to Xiaobi</>
          )}
        </Button>
        {error && (
          <p className="text-xs text-destructive mt-1 bg-background/90 rounded px-2 py-1 max-w-[260px]">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsVisible((v) => !v)}
        className="bg-background/80 backdrop-blur border border-border shadow-md hover:bg-background"
      >
        {isVisible ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </Button>
      {isVisible && conversationUrl && (
        <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-2xl border-2 border-accent/30 bg-black">
          <iframe
            src={conversationUrl}
            allow="camera *; microphone *; autoplay *; display-capture *"
            className="w-full h-full"
            style={{ border: "none" }}
          />
        </div>
      )}
    </div>
  );
};

export default TavusNarrator;
