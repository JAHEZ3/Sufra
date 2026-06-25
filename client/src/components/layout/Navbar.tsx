"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useContactInfo } from "@/hooks/useContact";

const NAV_LINKS = [
  { label: "الرئيسية", href: "#home" },
  { label: "لماذا جاهز؟", href: "#why" },
  { label: "التطبيق", href: "#app" },
  { label: "انضم إلينا", href: "#join" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: contact } = useContactInfo();
  const appDownloadHref = contact?.appDownloadUrl ?? "#app";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.08)]"
          : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center p-1 group">
            <Image
              src="/sufra-mark.png"
              alt="جاهز"
              width={52}
              height={52}
              priority
              unoptimized
              className={cn(
                "object-contain transition-all duration-700 ease-out group-hover:scale-125 group-hover:-rotate-6",
                isScrolled
                  ? "drop-shadow-[0_4px_12px_rgba(31,138,91,0.35)] group-hover:drop-shadow-[0_10px_24px_rgba(31,138,91,0.6)]"
                  : "brightness-0 invert drop-shadow-[0_4px_12px_rgba(255,255,255,0.45)] group-hover:drop-shadow-[0_10px_24px_rgba(255,255,255,0.7)]",
              )}
            />
            <div className="overflow-hidden max-w-0 group-hover:max-w-xs transition-[max-width] duration-700 ease-out">
              <span
                className={cn(
                  "block whitespace-nowrap ps-2.5 text-3xl font-black tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out delay-200",
                  isScrolled ? "text-[#1f8a5b]" : "text-white",
                )}
              >
                جاهز
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                  isScrolled
                    ? "text-gray-700 hover:bg-[#1f8a5b]/10 hover:text-[#1f8a5b]"
                    : "text-white/90 hover:bg-white/10 hover:text-white",
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button asChild variant={isScrolled ? "default" : "secondary"} size="sm">
              <a href={appDownloadHref}>حمّل التطبيق</a>
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isScrolled
                ? "text-gray-700 hover:bg-gray-100"
                : "text-white hover:bg-white/10",
            )}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-3 rounded-lg text-gray-700 font-semibold hover:bg-[#e6f2ec] hover:text-[#1f8a5b] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
              <Button variant="outline" size="sm" className="flex-1">
                تسجيل الدخول
              </Button>
              <Button asChild size="sm" className="flex-1">
                <a href={appDownloadHref} onClick={() => setIsMenuOpen(false)}>
                  حمّل التطبيق
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
