import { NextRequest, NextResponse } from 'next/server';
import { serverMap, JekyllServer } from '@/lib/jekyll-server';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, port, liveReload = true } = await req.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would get the user's workspace path from their session/data
    // For now we'll use a default path, but in production this should be user-specific
    const workspacePath = `/tmp/jekyll-workspaces/${workspaceId}`;
    
    // Check if there's already a server running for this workspace
    if (serverMap.has(workspaceId)) {
      const existingServer = serverMap.get(workspaceId)!;
      if (existingServer.isRunning()) {
        return NextResponse.json({
          success: true,
          message: 'Server already running',
          port: existingServer.getPort()
        });
      } else {
        serverMap.delete(workspaceId);
      }
    }

    // Create new Jekyll server instance
    const server = new JekyllServer({
      port: port || 4000,
      workingDir: workspacePath,
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

    // Start the server
    await server.start();

    // Store the server instance
    serverMap.set(workspaceId, server);

    return NextResponse.json({
      success: true,
      message: 'Jekyll server started successfully',
      port: server.getPort()
    });
  } catch (error) {
    console.error('Error starting Jekyll server:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to start Jekyll server' },
      { status: 500 }
    );
  }
}