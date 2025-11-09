import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

interface FileContents {
  [path: string]: string;
}

class TempFileManager {
  private baseDir: string;

  constructor(baseDir: string = '/tmp/jekyll-workspaces') {
    this.baseDir = baseDir;
  }

  public async createWorkspace(workspaceId: string, fileContents: FileContents): Promise<string> {
    // Create a unique temporary directory for this workspace
    const tempDir = path.join(this.baseDir, workspaceId, `temp_${Date.now()}_${randomBytes(4).toString('hex')}`);
    
    try {
      // Create the directory structure
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write all files to the temporary directory
      for (const [filePath, content] of Object.entries(fileContents)) {
        const fullPath = path.join(tempDir, filePath);
        const dirPath = path.dirname(fullPath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });
        
        // Write file
        await fs.writeFile(fullPath, content, 'utf8');
      }
      
      return tempDir;
    } catch (error) {
      throw new Error(`Failed to create temporary workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async cleanupWorkspace(workspacePath: string): Promise<void> {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup workspace ${workspacePath}:`, error);
    }
  }

  public async updateFile(workspacePath: string, filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(workspacePath, filePath);
      const dirPath = path.dirname(fullPath);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to update file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export { TempFileManager };