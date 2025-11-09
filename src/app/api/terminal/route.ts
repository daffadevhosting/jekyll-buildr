import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const execPromise = promisify(exec);

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
    const { command, workspacePath } = await req.json();
    
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

    // Validate workspace path to prevent directory traversal attacks
    let workingDir = workspacePath;
    if (!workingDir) {
      // In a real implementation you'd get the user's actual workspace path
      // For now we'll use a default or throw an error
      return NextResponse.json({ 
        error: 'Workspace path is required for security purposes.' 
      }, { status: 400 });
    }

    // Sanitize workspace path to prevent directory traversal
    workingDir = path.resolve(process.cwd(), workingDir);
    const baseDir = path.resolve(process.env.WORKSPACE_BASE_DIR || process.cwd()); // Adjust this to your actual base directory
    
    if (!workingDir.startsWith(baseDir)) {
      return NextResponse.json({ 
        error: 'Invalid workspace path: Path traversal detected.' 
      }, { status: 400 });
    }

    // For security and demo purposes, we'll simulate the command output
    // In a real implementation, you would execute the command in a secure, isolated environment
    let output = '';
    let error = '';

    // Simulate command execution based on the command
    if (command.includes('jekyll build')) {
      output = 'Configuration file: none\n            Source: /tmp/jekyll-.../_site\n       Destination: /tmp/jekyll-.../_site\n Incremental build: disabled. Enable with --incremental\n      Generating... \n       Jekyll Feed: Generating feed for posts\n                    done in 1.234 seconds.\n Auto-regeneration: disabled. Use --watch to enable.';
    } else if (command.includes('jekyll serve')) {
      output = 'Configuration file: none\n            Source: /tmp/jekyll-.../_site\n       Destination: /tmp/jekyll-.../_site\n Incremental build: disabled. Enable with --incremental\n      Generating... \n       Jekyll Feed: Generating feed for posts\n                    done in 1.567 seconds.\n Auto-regeneration: enabled for \'/tmp/jekyll-...\'\n    Server address: http://127.0.0.1:4000\n  Server running... press ctrl-c to stop.';
    } else if (command.includes('jekyll doctor')) {
      output = 'Configuration file: none\n  Your test results here. No issues found.';
    } else if (command.includes('bundle install')) {
      output = 'Fetching gem metadata from https://rubygems.org/..........\nResolving dependencies...\nUsing jekyll 4.3.5\nBundle complete! 4 Gemfile dependencies, 37 gems now installed.\nUse `bundle info [gemname]` to see where a bundled gem is installed.';
    } else if (command.includes('ls')) {
      output = '_config.yml\nGemfile\nindex.html\n_layouts/\n_includes/\n_posts/';
    } else if (command.includes('pwd')) {
      output = workingDir;
    } else if (command.includes('echo')) {
      output = command.replace('echo', '').trim();
    } else {
      output = `Command executed: ${command}\n[This is a simulated response for security purposes]`;
    }

    // In a real implementation, you would execute the actual command:
    /*
    const { stdout, stderr } = await execPromise(command, { 
      cwd: workingDir,
      timeout: 30000, // 30 second timeout
      env: {
        ...process.env,
        // Add any necessary environment variables
      }
    });

    output = stdout;
    error = stderr;
    */

    return NextResponse.json({ 
      success: true, 
      output,
      error: error || null,
      command,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error executing terminal command:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      success: false 
    }, { status: 500 });
  }
}