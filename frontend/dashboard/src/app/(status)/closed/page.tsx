"use client";

import { XCircle, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";

export default function ClosedPage() {
  const logout = useLogout();

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-5">
        <XCircle className="w-8 h-8 text-slate-600" />
      </div>

      <h1 className="text-2xl font-black text-foreground mb-3">الحساب مُغلق</h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-6">
        تم إغلاق حساب مطعمك. إذا كنت ترغب في إعادة التفعيل أو لديك أي استفسار،
        يُرجى التواصل مع فريق الدعم.
      </p>

      <a
        href="mailto:support@jahaz.app"
        className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-primary/10 text-primary font-bold text-sm hover:bg-primary/15 transition-colors mb-3"
      >
        <Mail className="w-4 h-4" />
        تواصل مع الدعم
      </a>

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
