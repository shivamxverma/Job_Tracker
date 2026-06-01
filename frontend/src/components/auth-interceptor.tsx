"use client";

import { useEffect } from "react";

export function AuthInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    window.fetch = async (input, init) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }

      // Check if this request is headed to our Express backend
      if (url.startsWith(API_BASE)) {
        const token = localStorage.getItem("outreach_api_key");
        if (token) {
          // Clone or construct init options safely
          const newInit = { ...init };
          const headers = new Headers(newInit.headers || {});
          
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          if (!headers.has("X-API-Key")) {
            headers.set("X-API-Key", token);
          }
          
          newInit.headers = headers;
          return originalFetch(input, newInit);
        }
      }

      return originalFetch(input, init);
    };

    console.log("[Auth Interceptor] Successfully initialized global fetch security headers inject.");

    return () => {
      window.fetch = originalFetch; // restore on unmount
    };
  }, []);

  return null;
}
