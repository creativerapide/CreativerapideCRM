import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Rapide · CRM",
  description: "CRM intern Creative Rapide",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
