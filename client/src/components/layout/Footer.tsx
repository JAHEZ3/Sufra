"use client";

import Image from "next/image";
import Link from "next/link";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";
import { useContactInfo } from "@/hooks/useContact";
import type { ContactInfoDTO } from "@/types/dto";

const FALLBACK: ContactInfoDTO = {
  platformName: "جاهز",
  supportEmail: "info@sufra.ps",
  supportPhone: "+970 59 000 0000",
  supportWhatsapp: null,
  supportAddress: "غزة، فلسطين",
  supportHours: null,
  logoUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  xUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
  snapchatUrl: null,
  appStoreUrl: null,
  googlePlayUrl: null,
};

const FOOTER_LINKS = {
  company: [
    { label: "من نحن", href: "/about" },
    { label: "المدونة", href: "/blog" },
    { label: "اتصل بنا", href: "/contact" },
  ],
  partner: [
    { label: "انضم كمطعم", href: "/#join" },
    { label: "انضم كسائق", href: "/#join" },
  ],
  support: [
    { label: "مركز المساعدة", href: "/help" },
    { label: "سياسة الخصوصية", href: "/privacy" },
    { label: "الشروط والأحكام", href: "/terms" },
    { label: "سياسة الإرجاع", href: "/returns" },
  ],
};

const SOCIAL_ICONS: Record<
  "facebookUrl" | "instagramUrl" | "xUrl" | "youtubeUrl" | "tiktokUrl" | "snapchatUrl",
  { label: string; svg: React.ReactElement }
> = {
  facebookUrl: {
    label: "Facebook",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  instagramUrl: {
    label: "Instagram",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  xUrl: {
    label: "X (Twitter)",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  youtubeUrl: {
    label: "YouTube",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29.94 29.94 0 001 12a29.94 29.94 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29.94 29.94 0 0023 12a29.94 29.94 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    ),
  },
  tiktokUrl: {
    label: "TikTok",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-6.04 11.21 6.85 6.85 0 0011.13-5.34V8.66a8.16 8.16 0 004.79 1.55V6.77a4.85 4.85 0 01-.65-.08z" />
      </svg>
    ),
  },
  snapchatUrl: {
    label: "Snapchat",
    svg: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M12.166.001c.181 0 .35.005.474.013 1.738.073 3.21.853 4.16 2.224.876 1.265 1.143 2.835 1.062 4.45-.013.255-.032.51-.05.766 0 .015-.005.078-.005.094 0 .05 0 .096.026.13.041.046.115.07.182.07.183 0 .421-.121.674-.245.196-.097.4-.198.59-.198.064 0 .128.005.187.022.265.06.461.235.535.461.082.255-.014.534-.282.78-.187.171-.43.32-.677.444-.27.137-.553.265-.677.45-.069.105-.087.222-.05.343.018.067.045.13.073.197 1.108 2.59 4.087 2.985 4.13 2.99.18.022.31.165.31.346 0 .074-.027.148-.073.213-.378.508-1.477.728-2.358.79-.046 0-.082.013-.123.027-.064.064-.082.158-.105.255-.041.181-.105.387-.245.55-.205.232-.466.245-.755.245-.064 0-.13-.005-.196-.014-.196-.027-.396-.04-.591-.04-.391 0-.762.082-1.117.213-.482.18-.946.452-1.39.722-.74.45-1.49.913-2.444.913h-.064c-.954 0-1.704-.463-2.444-.913-.443-.27-.908-.541-1.39-.722-.355-.131-.726-.213-1.117-.213-.195 0-.395.013-.591.04-.066.009-.132.014-.196.014-.289 0-.55-.013-.755-.245-.14-.163-.204-.369-.245-.55-.023-.097-.04-.191-.105-.255-.041-.014-.077-.027-.123-.027-.881-.062-1.98-.282-2.358-.79a.345.345 0 01-.073-.213c0-.181.13-.324.31-.346.043-.005 3.022-.4 4.13-2.99.027-.067.054-.13.072-.197.037-.121.018-.238-.05-.343-.123-.184-.407-.312-.677-.45-.246-.123-.49-.272-.677-.443-.268-.246-.364-.526-.282-.78.074-.227.27-.402.535-.462.06-.017.123-.022.187-.022.19 0 .394.101.59.198.253.124.491.245.674.245.067 0 .14-.024.182-.07.027-.034.027-.08.027-.13 0-.016-.005-.079-.005-.094-.018-.255-.037-.51-.05-.766-.082-1.615.186-3.185 1.061-4.45.95-1.371 2.422-2.151 4.16-2.224.124-.008.293-.013.474-.013z" />
      </svg>
    ),
  },
};

