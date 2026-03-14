"use client";

import { motion } from "framer-motion";
import { 
  Bot, 
  Cloud, 
  MessageSquare, 
  Terminal, 
  Clock, 
  Settings,
  Zap,
  Shield
} from "lucide-react";
import SpotlightCard from "@/components/SpotlightCard";
import ShinyText from "@/components/ShinyText";

const techFeatures = [
  {
    icon: Bot,
    title: "ReAct Agent",
    description: "基于 AgentScope 的 ReAct 智能体架构，支持复杂任务分解与多步推理",
  },
  {
    icon: Cloud,
    title: "七牛云 MaaS",
    description: "企业级模型即服务驱动，API Key 即用即走，数据主权自主掌控",
  },
  {
    icon: MessageSquare,
    title: "多平台接入",
    description: "支持钉钉、飞书、QQ、Discord、iMessage 等多种消息渠道",
  },
  {
    icon: Terminal,
    title: "内置工具",
    description: "Shell、文件操作、浏览器、截图等内置工具开箱即用",
  },
  {
    icon: Clock,
    title: "定时任务",
    description: "基于 APScheduler 的定时任务系统，支持 Cron 表达式",
  },
  {
    icon: Settings,
    title: "MCP 协议",
    description: "支持 Model Context Protocol，可接入任意 MCP 服务",
  },
  {
    icon: Zap,
    title: "热重载配置",
    description: "配置文件修改即时生效，无需重启服务",
  },
  {
    icon: Shield,
    title: "记忆管理",
    description: "智能记忆压缩与管理，支持长期对话上下文保持",
  },
];

export default function TechSection() {
  return (
    <section id="tech" className="relative py-24 md:py-32 bg-[#0a0a0f]">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-transparent to-violet-950/10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            <ShinyText
              text="技术特性"
              speed={3}
              color="#b5b5b5"
              shineColor="#ffffff"
              spread={100}
            />
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            强大的技术栈支撑，灵活可扩展的架构设计
          </p>
        </motion.div>

        {/* Tech cards grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {techFeatures.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <SpotlightCard
                className="h-full min-h-[200px] flex flex-col"
                spotlightColor="rgba(99, 102, 241, 0.15)"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <feature.icon className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed flex-1">
                  {feature.description}
                </p>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
