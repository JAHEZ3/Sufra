"use client";

import { useContactInfo } from "@/hooks/useContact";

interface DownloadButtonsProps {
  size?: "md" | "lg";
}

export function DownloadButtons({ size = "lg" }: DownloadButtonsProps) {
  const { data: contact } = useContactInfo();
  const iosHref = contact?.appStoreUrl ?? "#";
  const androidHref = contact?.googlePlayUrl ?? "#";

  const disabledIos = !contact?.appStoreUrl;
  const disabledAndroid = !contact?.googlePlayUrl;

  const padding = size === "lg" ? "px-6 py-4" : "px-5 py-3";
  const badgeSize = size === "lg" ? "w-9 h-9" : "w-7 h-7";

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
      <a
        href={iosHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabledIos}
        onClick={(e) => {
          if (disabledIos) e.preventDefault();
        }}
        className={`group flex items-center gap-3 bg-[#16201b] hover:bg-[#16201a] text-white rounded-2xl ${padding} shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-200 hover:-translate-y-0.5 ${disabledIos ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span className={`${badgeSize} flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.2 1.28-2.18 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.73M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
        </span>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[11px] text-white/70 font-medium">حمّل من</span>
          <span className="text-lg font-black">App Store</span>
        </div>
      </a>

      <a
        href={androidHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabledAndroid}
        onClick={(e) => {
          if (disabledAndroid) e.preventDefault();
        }}
        className={`group flex items-center gap-3 bg-[#1f8a5b] hover:bg-[#176f49] text-white rounded-2xl ${padding} shadow-[0_8px_24px_rgba(31,138,91,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${disabledAndroid ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span className={`${badgeSize} flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
            <path d="M3.18 23.76c.37.2.8.2 1.18.01l11.62-6.54-2.5-2.5-10.3 9.03zm15.48-9.35L6.04 7.87 3.17.25C2.79.45 2.5.83 2.5 1.34v21.32c0 .5.28.88.67 1.08l10.83-9.33zm2.15-1.2L17.4 11.5l2.41-1.34-2.41-1.35-9.6-5.42 2.79 2.79 8.22 6.03zM4.36.26L16.8 6.78l-2.5 2.5L3.54.24c.25-.13.55-.12.82.02z" />
          </svg>
        </span>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[11px] text-white/80 font-medium">حمّل من</span>
          <span className="text-lg font-black">Google Play</span>
        </div>
      </a>
    </div>
  );
}
