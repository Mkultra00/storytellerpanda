import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-10 w-10 text-accent" />
            <h1 className="text-3xl font-heading font-bold text-foreground">StoryWeaver</h1>
          </div>
          <p className="text-muted-foreground font-body">
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to get started."}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-6">
          <p className="text-center text-muted-foreground font-body">
            Authentication is currently disabled. You can explore the app freely.
          </p>
          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-bold"
            onClick={() => navigate("/")}
          >
            Continue to App
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
