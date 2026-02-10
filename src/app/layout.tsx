import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "War Room Companion",
  description: "A multiplayer companion app for War Room by Larry Harris.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
