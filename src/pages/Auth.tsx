import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  try {
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  } catch {
    return "/";
  }
}

export default function AuthPage() {
  const [params] = useSearchParams();
  const nextPath = safeNext(params.get("next"));
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav(nextPath, { replace: true });
    });
  }, [nav, nextPath]);

  async function handleGoogle() {
    setBusy(true);
    // Preserve intended destination for after Google returns.
    sessionStorage.setItem("post_auth_redirect", nextPath);
    const redirectUri = `${window.location.origin}/auth/callback`;
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUri });
    if (res.error) {
      toast.error(res.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    // Tokens set — navigate to next.
    nav(nextPath, { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(nextPath, { replace: true });
      } else {
        const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet><title>Sign in — NMF Subtyping</title></Helmet>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>
            Save your NMF analyses and connect this app to ChatGPT, Claude, or other AI clients via MCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>New here? <button className="underline" onClick={() => setMode("signup")}>Create an account</button></>
            ) : (
              <>Have an account? <button className="underline" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </div>
          <div className="text-center text-xs"><Link to="/" className="text-muted-foreground hover:underline">← Back to dashboard</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
