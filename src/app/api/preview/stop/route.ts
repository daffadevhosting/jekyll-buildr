import { NextRequest, NextResponse } from 'next/server';
import { serverMap } from '@/lib/jekyll-server';
import { TempFileManager } from '@/lib/temp-file-manager';

const tempFileManager = new TempFileManager();

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Check if there's a server running for this workspace
    if (serverMap.has(workspaceId)) {
      const server = serverMap.get(workspaceId)!;
      
      // Stop the server
      server.stop();
      
      // Cleanup temporary workspace if it exists
      if (server.tempWorkspacePath) {
        await tempFileManager.cleanupWorkspace(server.tempWorkspacePath);
      }
      
      // Remove from the map
      serverMap.delete(workspaceId);

      return NextResponse.json({
        success: true,
        message: 'Jekyll server stopped successfully'
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'No server running for this workspace'
      });
    }
  } catch (error) {
    console.error('Error stopping Jekyll server:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to stop Jekyll server' },
      { status: 500 }
    );
  }
}