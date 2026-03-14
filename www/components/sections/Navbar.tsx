"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Github, Download } from "lucide-react"
import Image from "next/image"
import GlassSurface from "@/components/GlassSurface"
import ShinyText from "@/components/ShinyText"

const navLinks = [
  { name: "功能", href: "#features" },
  { name: "特性", href: "#tech" },
  { name: "下载", href: "#download" },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pt-4"
      >
        <GlassSurface
          width="100%"
          height={64}
          borderRadius={50}
          borderWidth={0.5}
          brightness={isScrolled ? 12 : 8}
          opacity={0.85}
          blur={isScrolled ? 20 : 16}
          backgroundOpacity={isScrolled ? 0.4 : 0.25}
          saturation={1.5}
          className="max-w-7xl mx-auto"
          redOffset={0}
          greenOffset={0}
          blueOffset={0}
        >
          <div className="flex items-center justify-between w-full h-full px-6">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2.5 group">
              <Image
                src="/icon.png"
                alt="LinClaw"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold">
                <ShinyText
                  text="LinClaw"
                  speed={1.5}
                  color="#ffffff"
                  shineColor="#a78bfa"
                  spread={50}
                />
              </span>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="relative px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/5"
                >
                  {link.name}
                </a>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center">
              <a
                href="https://github.com/sunqirui1987/linx-claw"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </GlassSurface>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mt-2"
            >
              <GlassSurface
                width="100%"
                borderRadius={16}
                borderWidth={0.05}
                brightness={15}
                opacity={0.9}
                blur={24}
                backgroundOpacity={0.5}
                saturation={1.5}
                className="overflow-hidden"
              >
                <nav className="flex flex-col p-3">
                  {navLinks.map((link, index) => (
                    <motion.a
                      key={link.name}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                    >
                      {link.name}
                    </motion.a>
                  ))}
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2">
                    <a
                      href="https://github.com/sunqirui1987/linx-claw"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Github className="w-5 h-5" />
                      <span>GitHub</span>
                    </a>
                  </div>
                </nav>
              </GlassSurface>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  )
}
