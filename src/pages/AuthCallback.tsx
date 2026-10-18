import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function AuthCallback() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 10000;
    const stored = sessionStorage.getItem("post_auth_redirect");
    const target = safeNext(params.get("next") ?? stored);

    // Wait for session to be available before redirecting.
    const check = async () => {
      try {
        const providerError=params.get("error_description") ?? new URLSearchParams(window.location.hash.slice(1)).get("error_description");
        if(providerError)throw new Error(providerError);
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if(sessionError)throw sessionError;
        if (data.session) { sessionStorage.removeItem("post_auth_redirect"); nav(target, { replace: true }); }
        else if(Date.now()>=deadline) { setError("Sign-in could not be completed. Please try again."); }
        else timer=setTimeout(check,200);
      }catch(e:unknown){if(!cancelled)setError(e instanceof Error?e.message:"Sign-in failed");}
    };
    check();
    return () => { cancelled = true; if(timer)clearTimeout(timer); };
  }, [nav, params]);

  return <div className="min-h-screen flex flex-col gap-4 items-center justify-center text-muted-foreground">{error || "Signing you in…"}{error && <Button onClick={()=>nav("/auth",{replace:true})}>Return to sign in</Button>}</div>;
}
