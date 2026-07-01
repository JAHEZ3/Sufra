import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";

const DEFAULT_TITLE = "جاهز | أكبر منصة توصيل طعام في فلسطين";
const DEFAULT_DESCRIPTION =
  "اطلب من أفضل المطاعم في فلسطين. توصيل سريع، أكثر من 1200 مطعم، خدمة ممتازة على مدار الساعة.";

interface SeoFields {
  platformName: string;
  seoTitleTemplate: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
}

async function getSeoSettings(): Promise<SeoFields | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_MANAGER_URL ?? "http://localhost:3006/api/manager";
  try {
    const res = await fetch(`${baseUrl}/public/contact/info`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SeoFields };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();

  // `%s` in the template is replaced by Next.js with the page's own `title`;
  // pages that don't set a title fall back to the `default`.
  const defaultTitle = seo?.platformName
    ? `${seo.platformName} | أكبر منصة توصيل طعام في فلسطين`
    : DEFAULT_TITLE;
  const description = seo?.seoDescription ?? DEFAULT_DESCRIPTION;
  const template = seo?.seoTitleTemplate ?? null;
  const ogImage = seo?.seoOgImageUrl ?? null;

  return {
    title: template ? { default: defaultTitle, template } : defaultTitle,
    description,
    keywords: ["توصيل طعام", "فلسطين", "مطاعم", "جاهز", "طلب طعام أونلاين"],
    authors: [{ name: seo?.platformName ?? "جاهز" }],
    // Tab/bookmark icon follows the platform's branding image when set (white-label);
    // otherwise the static app/favicon.ico is served by the file-based convention.
    icons: ogImage
      ? { icon: ogImage, shortcut: "/favicon.ico", apple: ogImage }
      : { icon: "/favicon.ico", shortcut: "/favicon.ico" },
    openGraph: {
      title: defaultTitle,
      description,
      type: "website",
      locale: "ar_PS",
      ...(ogImage && { images: [{ url: ogImage }] }),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: defaultTitle,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f8a5b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ fontFamily: "'Cairo', Arial, sans-serif" }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
