import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignVoice — ภาษามือเป็นข้อความและเสียง",
  description: "เว็บต้นแบบสำหรับตรวจจับท่าทางมือแบบเรียลไทม์ แสดงข้อความ และอ่านออกเสียงภาษาไทย",
  applicationName: "SignVoice",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  },
  manifest: "/site.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#070a0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
