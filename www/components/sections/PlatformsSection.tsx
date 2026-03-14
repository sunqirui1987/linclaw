"use client"

import { motion } from "framer-motion"
import LogoLoop from "@/components/LogoLoop"
import ShinyText from "@/components/ShinyText"
import {
  AntDesignDingdingOutlined,
  CibQq,
  IconParkOutlineNewLark,
  DiscordIcon,
  IMessageIcon,
  SlackIcon,
  TelegramIcon,
  WeChatIcon,
  WebIcon,
} from "@/components/icons"

const platforms = [
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <AntDesignDingdingOutlined className="w-6 h-6 text-[#007AFF]" />
        <span className="text-sm font-medium text-slate-200">钉钉</span>
      </div>
    ),
    title: "钉钉",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <IconParkOutlineNewLark className="w-6 h-6 text-[#00D6B9]" />
        <span className="text-sm font-medium text-slate-200">飞书</span>
      </div>
    ),
    title: "飞书",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <CibQq className="w-6 h-6 text-[#12B7F5]" />
        <span className="text-sm font-medium text-slate-200">QQ</span>
      </div>
    ),
    title: "QQ",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <WeChatIcon className="w-6 h-6 text-[#07C160]" />
        <span className="text-sm font-medium text-slate-200">微信</span>
      </div>
    ),
    title: "微信",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <DiscordIcon className="w-6 h-6 text-[#5865F2]" />
        <span className="text-sm font-medium text-slate-200">Discord</span>
      </div>
    ),
    title: "Discord",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <TelegramIcon className="w-6 h-6 text-[#26A5E4]" />
        <span className="text-sm font-medium text-slate-200">Telegram</span>
      </div>
    ),
    title: "Telegram",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <SlackIcon className="w-6 h-6 text-[#E01E5A]" />
        <span className="text-sm font-medium text-slate-200">Slack</span>
      </div>
    ),
    title: "Slack",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <IMessageIcon className="w-6 h-6 text-[#34C759]" />
        <span className="text-sm font-medium text-slate-200">iMessage</span>
      </div>
    ),
    title: "iMessage",
  },
  {
    node: (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
        <WebIcon className="w-6 h-6 text-slate-400" />
        <span className="text-sm font-medium text-slate-200">Web</span>
      </div>
    ),
    title: "Web",
  },
]

export default function PlatformsSection() {
  return (
    <section className="relative py-20 bg-[#0a0a0f] overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-transparent to-violet-950/10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            <ShinyText
              text="多平台支持"
              speed={3}
              color="#b5b5b5"
              shineColor="#ffffff"
              spread={100}
            />
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            一键接入主流通讯平台，一套 AI 覆盖全端场景
          </p>
        </motion.div>

        {/* LogoLoop */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative py-8"
        >
          <LogoLoop
            logos={platforms}
            speed={60}
            direction="left"
            logoHeight={56}
            gap={24}
            pauseOnHover={true}
            fadeOut={true}
            fadeOutColor="#0a0a0f"
            scaleOnHover={true}
            ariaLabel="Supported platforms"
          />
        </motion.div>
      </div>
    </section>
  )
}
