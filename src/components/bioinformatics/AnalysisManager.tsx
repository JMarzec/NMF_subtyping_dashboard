import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeAnalysis } from "@/lib/analysisData";
import type { Json } from "@/integrations/supabase/types";
import type { NmfData } from "@/components/bioinformatics/JsonUploader";

type AnalysisRow = { id: string; name: string; created_at: string };

interface Props {
  data: NmfData;
  onLoad: (data: NmfData) => void;
}

export function AnalysisManager({ data, onLoad }: Props) {
  const { user } = useAuth();
  const activeUser=useRef(user?.id);
  activeUser.current=user?.id;
  const loadSequence=useRef(0);
  const refreshSequence=useRef(0);
  const rowsCount=useRef(0);
  const [hasMore,setHasMore]=useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  rowsCount.current=analyses.length;
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (append=false) => {
    if (!user) { setAnalyses([]); setSelected(""); return; }
    const sequence=++refreshSequence.current,userId=user.id,offset=append?rowsCount.current:0;
    const {data:rows,error}=await supabase.from("analyses").select("id,name,created_at").order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+99);
    if(activeUser.current!==userId||sequence!==refreshSequence.current)return;
    if(error){toast.error(error.message);return;}
    setAnalyses(previous=>append?[...new Map([...previous,...(rows??[])].map(r=>[r.id,r])).values()]:rows??[]);setHasMore(rows?.length===100);
  },[user]);
  useEffect(()=>{setSelected("");setAnalyses([]);loadSequence.current++;void refresh();},[refresh]);

  const save = async () => {
    if(!user){toast.error("Sign in to save analyses");return;}
    const finalName=name.trim()||`Analysis ${new Date().toLocaleString()}`;
    setSaving(true);
    try {
      const normalized=normalizeAnalysis(data),id=crypto.randomUUID();
      const {error}=await supabase.rpc("save_analysis",{p_id:id,p_name:finalName,p_document:JSON.parse(JSON.stringify(normalized)) as Json});
      if(error)throw error;
      const {data:stored,error:readError}=await supabase.from("analyses").select("document").eq("id",id).single();
      if(readError)throw readError;normalizeAnalysis(stored.document);
      toast.success(`Saved "${finalName}"`);setName("");await refresh();
    } catch(e:unknown){toast.error(e instanceof Error?e.message:"Save failed");}
    finally{setSaving(false);}
  };
  const load = async (id:string) => {
    const sequence=++loadSequence.current,userId=user?.id;setLoading(true);
    try {
      const {data:a,error}=await supabase.from("analyses").select("name,document").eq("id",id).single();
      if(error)throw error;
      if(!a.document)throw new Error("This older save is incomplete; re-import the original analysis JSON");
      const loaded=normalizeAnalysis(a.document);
      if(sequence!==loadSequence.current || userId!==activeUser.current)return;
      onLoad(loaded);toast.success(`Loaded "${a.name}"`);
    }catch(e:unknown){toast.error(e instanceof Error?e.message:"Load failed");}
    finally{if(sequence===loadSequence.current)setLoading(false);}
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
        {hasMore && <Button variant="outline" onClick={()=>refresh(true)}>More saved analyses</Button>}
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
