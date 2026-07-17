import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AccelBioLogo from "@/assets/AccelBio_logo.png";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      toast.success("MCP URL copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Connect an AI assistant — NMF Subtyping</title>
        <meta name="description" content="Connect ChatGPT or Claude to the NMF Molecular Subtyping app via MCP to query your saved analyses." />
        <link rel="canonical" href="https://accelbio-nmf-subtyping.lovable.app/connect" />
      </Helmet>

      <header className="border-b border-border/50 bg-card/30 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={AccelBioLogo} alt="Co-Lab AccelBio" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold">Connect an AI assistant</h1>
              <p className="text-xs text-muted-foreground">Use this app from ChatGPT or Claude</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your MCP server URL</CardTitle>
            <CardDescription>
              Paste this URL into an AI assistant to let it call this app's tools as you. Sign in and approve the
              connection when prompted — the assistant can then list, summarize, and query your saved NMF analyses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm break-all font-mono">
                {mcpUrl}
              </code>
              <Button onClick={copy} size="sm">
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect ChatGPT</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Open{" "}
                <a className="text-primary underline" href="https://chatgpt.com/#settings/Connectors/Advanced" target="_blank" rel="noreferrer">
                  chatgpt.com/#settings/Connectors/Advanced
                </a>{" "}
                and enable <strong>Developer mode</strong> (read the risk notice shown there).
              </li>
              <li>In the chat composer's <strong>+</strong> menu, turn on <strong>Developer mode</strong>.</li>
              <li>Click <strong>Add sources</strong>, then <strong>Connect more</strong>.</li>
              <li>Name the connector (e.g. "NMF Subtyping") and paste the MCP URL above.</li>
              <li>Sign in and approve the connection, then ask ChatGPT to use the app.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect Claude</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Open{" "}
                <a className="text-primary underline" href="https://claude.ai/customize/connectors?modal=add-custom-connector" target="_blank" rel="noreferrer">
                  claude.ai/customize/connectors
                </a>
                .
              </li>
              <li>Name the connector (e.g. "NMF Subtyping") and paste the MCP URL above.</li>
              <li>Sign in and approve the connection.</li>
              <li>Enable the connector from the chat composer, then ask Claude to use the app.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Refresh after the app changes</CardTitle>
            <CardDescription>
              Assistants cache the tool list. After new tools ship, refresh the connection to pick them up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">ChatGPT</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open ChatGPT's app preferences and pick this app under <strong>Enabled apps</strong>.</li>
                <li>Next to <strong>Information</strong>, click <strong>Refresh</strong>.</li>
                <li>If the URL changed, paste the latest URL from above.</li>
                <li>Start a new chat and ask ChatGPT to use the app.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Claude</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open the Connectors page and select this connector.</li>
                <li>Refresh or update the connector's tools.</li>
                <li>If the URL changed, paste the latest URL from above.</li>
                <li>Ask Claude to use the app.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/50 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Analysis pipeline: GEOquery → limma → NMF (Brunet algorithm)
        </div>
      </footer>
    </div>
  );
}
