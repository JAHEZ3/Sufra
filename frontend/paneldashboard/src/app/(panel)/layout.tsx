import { Sidebar } from "@/components/layout/Sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
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
