import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, platform, notes, appliedAt } = body;

    // Build update object
    const updateData: Record<string, string | Date | null> = {};

    if (status !== undefined) {
      updateData.status = status;
      // Automatically set appliedAt if marked as "Applied" and not already set
      if (status && status !== "Not Applied") {
        updateData.appliedAt = appliedAt ? new Date(appliedAt) : new Date();
      } else {
        updateData.appliedAt = null;
      }
    }

    if (platform !== undefined) {
      updateData.platform = platform;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Job application status updated successfully.",
      data: {
        job: {
          ...updatedJob,
          createdAt: updatedJob.createdAt.toISOString(),
          updatedAt: updatedJob.updatedAt.toISOString(),
          appliedAt: updatedJob.appliedAt ? updatedJob.appliedAt.toISOString() : null,
        },
      },
    }, { status: 200 });
  } catch (error) {
    console.error("[jobs:patch]", error);
    return NextResponse.json({
      success: false,
      message: "Failed to update job application status.",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