export function Footer() {
  const { data } = useContactInfo();
  const info = data ?? FALLBACK;
  const waNumber = info.supportWhatsapp?.replace(/\D/g, "") ?? "";

  return (
    <footer className="bg-[#16201b] text-white">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5 p-2 group cursor-pointer w-fit bg-white/5 rounded-2xl backdrop-blur-sm transition-all duration-700 ease-out hover:bg-white/10">
              <Image
                src="/sufra-mark.png"
                alt="جاهز"
                width={60}
                height={60}
                unoptimized
                className="object-contain drop-shadow-[0_4px_16px_rgba(31,138,91,0.4)] transition-all duration-700 ease-out group-hover:scale-125 group-hover:-rotate-6 group-hover:drop-shadow-[0_10px_28px_rgba(31,138,91,0.7)]"
              />
              <span className="text-4xl font-black text-[#1f8a5b] transition-all duration-700 ease-out group-hover:tracking-wider">جاهز</span>
            </div>
            <p className="text-white/60 leading-relaxed text-sm mb-6">
              أكبر منصة لتوصيل الطعام في فلسطين. نربط بين أفضل المطاعم
              والعملاء من خلال تجربة طلب سهلة وتوصيل سريع.
            </p>

            {/* Contact */}
            <div className="flex flex-col gap-3">
              <a
                href={`tel:${info.supportPhone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 text-white/60 hover:text-white text-sm transition-colors"
              >
                <Phone className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <span dir="ltr">{info.supportPhone}</span>
              </a>
              <a
                href={`mailto:${info.supportEmail}`}
                className="flex items-center gap-3 text-white/60 hover:text-white text-sm transition-colors"
              >
                <Mail className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <span>{info.supportEmail}</span>
              </a>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-white/60 hover:text-white text-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <span dir="ltr">{info.supportWhatsapp}</span>
                </a>
              )}
              {info.supportAddress && (
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <MapPin className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <span>{info.supportAddress}</span>
                </div>
              )}
              {info.supportHours && (
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <Clock className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <span>{info.supportHours}</span>
                </div>
              )}
            </div>

            {/* Social */}
            <div className="flex gap-3 mt-6 flex-wrap">
              {(Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[])
                .filter((key) => Boolean(info[key]))
                .map((key) => {
                  const { svg, label } = SOCIAL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={info[key]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="w-10 h-10 rounded-lg bg-white/10 hover:bg-[#1f8a5b] flex items-center justify-center transition-colors duration-200 text-white"
                    >
                      {svg}
                    </a>
                  );
                })}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold mb-5 text-base">الشركة</h4>
            <ul className="flex flex-col gap-3">
              {FOOTER_LINKS.company.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-white/60 hover:text-[#1f8a5b] text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-5 text-base">الشراكة</h4>
            <ul className="flex flex-col gap-3">
              {FOOTER_LINKS.partner.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-white/60 hover:text-[#1f8a5b] text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-5 text-base">الدعم</h4>
            <ul className="flex flex-col gap-3">
              {FOOTER_LINKS.support.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-white/60 hover:text-[#1f8a5b] text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* App Download */}
        <div className="mt-14 pt-10 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-white/50 text-sm">
              © {new Date().getFullYear()} جاهز. جميع الحقوق محفوظة.
            </p>
            <div className="flex gap-3">
              {info.appStoreUrl && (
                <a
                  href={info.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.2 1.28-2.18 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.73M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <div className="text-white/60 text-[10px]">حمّل من</div>
                    <div className="text-white font-semibold text-xs">App Store</div>
                  </div>
                </a>
              )}
              {info.googlePlayUrl && (
                <a
                  href={info.googlePlayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M3.18 23.76c.37.2.8.2 1.18.01l11.62-6.54-2.5-2.5-10.3 9.03zm15.48-9.35L6.04 7.87 3.17.25C2.79.45 2.5.83 2.5 1.34v21.32c0 .5.28.88.67 1.08l10.83-9.33zm2.15-1.2L17.4 11.5l2.41-1.34-2.41-1.35-9.6-5.42 2.79 2.79 8.22 6.03zM4.36.26L16.8 6.78l-2.5 2.5L3.54.24c.25-.13.55-.12.82.02z" />
                  </svg>
                  <div>
                    <div className="text-white/60 text-[10px]">حمّل من</div>
                    <div className="text-white font-semibold text-xs">Google Play</div>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
