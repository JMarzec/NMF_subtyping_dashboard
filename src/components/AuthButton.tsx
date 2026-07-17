import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogIn, LogOut } from "lucide-react";

export function AuthButton() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  if (loading) return null;
  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => nav("/auth")}>
        <LogIn className="h-4 w-4 mr-1" /> Sign in
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground max-w-[160px] truncate hidden md:inline">{user.email}</span>
      <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
        <LogOut className="h-4 w-4 mr-1" /> Sign out
      </Button>
    </div>
  );
}
