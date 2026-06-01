import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { AuthInterceptor } from "@/components/auth-interceptor";

export const metadata: Metadata = {
  title: "Job Board",
  description: "Browse scraped jobs from the database.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthInterceptor />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
