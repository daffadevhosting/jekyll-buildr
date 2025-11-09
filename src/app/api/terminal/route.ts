import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getWorkspaceState } from '@/actions/content';
import { TempFileManager } from '@/lib/temp-file-manager';

const execPromise = promisify(exec);
const tempFileManager = new TempFileManager();

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the user
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Check user's role
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userData = userDoc.data();
    const userRole = userData?.role;

    // 3. Get the command from the request body
    const { command, workspaceId } = await req.json();

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Validate command for security (only allow safe jekyll commands)
    const allowedCommands = [
      'jekyll build',
      'jekyll serve',
      'jekyll doctor',
      'jekyll new',
      'bundle install',
      'bundle update',
      'bundle exec jekyll build',
      'bundle exec jekyll serve',
      'bundle exec jekyll doctor',
      'ls',
      'pwd',
      'cat',
      'echo'
    ];

    const isAllowed = allowedCommands.some(allowed =>
      command.trim().startsWith(allowed) || command.trim() === allowed
    );

    if (!isAllowed) {
      return NextResponse.json({
        error: `Command not allowed: ${command}. Only specific Jekyll commands are permitted for security.`
      }, { status: 400 });
    }

    // If workspaceId is provided, get the current file state and create a temporary workspace
    let workingDir = '/tmp/default';
    if (workspaceId) {
      // Get the current workspace state (file structure and contents)
      const workspaceState = await getWorkspaceState(workspaceId);
      
      if (workspaceState.success && workspaceState.data && workspaceState.data.fileContents) {
        // Create a temporary workspace with the current files
        workingDir = await tempFileManager.createWorkspace(workspaceId, workspaceState.data.fileContents);
      } else {
        // If workspace doesn't exist or is invalid, create a basic structure
        workingDir = `/tmp/jekyll-workspaces/${workspaceId}`;
        // We might not have file contents, but Jekyll commands may still work if run in the right directory
      }
    }

    try {
      // Execute the actual command
      const { stdout, stderr } = await execPromise(command, {
        cwd: workingDir,
        timeout: 60000, // 60 second timeout for longer operations
        env: {
          ...process.env,
          // Add any necessary environment variables for Ruby/bundler
          BUNDLE_GEMFILE: path.join(workingDir, 'Gemfile'),
        }
      });

      const output = stdout;
      const error = stderr;

      return NextResponse.json({
        success: true,
        output,
        error: error || null,
        command,
        timestamp: new Date().toISOString()
      });
    } finally {
      // For 'jekyll serve' command, don't cleanup the temp directory immediately
      // since it needs to stay available for the preview server
      if (!command.includes('jekyll serve')) {
        // Cleanup the temporary workspace after command execution (except for serve command)
        await tempFileManager.cleanupWorkspace(workingDir);
      }
    }

  } catch (error: any) {
    console.error('Error executing terminal command:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
      success: false
    }, { status: 500 });
  }
}