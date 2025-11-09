'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Play, Square, RotateCcw } from 'lucide-react';

interface PreviewPaneProps {
  className?: string;
  workspaceId?: string;
  onPreviewStart?: (port: number) => void;
  onPreviewStop?: () => void;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ 
  className, 
  workspaceId = 'default',
  onPreviewStart,
  onPreviewStop
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(false);
  const [previewPort, setPreviewPort] = useState<number>(4000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startPreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate a unique port for this workspace
      const port = 4000 + (workspaceId === 'default' ? 0 : parseInt(workspaceId.slice(-3), 10) % 1000);
      setPreviewPort(port);

      // Make an API call to start the Jekyll server
      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          workspaceId,
          port
        }),
      });

      const result = await response.json();

      if (result.success) {
        const url = `http://localhost:${port}`;
        setPreviewUrl(url);
        setIsPreviewActive(true);
        onPreviewStart?.(port);
      } else {
        setError(result.error || 'Failed to start preview server');
      }
    } catch (err) {
      setError('Network error: Could not start preview server');
      console.error('Preview start error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopPreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Make an API call to stop the Jekyll server
      const response = await fetch('/api/preview/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      });

      const result = await response.json();

      if (result.success) {
        setPreviewUrl('');
        setIsPreviewActive(false);
        onPreviewStop?.();
      } else {
        setError(result.error || 'Failed to stop preview server');
      }
    } catch (err) {
      setError('Network error: Could not stop preview server');
      console.error('Preview stop error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPreview = () => {
    // Simple solution: just reload the iframe content
    if (previewUrl) {
      const iframe = document.querySelector('iframe#jekyll-preview') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = iframe.src; // This reloads the iframe
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isPreviewActive) {
        stopPreview(); // Attempt to stop the server when component unmounts
      }
    };
  }, [isPreviewActive]);

  return (
    <div className={cn("flex flex-col h-full border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-800", className)}>
      <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Jekyll Preview</h3>
          {isPreviewActive && (
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="ml-1 text-xs text-green-600 dark:text-green-400">Running</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isPreviewActive ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={stopPreview}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              aria-label="Stop preview"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={startPreview}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              aria-label="Start preview"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshPreview}
            disabled={!isPreviewActive || isLoading}
            className="h-8 w-8 p-0"
            aria-label="Refresh preview"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 z-10">
            <div className="text-red-700 dark:text-red-300 text-center">
              <p className="font-medium">Error:</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        
        {isPreviewActive && previewUrl ? (
          <iframe
            id="jekyll-preview"
            src={previewUrl}
            title="Jekyll Preview"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-500 dark:text-gray-400">
            <div className="bg-gray-200 dark:bg-gray-700 border-2 border-dashed rounded-xl w-full h-full flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mb-2"></div>
                  <p>Starting preview server...</p>
                </div>
              ) : (
                <p>Preview will appear here when server starts</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { PreviewPane };