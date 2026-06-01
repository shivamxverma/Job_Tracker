import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authSession = request.cookies.get("auth_session");

    if (!authSession) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    // Parse user details from the session cookie
    const user = JSON.parse(authSession.value);

    return NextResponse.json({
      success: true,
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("[Auth Session API Error]", error);
    return NextResponse.json({
      success: true,
      authenticated: false,
      user: null,
    });
  }
}
