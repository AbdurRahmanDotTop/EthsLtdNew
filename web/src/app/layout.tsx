import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ETHSLTD Crypto - Trade Crypto With Clarity",
  description: "The modern digital asset platform. Trade crypto with clarity and confidence.",
  icons: {
    icon: "/media/usedMedia/logo-circle.png",
    shortcut: "/media/usedMedia/logo-circle.png",
    apple: "/media/usedMedia/logo-circle.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} min-h-screen bg-[#121212] text-[#F1F5F9] font-sans antialiased pb-[calc(64px+env(safe-area-inset-bottom))]`}
        suppressHydrationWarning
      >
        <Header />
        <main className="flex-1 w-full max-w-screen-xl mx-auto pb-16">
          {children}
        </main>
        <BottomNavigation />
        <Toaster
          richColors
          position="top-right"
          theme="dark"
          closeButton
          toastOptions={{
            closeButton: true,
            classNames: {
              closeButton: "!bg-[#1E202B] !text-gray-200 hover:!text-white !border-white/20 hover:!border-white/40 !opacity-100 !visible shadow-md cursor-pointer",
            },
          }}
        />
      </body>
    </html>
  );
}
