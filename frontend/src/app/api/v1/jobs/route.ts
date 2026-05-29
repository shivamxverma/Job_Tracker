import { NextRequest, NextResponse } from "next/server";

import { listJobs } from "@/lib/jobs-service";
import { prisma } from "@/lib/prisma";
import type { JobsErrorResponse, JobsResponse } from "@/types/job";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await listJobs();

    const response: JobsResponse = {
      success: true,
      message: "Jobs fetched successfully.",
      data: {
        jobs,
      },
      meta: {
        total: jobs.length,
        fetchedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[jobs:get]", error);

    const response: JobsErrorResponse = {
      success: false,
      message: "Failed to fetch jobs.",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, company, location, salary, applyUrl, status, platform, notes } = body;

    if (!title || !company) {
      return NextResponse.json({
        success: false,
        message: "Title and Company are required fields.",
      }, { status: 400 });
    }

    const uniqueId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newJob = await prisma.job.create({
      data: {
        source: "manual",
        externalId: uniqueId,
        title,
        company,
        location: location || "Remote",
        salary: salary || null,
        applyUrl: applyUrl || null,
        status: status || "Applied",
        platform: platform || "Direct",
        notes: notes || null,
        appliedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Manual job application tracked successfully.",
      data: {
        job: {
          ...newJob,
          createdAt: newJob.createdAt.toISOString(),
          updatedAt: newJob.updatedAt.toISOString(),
          appliedAt: newJob.appliedAt ? newJob.appliedAt.toISOString() : null,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[jobs:post]", error);
    return NextResponse.json({
      success: false,
      message: "Failed to track manual job application.",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

