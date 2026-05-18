import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Film, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Projects — CreatorCut" }] }),
});

function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id: user.id, title: "Untitled project" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      window.location.href = `/editor/${p.id}`;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
  });

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-6 sticky top-0 bg-studio-bg/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <h1 className="font-medium">Your projects</h1>
          <span className="text-[10px] px-2 py-0.5 bg-studio-accent/20 text-studio-accent rounded uppercase tracking-wider">
            {projects.length}
          </span>
        </div>
        <Button onClick={() => createProject.mutate()} disabled={createProject.isPending} className="bg-studio-accent hover:bg-studio-accent/90 text-white">
          {createProject.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          New project
        </Button>
      </header>

      <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="relative max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-studio-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="pl-9 bg-studio-surface border-studio-border"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-video bg-studio-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => createProject.mutate()} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={() => deleteProject.mutate(p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: any; onDelete: () => void }) {
  return (
    <div className="group relative">
      <Link to="/editor/$projectId" params={{ projectId: project.id }} className="block">
        <div className="aspect-video bg-studio-surface rounded-xl overflow-hidden border border-studio-border group-hover:border-studio-accent transition-colors relative">
          {project.thumbnail_url ? (
            <img src={project.thumbnail_url} alt={project.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-studio-muted">
              <Film className="size-8 opacity-50" />
            </div>
          )}
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur text-[10px] font-mono rounded">
            {formatDuration(project.duration_seconds)}
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-sm font-medium truncate group-hover:text-studio-accent transition-colors">
            {project.title}
          </h3>
          <p className="text-[11px] text-studio-muted mt-0.5">
            Edited {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
          </p>
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); if (confirm("Delete this project?")) onDelete(); }}
        className="absolute top-2 right-2 size-8 rounded-lg bg-black/70 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-studio-muted hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-dashed border-studio-border rounded-2xl p-16 text-center">
      <div className="size-12 mx-auto rounded-xl bg-studio-accent/10 grid place-items-center mb-4">
        <Film className="size-6 text-studio-accent" />
      </div>
      <h3 className="font-medium">No projects yet</h3>
      <p className="text-sm text-studio-muted mt-1 mb-6">Create your first project to start editing.</p>
      <Button onClick={onCreate} className="bg-studio-accent hover:bg-studio-accent/90 text-white">
        <Plus className="size-4" /> New project
      </Button>
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
