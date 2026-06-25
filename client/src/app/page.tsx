import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhySufra } from "@/components/sections/WhySufra";
import { StatsSection } from "@/components/sections/StatsSection";
import { AppShowcase } from "@/components/sections/AppShowcase";
import { VideoSection } from "@/components/sections/VideoSection";
import { JoinUsSection } from "@/components/sections/JoinUsSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <WhySufra />
        <StatsSection />
        <AppShowcase />
        <VideoSection />
        <JoinUsSection />
      </main>
      <Footer />
    </>
  );
}
