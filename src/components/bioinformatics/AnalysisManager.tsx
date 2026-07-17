import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { NmfData } from "@/components/bioinformatics/JsonUploader";

type AnalysisRow = { id: string; name: string; created_at: string };

interface Props {
  data: NmfData;
  onLoad: (data: NmfData) => void;
}

export function AnalysisManager({ data, onLoad }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setAnalyses([]); return; }
    const { data: rows, error } = await supabase
      .from("analyses")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setAnalyses(rows ?? []);
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const save = async () => {
    if (!user) { toast.error("Sign in to save analyses"); return; }
    const finalName = name.trim() || `Analysis ${new Date().toLocaleString()}`;
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          name: finalName,
          summary: data.summary as any,
          rank_metrics: (data.rankMetrics ?? null) as any,
          survival_data: (data.survivalData ?? null) as any,
          heatmap_data: (data.heatmapData ?? null) as any,
          survival_pvalue: data.survival_pvalue ?? null,
          cox_ph_results: (data.coxPHResults ?? null) as any,
        })
        .select("id")
        .single();
      if (error) throw error;
      const analysisId = inserted.id;

      if (data.samples?.length) {
        const rows = data.samples.map((s) => ({
          analysis_id: analysisId,
          sample_id: s.sample_id,
          subtype: s.subtype,
          data: s as any,
        }));
        const { error: e2 } = await supabase.from("analysis_samples").insert(rows);
        if (e2) throw e2;
      }
      if (data.markerGenes?.length) {
        const rows = data.markerGenes.map((g: any, idx) => ({
          analysis_id: analysisId,
          gene: g.gene,
          subtype: g.subtype,
          log_fold_change: g.log_fold_change ?? g.score ?? null,
          p_value: g.p_value ?? g.pValue ?? null,
          rank: g.rank ?? idx,
        }));
        const { error: e3 } = await supabase.from("analysis_marker_genes").insert(rows);
        if (e3) throw e3;
      }
      if (data.survivalData?.length) {
        const rows = data.survivalData.map((c: any) => ({
          analysis_id: analysisId,
          subtype: c.subtype,
          data: c as any,
        }));
        const { error: e4 } = await supabase.from("analysis_survival_curves").insert(rows);
        if (e4) throw e4;
      }

      toast.success(`Saved "${finalName}"`);
      setName("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const load = async (id: string) => {
    setLoading(true);
    try {
      const { data: a, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!a) throw new Error("Not found");
      const [{ data: samples }, { data: markers }, { data: surv }] = await Promise.all([
        supabase.from("analysis_samples").select("data").eq("analysis_id", id),
        supabase.from("analysis_marker_genes").select("gene, subtype, log_fold_change, p_value, rank").eq("analysis_id", id).order("rank"),
        supabase.from("analysis_survival_curves").select("data").eq("analysis_id", id),
      ]);
      const loaded: NmfData = {
        summary: a.summary as any,
        samples: (samples ?? []).map((r: any) => r.data),
        markerGenes: (markers ?? []).map((r: any) => ({
          gene: r.gene, subtype: r.subtype, score: r.log_fold_change, pValue: r.p_value,
        })) as any,
        heatmapData: (a.heatmap_data as any) ?? undefined,
        rankMetrics: (a.rank_metrics as any) ?? undefined,
        survivalData: (surv ?? []).map((r: any) => r.data),
        survival_pvalue: a.survival_pvalue ?? undefined,
        coxPHResults: (a.cox_ph_results as any) ?? undefined,
      };
      onLoad(loaded);
      toast.success(`Loaded "${a.name}"`);
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm("Delete this analysis?")) return;
    const { error } = await supabase.from("analyses").delete().eq("id", selected);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setSelected("");
    await refresh();
  };

  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">My analyses</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sign in to save analyses and connect this app to AI clients via MCP.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><FolderOpen className="h-5 w-5 text-primary" /> My analyses</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Name for current analysis" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />Save</Button>
        </div>
        <div className="flex gap-2">
          <Select value={selected} onValueChange={(v) => { setSelected(v); load(v); }}>
            <SelectTrigger disabled={loading || analyses.length === 0}>
              <SelectValue placeholder={analyses.length ? "Load saved analysis…" : "No saved analyses yet"} />
            </SelectTrigger>
            <SelectContent>
              {analyses.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {new Date(a.created_at).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" disabled={!selected} onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
