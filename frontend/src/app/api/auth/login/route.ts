import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();

    if (!provider || !["google", "github"].includes(provider)) {
      return NextResponse.json(
        { success: false, message: "Invalid OAuth provider." },
        { status: 400 }
      );
    }

    // Simulate high-fidelity OAuth User details exchange
    const mockUser = {
      name: "Shivam Verma",
      email: "shivam@example.com",
      avatar: provider === "google"
        ? "https://lh3.googleusercontent.com/a/default-user"
        : "https://github.com/identicons/shivam.png",
      provider,
      sessionToken: `oauth-mock-session-token-${provider}-${Date.now()}`,
    };

    const response = NextResponse.json({
      success: true,
      message: `Authenticated successfully via ${provider === "google" ? "Google" : "GitHub"}!`,
      data: { user: mockUser },
    });

    // Set secure HTTP-Only cookie containing user metadata
    response.cookies.set("auth_session", JSON.stringify(mockUser), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 Week
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[Auth Login API Error]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
