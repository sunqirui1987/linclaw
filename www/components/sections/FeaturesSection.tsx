"use client";

import { motion } from "framer-motion";
import MagicBento from "@/components/MagicBento";
import ShinyText from "@/components/ShinyText";

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 md:py-32 bg-[#0a0a0f]">
      {/* Section header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            <ShinyText
              text="核心功能"
              speed={3}
              color="#b5b5b5"
              shineColor="#ffffff"
              spread={100}
            />
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            一站式 AI 助理解决方案，覆盖多平台、多场景
          </p>
        </motion.div>
      </div>

      {/* Magic Bento Grid */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <MagicBento
          textAutoHide={true}
          enableStars={true}
          enableSpotlight={true}
          enableBorderGlow={true}
          disableAnimations={false}
          spotlightRadius={300}
          particleCount={12}
          enableTilt={false}
          glowColor="132, 0, 255"
          clickEffect={true}
          enableMagnetism={true}
        />
      </motion.div>
    </section>
  );
}
