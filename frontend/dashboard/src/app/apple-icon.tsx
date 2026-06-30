import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — Sufra serving-dome mark on brand green.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #27a36c 0%, #1f8a5b 100%)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="150" r="17" fill="#ffffff" />
          <rect x="250" y="160" width="12" height="26" rx="6" fill="#ffffff" />
          <path d="M120 332a136 136 0 0 1 272 0Z" fill="#ffffff" />
          <rect x="96" y="332" width="320" height="26" rx="13" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
