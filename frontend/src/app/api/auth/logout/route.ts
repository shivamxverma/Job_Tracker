import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Successfully signed out. Session invalidated.",
    });

    // Delete the secure cookie by setting its maxAge to 0
    response.cookies.set("auth_session", "", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[Auth Logout API Error]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
