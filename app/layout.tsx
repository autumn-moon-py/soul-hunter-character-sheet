import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "狩魂者车卡器",
  description: "《狩魂者TRPG》专用角色工作台",
  other: {
    "app-version": process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
