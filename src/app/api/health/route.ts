import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'operational',
        firebase: 'checking...',
      },
      version: process.env.npm_package_version || 'unknown',
    };

    // Check if Firebase Admin is properly initialized
    if (!adminDb || !adminAuth) {
      healthCheck.services.firebase = 'not initialized';
      healthCheck.status = 'degraded';
    } else {
      try {
        // Perform a lightweight test to check if we can access Firestore
        await adminDb.collection('health-check').limit(1).get();
        healthCheck.services.firebase = 'operational';
      } catch (error) {
        console.error('Firebase health check failed:', error);
        healthCheck.services.firebase = 'error';
        healthCheck.status = 'degraded';
      }
    }

    const status = healthCheck.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthCheck, { status });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    );
  }
}

// Also support POST for compatibility with health check tools that prefer POST
export async function POST(req: NextRequest) {
  return GET(req);
}