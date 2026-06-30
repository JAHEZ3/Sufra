import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { RouterProvider } from "@/providers/RouterProvider";
import { CurrencyProvider } from "@/providers/CurrencyProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://sufra.app"),
  title: {
    default: "سُفرة | منصة إدارة المطاعم",
    template: "%s | سُفرة",
  },
  description:
    "سُفرة منصة متكاملة لإدارة المطاعم: نقاط البيع، الطلبات، المخزون، المحاسبة والتحليلات في مكان واحد.",
  applicationName: "سُفرة",
  keywords: ["سُفرة", "Sufra", "إدارة المطاعم", "نقاط البيع", "POS", "مطعم"],
  authors: [{ name: "Sufra" }],
  openGraph: {
    title: "سُفرة | منصة إدارة المطاعم",
    description:
      "منصة متكاملة لإدارة المطاعم: نقاط البيع، الطلبات، المخزون، المحاسبة والتحليلات.",
    siteName: "سُفرة",
    locale: "ar_SA",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f8a5b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Reem+Kufi:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>
          <RouterProvider>
            <CurrencyProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </CurrencyProvider>
          </RouterProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
