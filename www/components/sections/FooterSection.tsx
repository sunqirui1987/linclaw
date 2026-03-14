"use client";

import { Github } from "lucide-react";
import ShinyText from "@/components/ShinyText";

const footerLinks = {
  product: [
    { name: "功能特性", href: "#features" },
    { name: "技术文档", href: "#tech" },
    { name: "下载安装", href: "#download" },
  ],
  community: [
    { name: "GitHub", href: "https://github.com/sunqirui1987/linx-claw" },
  ],
};

export default function FooterSection() {
  return (
    <footer className="relative bg-[#0a0a0f] border-t border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="text-2xl font-bold text-white mb-4">
              <ShinyText
                text="LinClaw"
                speed={2}
                color="#ffffff"
                shineColor="#a78bfa"
                spread={80}
              />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-sm">
              让 AI 真正替你做事，
              支持多平台接入，开源免费，让 AI 触手可及。
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/sunqirui1987/linx-claw"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">产品</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">社区</h4>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-slate-800/50">
          <p className="text-sm text-slate-500">
            © 2025 LinClaw. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
