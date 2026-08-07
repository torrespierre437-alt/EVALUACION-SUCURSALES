import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PushRegistration } from "./push-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Evaluación de Sucursales",
  description: "Evaluación mensual de imagen, mantenimiento y puntualidad de sucursales",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#00016d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full w-full overflow-x-hidden bg-slate-50">
        <PushRegistration />
        {children}
      </body>
    </html>
  );
}
