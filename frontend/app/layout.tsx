import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookLeaf — Author Support Portal",
  description: "BookLeaf Publishing's Author Support & Communication Portal — manage your books, royalties, and support tickets.",
  keywords: ["BookLeaf", "publishing", "author portal", "self-publishing", "royalties"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
