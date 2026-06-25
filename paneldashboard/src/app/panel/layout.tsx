import { Sidebar } from "@/components/layout/Sidebar";
import RealtimeBoot from "@/components/layout/RealtimeBoot";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Opens the shared socket connection + subscribes to order-list
          invalidations. Renders no DOM. */}
      <RealtimeBoot />
      <Sidebar />
      <main
        className="min-h-screen"
        style={{ marginRight: "var(--sidebar-width, 240px)" }}
      >
        {children}
      </main>
    </div>
  );
}
