interface PageHeroProps {
  badge?: string;
  title: string;
  highlight?: string;
  description?: string;
}

export function PageHero({ badge, title, highlight, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden gradient-hero py-20 md:py-28">
      {/* dot pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {badge && (
          <span className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
            {badge}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4">
          {title}
          {highlight && (
            <>
              {" "}
              <span className="text-white/80">{highlight}</span>
            </>
          )}
        </h1>
        {description && (
          <p className="text-white/75 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            {description}
          </p>
        )}
      </div>

      {/* wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full">
          <path
            d="M0 60L60 50C120 40 240 20 360 16C480 12 600 24 720 28C840 32 960 28 1080 22C1200 16 1320 8 1380 4L1440 0V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
