import { NextRequest, NextResponse } from 'next/server';
import { serverMap, JekyllServer } from '@/lib/jekyll-server';
import { TempFileManager } from '@/lib/temp-file-manager';
import { getWorkspaceState } from '@/actions/content';

const tempFileManager = new TempFileManager();

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, port, liveReload = true } = await req.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Get the current workspace state (file structure and contents)
    const workspaceState = await getWorkspaceState(workspaceId);
    
    if (!workspaceState.success || !workspaceState.data) {
      return NextResponse.json(
        { error: 'Workspace not found or inaccessible' },
        { status: 404 }
      );
    }

    const { fileContents } = workspaceState.data;

    // Create a temporary workspace with the current files
    const tempWorkspacePath = await tempFileManager.createWorkspace(workspaceId, fileContents);
    
    // Check if there's already a server running for this workspace
    if (serverMap.has(workspaceId)) {
      const existingServer = serverMap.get(workspaceId)!;
      if (existingServer.isRunning()) {
        // If server is already running, return current status
        return NextResponse.json({
          success: true,
          message: 'Server already running',
          port: existingServer.getPort(),
          tempWorkspacePath
        });
      } else {
        serverMap.delete(workspaceId);
      }
    }

    // Create new Jekyll server instance
    const server = new JekyllServer({
      port: port || 4000,
      workingDir: tempWorkspacePath,
      liveReload
    });

    // Add output callbacks to send data via WebSocket in a real implementation
    server.setOutputCallback((data) => {
      // In a real implementation, we would send this data to the WebSocket clients
      console.log(`[Jekyll Server Output - ${workspaceId}]:`, data);
    });

    server.setErrorCallback((data) => {
      // In a real implementation, we would send this error to the WebSocket clients
      console.error(`[Jekyll Server Error - ${workspaceId}]:`, data);
    });

    try {
      // Start the server
      await server.start();

      // Store the server instance with the temporary workspace path
      serverMap.set(workspaceId, {
        ...server,
        tempWorkspacePath  // Store the temp path for cleanup
      } as any);

      return NextResponse.json({
        success: true,
        message: 'Jekyll server started successfully',
        port: server.getPort(),
        tempWorkspacePath
      });
    } catch (serverError) {
      // If server failed to start, cleanup the temporary files
      await tempFileManager.cleanupWorkspace(tempWorkspacePath);
      throw serverError;
    }
  } catch (error) {
    console.error('Error starting Jekyll server:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to start Jekyll server' },
      { status: 500 }
    );
  }
}