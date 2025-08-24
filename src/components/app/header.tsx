
'use client';

import { Crown, LogOut, Settings, PlusCircle, HelpCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Icons } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import * as React from 'react';
import Link from 'next/link';

type AppHeaderProps = {
  children?: React.ReactNode;
  onNewPost?: () => void;
  onUpgradeClick?: () => void;
  workspaceName?: string | null;
};

export function AppHeader({ children, onNewPost, onUpgradeClick, workspaceName }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();


  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {children}
        <Link className="flex gap-1 items-center" href="/workspace" >
        <Icons.logo className="h-6 w-6" />
        <h2 className="font-headline text-xl font-bold">Jekyll Buildr</h2>
                {workspaceName && (
                    <>
                        <span className="text-muted-foreground text-lg">/</span>
                        <span className="font-mono text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-[300px]">{workspaceName}</span>
                    </>
                )}
        </Link>
      </div>
      <div className="flex items-center gap-2">
         {onNewPost && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onNewPost}>
                        <PlusCircle className="h-5 w-5" />
                        <span className="sr-only">New Post</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>New Post</p>
                </TooltipContent>
            </Tooltip>
        )}
        <Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5" />
                  <span className="sr-only">Help</span>
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Help & Guide</p>
            </TooltipContent>
          </Tooltip>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Welcome to Jekyll Buildr!</DialogTitle>
              <DialogDescription>
                Here is a quick guide to get you started.
              </DialogDescription>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-4">
              <h3 className="font-headline">Key Features</h3>
              <ul>
                <li><strong>In-Browser Code Editor</strong>: A full-featured code editor with syntax highlighting right in your browser.</li>
                <li><strong>File Management</strong>: A familiar file explorer to navigate, create, rename, and delete files and folders.</li>
                <li><strong>AI Component Generation</strong>: Describe a component you need and let the AI generate the Jekyll-compliant code for you.</li>
                <li><strong>AI Image Generation</strong>: Generate unique images for your posts by simply providing a text prompt.</li>
                <li><strong>Direct GitHub Integration</strong>: Push changes directly to a branch or create a pull request for a safer, review-based workflow.</li>
                <li><strong>Pro Tier Subscriptions</strong>: Unlock advanced features like unlimited AI usage by upgrading to a Pro account.</li>
              </ul>
              <h3 className="font-headline">Getting Started</h3>
              <ol>
                <li><strong>Login</strong>: Sign in to the application using your GitHub account.</li>
                <li><strong>Connect GitHub</strong>: Navigate to the <strong>Settings</strong> page.</li>
                <li><strong>Install App</strong>: Click "Connect with GitHub" to install the Jekyll Buildr GitHub App on your desired repositories.</li>
                <li><strong>Select Repo & Branch</strong>: Once connected, select the repository and the primary branch you want to work on from the dropdowns.</li>
                <li><strong>Edit & Create</strong>: Return to the main editor page. You can now edit existing files or create new files and folders.</li>
                <li>
                  <strong>Use AI</strong>:
                  <ul>
                    <li>Click the <strong>✨ (Sparkles)</strong> icon in the editor header to generate a Jekyll component from a text prompt.</li>
                    <li>When creating a new post, use the "Generate with AI" button to create content from a title.</li>
                    <li>At the "Create New Post" image, use the <strong>✨ (Sparkles)</strong> icon to generate an image from a title.</li>
                  </ul>
                </li>
                <li>
                  <strong>Publish</strong>:
                  <ul>
                    <li>Use the <strong>Push to GitHub</strong> button to commit your changes directly to the selected branch.</li>
                    <li>Use the <strong>Create Pull Request</strong> button for a safer workflow, which will create a new branch and a PR for you to review and merge on GitHub.</li>
                  </ul>
                </li>
              </ol>
            </div>
          </DialogContent>
        </Dialog>
        <ThemeToggle />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? ''} />
                  <AvatarFallback>
                    {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                {user.role === 'freeUser' && onUpgradeClick && (
                   <DropdownMenuItem onClick={onUpgradeClick}>
                    <Crown className="mr-2 h-4 w-4" />
                    <span>Upgrade to Pro</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                 <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
