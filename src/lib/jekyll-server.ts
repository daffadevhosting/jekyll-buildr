import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

interface JekyllServerOptions {
  port?: number;
  host?: string;
  liveReload?: boolean;
  workingDir: string;
}

class JekyllServer {
  private process: ChildProcess | null = null;
  private port: number;
  private host: string;
  private liveReload: boolean;
  private workingDir: string;
  private onOutput?: (data: string) => void;
  private onError?: (data: string) => void;

  constructor(options: JekyllServerOptions) {
    this.port = options.port || 4000;
    this.host = options.host || '127.0.0.1';
    this.liveReload = options.liveReload !== undefined ? options.liveReload : true;
    this.workingDir = options.workingDir;
  }

  public setOutputCallback(callback: (data: string) => void) {
    this.onOutput = callback;
  }

  public setErrorCallback(callback: (data: string) => void) {
    this.onError = callback;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if directory exists and has Jekyll files
      this.validateJekyllDirectory()
        .then(() => {
          // Build the jekyll serve command
          const args = [
            'exec', 'jekyll', 'serve',
            '--port', this.port.toString(),
            '--host', this.host,
            '--drafts'
          ];

          if (this.liveReload) {
            args.push('--livereload');
          }

          // Spawn the jekyll process
          this.process = spawn('bundle', args, {
            cwd: this.workingDir,
            env: {
              ...process.env,
              // Ensure proper environment for Ruby and Bundler
              BUNDLE_GEMFILE: path.join(this.workingDir, 'Gemfile'),
            }
          });

          let serverStarted = false;
          
          this.process.stdout?.on('data', (data) => {
            const output = data.toString();
            
            // Check if server has started successfully
            if (output.includes('Server running') || output.includes('Auto-reload')) {
              serverStarted = true;
              resolve(); // Resolve the promise when server starts successfully
            }
            
            this.onOutput?.(output);
          });

          this.process.stderr?.on('data', (data) => {
            const error = data.toString();
            // Check for errors that indicate server failed to start
            if (
              error.toLowerCase().includes('error') || 
              error.toLowerCase().includes('failed') ||
              error.includes('port') // Port already in use
            ) {
              if (!serverStarted) {
                reject(new Error(`Jekyll server failed to start: ${error}`));
              }
            }
            this.onError?.(error);
          });

          this.process.on('error', (err) => {
            if (!serverStarted) {
              reject(new Error(`Failed to start Jekyll process: ${err.message}`));
            }
          });

          this.process.on('close', (code) => {
            console.log(`Jekyll server process exited with code ${code}`);
            this.process = null;
          });
        })
        .catch(reject);
    });
  }

  public stop(): void {
    if (this.process) {
      // Try graceful shutdown first
      this.process.kill('SIGTERM');
      
      // Set a timeout to force kill if it doesn't shut down gracefully
      setTimeout(() => {
        if (this.process && this.process.exitCode === null) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
      
      this.process = null;
    }
  }

  public isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  public getPort(): number {
    return this.port;
  }

  private async validateJekyllDirectory(): Promise<void> {
    try {
      // For now, skip filesystem validation since files are stored in memory in the application
      // In a real implementation, you would need to write the in-memory files to a temporary directory
      // before starting the Jekyll server
    } catch (error) {
      console.warn('Skipping Jekyll directory validation for in-memory workspace:', error);
    }
  }
}

// Extend JekyllServer to include temporary workspace path
interface ExtendedJekyllServer extends JekyllServer {
  tempWorkspacePath?: string;
}

// Keep track of all running servers
const serverMap = new Map<string, ExtendedJekyllServer>();

export { JekyllServer, serverMap };