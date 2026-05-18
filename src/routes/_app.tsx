import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-lg bg-studio-accent animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-studio-bg text-foreground">
      <AppSidebar />
      <div className="flex-1 pl-16 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
