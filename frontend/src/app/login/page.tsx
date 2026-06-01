"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // If already authenticated, redirect home
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (json.authenticated) {
          router.replace(callbackUrl);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    }
    checkSession();
  }, [router, callbackUrl]);

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setLoading(provider);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Fetch session tokens and cache key in local storage to preserve compatibility with outreach routes
        localStorage.setItem("outreach_api_key", json.data.user.sessionToken);
        
        // Dynamic push callback
        router.refresh();
        router.push(callbackUrl);
      } else {
        setError(json.message || "Failed to log in via OAuth.");
        setLoading(null);
      }
    } catch (err) {
      console.error(err);
      setError("Network error connecting to auth server.");
      setLoading(null);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="bg-glow bg-glow-primary" />
      <div className="bg-glow bg-glow-secondary" />

      <div className="glass-card">
        <header className="glass-card-header">
          <div className="lock-icon" aria-hidden="true">🔒</div>
          <h2>Secure OAuth Portal</h2>
          <p className="subtitle">
            Sign in to unlock advanced tools: Auto-Apply Queue, Tracker, outreach and recruiter dashboards.
          </p>
        </header>

        {error && <div className="error-alert">{error}</div>}

        <div className="action-buttons">
          <button
            onClick={() => handleOAuthLogin("google")}
            disabled={loading !== null}
            className={`auth-btn btn-google ${loading === "google" ? "btn-loading" : ""}`}
            aria-label="Sign in with Google"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.86-4.53-6.16-4.53z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>{loading === "google" ? "Verifying..." : "Continue with Google"}</span>
          </button>

          <button
            onClick={() => handleOAuthLogin("github")}
            disabled={loading !== null}
            className={`auth-btn btn-github ${loading === "github" ? "btn-loading" : ""}`}
            aria-label="Sign in with GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
            <span>{loading === "github" ? "Verifying..." : "Continue with GitHub"}</span>
          </button>
        </div>

        <footer className="card-footer">
          <p>
            By continuing, you authorize access token caching. The explore listings are always free.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .login-wrapper {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: linear-gradient(135deg, #090d16 0%, #0d1222 50%, #17112a 100%);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          overflow: hidden;
          padding: 2rem 1.5rem;
        }

        .bg-glow {
          position: absolute;
          width: min(600px, 90vw);
          height: min(600px, 90vw);
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.14;
          z-index: 1;
          pointer-events: none;
        }

        .bg-glow-primary {
          background: radial-gradient(circle, #6366f1 0%, rgba(99, 102, 241, 0) 70%);
          top: -20%;
          left: -10%;
        }

        .bg-glow-secondary {
          background: radial-gradient(circle, #a855f7 0%, rgba(168, 85, 247, 0) 70%);
          bottom: -20%;
          right: -10%;
        }

        .glass-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 28px;
          padding: 3rem 2.5rem;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.1);
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .glass-card-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .lock-icon {
          font-size: 2.8rem;
          margin-bottom: 0.25rem;
          animation: pulse 2s infinite alternate;
        }

        @keyframes pulse {
          0% { transform: scale(0.96) rotate(-2deg); filter: drop-shadow(0 0 2px rgba(99, 102, 241, 0.2)); }
          100% { transform: scale(1.04) rotate(2deg); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5)); }
        }

        .glass-card-header h2 {
          font-size: 1.65rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0;
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          text-align: center;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .auth-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.85rem;
          border-radius: 14px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 200ms ease;
          border: 1px solid transparent;
        }

        .btn-google {
          background: #ffffff;
          color: #1e293b;
        }

        .btn-google:hover {
          background: #f1f5f9;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(255, 255, 255, 0.1);
        }

        .btn-github {
          background: #24292f;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.15);
        }

        .btn-github:hover {
          background: #32383f;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        }

        .btn-loading {
          opacity: 0.75;
          cursor: not-allowed;
          pointer-events: none;
        }

        .card-footer {
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 1.25rem;
        }

        .card-footer p {
          font-size: 0.75rem;
          color: #64748b;
          line-height: 1.4;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", backgroundColor: "#090d16" }}>
        <div style={{ width: "30px", height: "30px", border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
