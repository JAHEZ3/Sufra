"use client";

import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";

export default function PendingApprovalPage() {
  const logout = useLogout();

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
        <Clock className="w-8 h-8 text-amber-600" />
      </div>

      <h1 className="text-2xl font-black text-foreground mb-3">طلبك قيد المراجعة</h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-6">
        شكراً لتسجيلك في جاهز. سيقوم فريقنا بمراجعة بيانات مطعمك خلال 24–48 ساعة،
        وسنرسل لك إشعاراً فور اعتماد حسابك.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-right mb-6">
        <p className="text-xs text-amber-800 leading-relaxed">
          في هذه الأثناء، تأكد من صحة المستندات المقدمة. قد يتواصل معك فريق المراجعة
          عبر رقم الجوال المسجّل إذا احتجنا لأي توضيح.
        </p>
      </div>

      <Button
        variant="outline"
        className="w-full h-11"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
      >
        <LogOut className="w-4 h-4 ml-2" />
        تسجيل الخروج
      </Button>
    </div>
  );
}
