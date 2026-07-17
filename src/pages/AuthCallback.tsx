import { useEffect } from "react";
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

  useEffect(() => {
    let cancelled = false;
    const stored = sessionStorage.getItem("post_auth_redirect");
    const target = safeNext(params.get("next") ?? stored);
    sessionStorage.removeItem("post_auth_redirect");

    // Wait for session to be available before redirecting.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        nav(target, { replace: true });
      } else {
        setTimeout(check, 200);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [nav, params]);

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Signing you in…</div>;
}
