import { Sidebar } from "@/components/layout/Sidebar";
import { StatusGuard } from "@/providers/StatusGuard";
import { OrderAlerts } from "@/components/dashboard/OrderAlerts";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StatusGuard>
      {/* Bell + toast on new orders and status changes (realtime socket). */}
      <OrderAlerts />
      {/* Imperative confirm() dialog replacement — mounted once. */}
      <ConfirmDialogHost />
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main
          className="min-h-screen flex flex-col"
          style={{ marginRight: "var(--sidebar-width, 240px)" }}
        >
          {children}
        </main>
      </div>
    </StatusGuard>
  );
}
