import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

// Beta auth.oauth namespace — typed wrapper.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) { setError(error.message ?? String(error)); return; }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load authorization request.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const res = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (res.error) { setError(res.error.message ?? String(res.error)); setBusy(false); return; }
      const target = res.data?.redirect_url ?? res.data?.redirect_to;
      if (!target) { setError("No redirect returned by the authorization server."); setBusy(false); return; }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? "Authorization failed.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet><title>Authorize connection — NMF Subtyping</title></Helmet>
      <Card className="w-full max-w-md">
        {error ? (
          <>
            <CardHeader><CardTitle>Authorization error</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-destructive">{error}</p></CardContent>
          </>
        ) : !details ? (
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Connect {details.client?.name ?? "an app"} to your account</CardTitle>
              <CardDescription>
                {details.client?.name ?? "This client"} will be able to call this app's enabled tools while you are signed in.
                This does not bypass this app's permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Client:</span> {details.client?.name ?? "unknown"}</div>
                {details.client?.redirect_uri && (
                  <div className="truncate"><span className="text-muted-foreground">Redirect:</span> {details.client.redirect_uri}</div>
                )}
                {details.scope && (
                  <div><span className="text-muted-foreground">Scope:</span> {details.scope}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Approve</Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Deny</Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
