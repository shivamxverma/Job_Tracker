"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, ListChecks, Target, Mail, Linkedin, Megaphone, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [session, setSession] = useState<{
    authenticated: boolean;
    user: { name: string; email: string; avatar?: string } | null;
  }>({
    authenticated: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const json = await res.json();
      if (json.success) {
        setSession({
          authenticated: json.authenticated,
          user: json.user,
        });
      }
    } catch (err) {
      console.error("[Navbar Session Fetch Failed]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]); // Refresh session status on path change

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        localStorage.removeItem("outreach_api_key"); // clear cache key
        setSession({ authenticated: false, user: null });
        router.refresh();
        router.push("/");
      }
    } catch (err) {
      console.error("[Navbar Sign Out Failed]", err);
    } finally {
      setLoading(false);
    }
  };

  const navLinks = [
    { name: "Explore", href: "/", icon: Compass },
    { name: "Auto-Apply Queue", href: "/queue", icon: ListChecks },
    { name: "Tracker", href: "/tracker", icon: Target },
    { name: "Outreach", href: "/outreach", icon: Megaphone },
    { name: "Gmail", href: "/gmail", icon: Mail },
    { name: "LinkedIn", href: "/linkedin", icon: Linkedin },
  ];

  // Helper to extract initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg text-primary">
            JobScraper
          </Link>
          <div className="hidden md:flex gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-md flex items-center gap-2 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Authentication Status Section */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : session.authenticated && session.user ? (
            <div className="flex items-center gap-3">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-sm"
                title={`${session.user.name} (${session.user.email})`}
              >
                {getInitials(session.user.name)}
              </div>
              <span className="text-sm font-semibold hidden sm:inline-block">
                {session.user.name.split(" ")[0]}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
