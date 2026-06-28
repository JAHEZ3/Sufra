import { Header } from "@/components/layout/Header";
import { OverviewBoard } from "@/components/dashboard/OverviewBoard";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <OverviewBoard />
    </div>
  );
}
