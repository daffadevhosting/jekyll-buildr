// Client-side function to execute terminal commands
interface TerminalResponse {
  success: boolean;
  output?: string;
  error?: string;
  command?: string;
  timestamp?: string;
}

export async function executeTerminalCommand(
  command: string,
  workspacePath?: string,
  token?: string
): Promise<TerminalResponse> {
  try {
    const response = await fetch(`/api/terminal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`, // Token should be passed from the component
      },
      body: JSON.stringify({ command, workspacePath }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to execute command',
      };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error executing terminal command:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}