import dynamic from "next/dynamic"
import Navbar from "@/components/sections/Navbar"
import HeroSection from "@/components/sections/HeroSection"

// Below-fold sections: split into separate JS chunks
const FeaturesSection = dynamic(
  () => import("@/components/sections/FeaturesSection"),
)
const TechSection = dynamic(() => import("@/components/sections/TechSection"))
const PlatformsSection = dynamic(
  () => import("@/components/sections/PlatformsSection"),
)
const DownloadSection = dynamic(
  () => import("@/components/sections/DownloadSection"),
)
const FooterSection = dynamic(
  () => import("@/components/sections/FooterSection"),
)

export default function Home() {
  return (
    <main className="relative">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <TechSection />
      <PlatformsSection />
      <DownloadSection />
      <FooterSection />
    </main>
  )
}
