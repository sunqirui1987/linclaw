import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "LinClaw - AI 个人助理",
  description: "让 AI 真正替你做事，支持多平台接入，开源免费",
  keywords: ["AI", "助理", "Agent", "AgentScope", "开源", "钉钉", "飞书", "QQ"],
  authors: [{ name: "LinClaw Team" }],
  openGraph: {
    title: "LinClaw - AI 个人助理",
    description: "让 AI 真正替你做事，支持多平台接入，开源免费",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased bg-[#0a0a0f]`}
      >
        {children}
      </body>
    </html>
  );
}
