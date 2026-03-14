"use client"

import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import Image from "next/image"
import StarBorder from "@/components/StarBorder"
import CardSwap, { Card } from "@/components/CardSwap"

// Dynamically import Dither to avoid SSR issues with Three.js / React Three Fiber
const Dither = dynamic(() => import("@/components/Dither"), {
  ssr: false,
})

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Dither Background */}
      <div className="absolute inset-0 z-0">
        <Dither
          waveColor={[0.388, 0.4, 0.945]}
          waveSpeed={0.02}
          waveFrequency={3}
          waveAmplitude={0.3}
          colorNum={4}
          pixelSize={4}
          enableMouseInteraction={true}
          mouseRadius={1}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-[#0a0a0f]/60 via-[#0a0a0f]/40 to-[#0a0a0f]/80 pointer-events-none" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[calc(100vh-10rem)]">
          {/* Left: Text Content */}
          <div className="pointer-events-none order-2 lg:order-1">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center lg:justify-start mb-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30 backdrop-blur-sm select-none">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-violet-200">
                  AI 个人助理 · 开源免费
                </span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-center lg:text-left text-white tracking-tight drop-shadow-2xl select-none">
                LinClaw
              </h1>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center lg:text-left text-lg md:text-xl text-slate-300 max-w-2xl mx-auto lg:mx-0 mb-4 drop-shadow-lg select-none"
            >
              让 AI 真正替你做事
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center lg:text-left text-base text-slate-400 max-w-xl mx-auto lg:mx-0 mb-10 drop-shadow select-none"
            >
              支持多平台接入 · 桌面客户端 · 定时任务 · MCP 协议
            </motion.p>

            {/* CTA Buttons - 重新启用鼠标事件 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 pointer-events-auto"
            >
              <StarBorder
                as="a"
                href="#download"
                className="cursor-pointer"
                color="#6366f1"
                speed="6s"
                thickness={1}
              >
                <span className="flex items-center gap-2">
                  <span>立即下载</span>
                </span>
              </StarBorder>

              <a
                href="https://github.com/sunqirui1987/linx-claw"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-full border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors duration-300 backdrop-blur-sm bg-black/20"
              >
                GitHub 仓库
              </a>
            </motion.div>
          </div>

          {/* Right: CardSwap Showcase */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative h-[500px] md:h-[600px] lg:h-[640px] flex items-end justify-center order-1 lg:order-2 pointer-events-auto pb-4"
          >
            <div className="relative w-full flex items-end justify-center">
              <CardSwap
                width={640}
                height={400}
                cardDistance={55}
                verticalDistance={55}
                delay={4500}
                pauseOnHover={true}
                easing="elastic"
                skewAmount={4}
                className="relative perspective-distant translate-y-12"
              >
                <Card customClass="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src="/images/chat-tools.png"
                    alt="Chat Tools"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    quality={85}
                    className="object-cover"
                    priority
                  />
                </Card>
                <Card customClass="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src="/images/full-skills-support.png"
                    alt="Skills Support"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    quality={85}
                    className="object-cover"
                  />
                </Card>
                <Card customClass="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src="/images/memory-system.png"
                    alt="Memory System"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    quality={85}
                    className="object-cover"
                  />
                </Card>
                <Card customClass="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src="/images/task-jobs.png"
                    alt="Task Jobs"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    quality={85}
                    className="object-cover"
                  />
                </Card>
                <Card customClass="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src="/images/soul.png"
                    alt="Soul"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    quality={85}
                    className="object-cover"
                  />
                </Card>
              </CardSwap>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-[#0a0a0f] to-transparent z-20 pointer-events-none" />
    </section>
  )
}
