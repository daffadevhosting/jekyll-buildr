'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TerminalOutput {
  id: string;
  content: string;
  type: 'input' | 'output' | 'error' | 'info';
  timestamp: Date;
}

interface TerminalProps {
  className?: string;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  isProcessing: boolean;
  onCommandSubmit: (command: string) => Promise<void>;
  terminalOutput: TerminalOutput[];
}

const Terminal: React.FC<TerminalProps> = ({
  className,
  isTerminalOpen,
  setIsTerminalOpen,
  isProcessing,
  onCommandSubmit,
  terminalOutput,
}) => {
  const [inputCommand, setInputCommand] = React.useState('');
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim() || isProcessing) return;

    // Add the command to the output as input
    await onCommandSubmit(inputCommand);
    setInputCommand('');
  };

  // Auto-scroll to bottom when new output is added
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [terminalOutput]);

  // Handle key events for terminal
  React.useEffect(() => {
    if (!isTerminalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && e.ctrlKey) {
        setIsTerminalOpen(false);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTerminalOpen, setIsTerminalOpen]);

  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-gray-900 text-green-400 font-mono text-sm transition-transform duration-300 z-50 border-t-2 border-green-500',
        isTerminalOpen ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-green-400">Jekyll Terminal</span>
          <div className="flex space-x-1">
            <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsTerminalOpen(false)}
          className="text-gray-300 hover:text-white hover:bg-gray-700 h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>
      <ScrollArea ref={scrollAreaRef} className="h-40 p-2 font-mono text-sm">
        <div className="space-y-1">
          {terminalOutput.map((output) => (
            <div 
              key={output.id} 
              className={cn(
                'whitespace-pre-wrap break-words',
                output.type === 'input' && 'text-blue-400',
                output.type === 'error' && 'text-red-400',
                output.type === 'info' && 'text-yellow-400'
              )}
            >
              {output.type === 'input' ? '$ ' : ''}
              {output.content}
            </div>
          ))}
          {isProcessing && (
            <div className="text-green-400 animate-pulse">Processing command...</div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleCommandSubmit} className="flex border-t border-gray-700">
        <span className="p-2 text-green-400 select-none">$</span>
        <Input
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          className="border-0 bg-transparent text-green-400 focus-visible:ring-0 font-mono"
          placeholder="Type a command..."
          autoFocus
          disabled={isProcessing}
        />
      </form>
    </div>
  );
};

export default Terminal;