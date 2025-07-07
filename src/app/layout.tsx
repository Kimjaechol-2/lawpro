import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWAInstaller } from "@/components/pwa-installer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NotebookLM",
  description: "AI-powered notebook for research and writing",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NotebookLM",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <PWAInstaller />
      </body>
    </html>
  );
}
