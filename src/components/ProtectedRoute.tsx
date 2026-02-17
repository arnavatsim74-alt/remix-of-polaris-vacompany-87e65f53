import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, pilot, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  const { data: applicationStatus, isLoading: isApplicationLoading } = useQuery({
    queryKey: ["pilot-application-status", user?.id],
    enabled: !!user && !pilot,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilot_applications")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data?.status || null;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is authenticated but has no pilot profile, check application status first.
  if (!pilot) {
    if (isApplicationLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Checking application status...</p>
          </div>
        </div>
      );
    }

    const title = applicationStatus === "approved" ? "Application Approved" : "Application Pending";
    const description =
      applicationStatus === "approved"
        ? "Your application is approved, but your pilot profile is still being provisioned. Please try signing out and back in. If this continues, contact an administrator."
        : "Your pilot application is being reviewed. You'll receive access once approved by an administrator.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{title}</h1>
          <p className="text-muted-foreground mb-6">{description}</p>
          <button
            onClick={() => (window.location.href = "/apply")}
            className="text-primary hover:underline"
          >
            Check application status
          </button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
