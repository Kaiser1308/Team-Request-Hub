import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Team Request Hub",
  description: "Internal request workflow tool for team coordination",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${rajdhani.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
