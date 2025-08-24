'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getWorkspaces, setActiveWorkspaceAndSyncSettings, deleteWorkspace, createWorkspace, getSettings, saveSettings } from '@/actions/content';
import { LoadingScreen } from '@/components/app/LoadingScreen';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight, Loader2, Trash2, Lock, Terminal, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // Impor cn untuk classname dinamis
import { Icons } from '@/components/icons';

const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-app-name';
const GITHUB_APP_URL = `https://github.com/apps/${appName}/installations/new`;

type Workspace = {
  id: string;
  name: string;
  githubRepo?: string;
  githubBranch?: string;
};

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [repos, setRepos] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchRepos = async () => {
      setIsFetchingRepos(true);
      try {
          const response = await fetch('/api/github/get-repos');
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to fetch repositories.');
          setRepos(data.repositories || []);
      } catch (error: any) {
          toast({
              title: 'Error Fetching Repos',
              description: error.message,
              variant: 'destructive'
          });
      } finally {
          setIsFetchingRepos(false);
      }
  };

  const fetchBranches = async (repoFullName: string) => {
      if (!repoFullName) return;
      setIsFetchingBranches(true);
      try {
          const response = await fetch(`/api/github/get-branches?repoFullName=${repoFullName}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to fetch branches');
          setBranches(data.branches || []);
      } catch (error: any) {
          toast({
              title: 'Error Fetching Branches',
              description: error.message,
              variant: 'destructive'
          });
      } finally {
          setIsFetchingBranches(false);
      }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    if (user) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        setIsSettingsLoading(true);
        
        try {
          const userSettings = await getSettings();
          if (userSettings.success && userSettings.data) {
            setSettings(userSettings.data);
            if(userSettings.data.installationId) {
              await fetchRepos(); 
              if (user.role === 'proUser') {
                const userWorkspaces = await getWorkspaces();
                setWorkspaces(userWorkspaces);
              }
            }
          }
        } catch (error) {
          toast({
            title: 'Error Loading Data',
            description: 'Failed to load user settings or workspaces.',
            variant: 'destructive'
          });
        } finally {
          setIsSettingsLoading(false);
          setIsLoading(false);
        }
      };
      fetchInitialData();
    }
  }, [user, authLoading, router, toast]);

  // --- FUNGSI UTAMA YANG DIPERBAIKI ---
    const handleWorkspaceClick = async (workspace: Workspace | null) => {
        if (!workspace || !workspace.id) {
            toast({ title: "Error", description: "Invalid workspace data.", variant: "destructive" });
            return;
        }
        setOpeningId(workspace.id); // Mulai loading
        toast({ title: "Opening Workspace...", description: "Syncing your settings..." });

        // Panggil fungsi sinkronisasi yang baru
        const result = await setActiveWorkspaceAndSyncSettings(workspace);

        if (result.success) {
            router.push('/workspace');
        } else {
            toast({ title: "Failed to Open Workspace", description: result.error, variant: 'destructive' });
            setOpeningId(null); // Hentikan loading jika gagal
        }
    };

  const onRepoSelectInDialog = async (repoFullName: string) => {
      setSelectedRepo(repoFullName);
      setSelectedBranch('');
      await fetchBranches(repoFullName);
  };

  const handleCreateWorkspace = async () => {
      if (!selectedRepo || !selectedBranch) {
          toast({ title: 'Error', description: 'Please select a repository and branch.', variant: 'destructive' });
          return;
      }
      setIsCreating(true);
      
      const workspaceId = selectedRepo.replace('/', '__');

      if (user?.role === 'proUser') {
        toast({ title: 'Creating Workspace...', description: 'Cloning repository, this might take a while.' });
        const result = await createWorkspace(selectedRepo, selectedBranch);
        if (result.success) {
            toast({ title: 'Workspace Created!', description: 'You will be redirected to the editor.' });
            setDialogOpen(false);
            const userWorkspaces = await getWorkspaces();
            setWorkspaces(userWorkspaces);
            router.push('/workspace');
        } else {
            toast({ title: 'Error Creating Workspace', description: result.error, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Connecting Workspace...', description: 'Setting up your repository connection.' });
        try {
          await saveSettings({ 
              githubRepo: selectedRepo, 
              githubBranch: selectedBranch,
              activeWorkspaceId: workspaceId,
          });
          toast({ title: 'Workspace Connected!', description: 'You will be redirected to the editor.' });
          setSettings((prev: any) => ({...prev, githubRepo: selectedRepo, githubBranch: selectedBranch, activeWorkspaceId: workspaceId}));
          setDialogOpen(false);
          router.push('/workspace');
        } catch (error: any) {
           toast({ title: 'Error Connecting Workspace', description: error.message, variant: 'destructive' });
        }
      }
      setIsCreating(false);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteWorkspace(workspaceId);
      if (result.success) {
        toast({
          title: 'Workspace Deleted',
          description: 'The workspace has been successfully removed.',
        });
        setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
      } else {
        throw new Error(result.error || 'Failed to delete workspace.');
      }
    } catch (error: any) {
      toast({
        title: 'Error Deleting Workspace',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  if (authLoading || isLoading) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }
  
  const hasGithubConnection = !!settings.installationId;
  const freeUserHasRepoWorkspace = user?.role !== 'proUser' && !!settings.githubRepo;
  
  const freeUserWorkspace: Workspace | null = freeUserHasRepoWorkspace ? {
    id: settings.githubRepo.replace('/', '__'),
    name: settings.githubRepo.split('/')[1],
    githubRepo: settings.githubRepo,
    githubBranch: settings.githubBranch,
  } : null;

  const defaultWorkspace: Workspace = { id: 'default', name: 'Default Project' };

  return (
    <div className="relative min-h-screen bg-muted/20">
  <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg shadow-md">
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <Link href="/" className="flex gap-1 items-center text-1xl font-bold text-indigo-600 tracking-tight">
                <Icons.logo className="h-8 w-8" />
        </Link>
          <div className='flex items-center gap-4'>
        <Link href="/settings"
           className="btn-shine btn-sm inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition">
          <Settings />
        </Link> 
          <Button onClick={() => { logout(); router.push('/login'); }} className='btn-shine' variant="outline">
            Logout
          </Button>
          </div>
      </div>
    </nav>
  </header>

    <div className="fixed top-0 inset-0 bg-gradient-to-bl from-gray-500 via-gray-700 to-transparent"></div>
      <div className="container px-6 mx-auto max-w-5xl py-5 opacity-90">
        <div className="mb-8 mt-14 flex justify-between items-center">
            <h1 className="text-4xl font-bold font-headline">Welcome, {user?.displayName}!</h1>
               <Link href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Pricing
              </Link>
        </div>
        <p className="mb-8 text-muted-foreground">Select a project to start working on or create a new one.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pro User View */}
          {user?.role === 'proUser' && (
            <>
              {workspaces.map(ws => (
                <Card key={ws.id} className={cn("relative h-[202px] flex flex-grow flex-col cursor-pointer p-4 hover:border-primary transition-all", openingId === ws.id && "opacity-50 pointer-events-none")}>
                            {openingId === ws.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            )}
                   <div onClick={() => handleWorkspaceClick(ws)}>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle>{ws.name}</CardTitle>
                        <CardDescription>Repo: {ws.githubRepo || 'Local Project'}</CardDescription>
                        <CardDescription>Branch: {ws.githubBranch || 'none'}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className='flex justify-between items-center'>
                      <p className="text-sm text-muted-foreground">Click to open editor</p>
                      <Terminal className="h-6 w-6" />
                    </CardContent>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className='absolute top-2 right-2' variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} disabled={isDeleting}>
                        <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your workspace 
                          <span className="font-bold">{ws.name}</span> and remove its data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteWorkspace(ws.id)} disabled={isDeleting}>
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </Card>
              ))}
               <Card className="relative h-[202px] flex flex-grow p-4 flex-col items-center justify-center border-2 border-dashed hover:border-primary hover:text-primary transition-all cursor-pointer overflow-hidden">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                          <Button variant="ghost" className="relative text-lg flex flex-col items-center justify-center hover:text-primary h-full w-full disabled:cursor-not-allowed" disabled={!settings.installationId}>
                              <PlusCircle className="relative cursor-auto h-12 w-12 text-muted-foreground mb-2" />
                              <p className="font-semibold">Create New Workspace</p>
                              {!settings.installationId && <p className="text-xs text-muted-foreground">(Connect GitHub first)</p>}
                          </Button>
                      </DialogTrigger>
                      <DialogContent>
                          <DialogHeader>
                              <DialogTitle>Create New Workspace</DialogTitle>
                              <DialogDescription>
                                  Select a GitHub repository to import as a new workspace.
                              </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                              <div>
                                  <Label htmlFor="repo-select">Repository</Label>
                                  <Select onValueChange={onRepoSelectInDialog} value={selectedRepo}>
                                      <SelectTrigger id="repo-select">
                                          <SelectValue placeholder="Select a repository..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {repos.map(repo => <SelectItem key={repo} value={repo}>{repo}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                              </div>
                              <div>
                                  <Label htmlFor="branch-select">Branch</Label>
                                  <Select onValueChange={setSelectedBranch} value={selectedBranch} disabled={!selectedRepo || isFetchingBranches}>
                                      <SelectTrigger id="branch-select">
                                          <SelectValue placeholder="Select a branch..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {isFetchingBranches ? (
                                              <div className="flex items-center justify-center p-2">
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                              </div>
                                          ) : (
                                              branches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)
                                          )}
                                      </SelectContent>
                                  </Select>
                              </div>
                          </div>
                          <DialogFooter>
                              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                              <Button onClick={handleCreateWorkspace} disabled={isCreating || !selectedRepo || !selectedBranch}>
                                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {isCreating ? 'Creating...' : 'Create Workspace'}
                              </Button>
                          </DialogFooter>
                      </DialogContent>
                  </Dialog>
               </Card>
               {!settings.installationId && (
                <Card className="h-[202px] flex flex-grow p-4 flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-all cursor-pointer">
                  <div className="flex flex-col items-center justify-center h-full w-full text-center">
                    <p className="mb-4 text-muted-foreground">Connect your GitHub account to create new workspaces from your repositories.</p>
                    <Button asChild>
                      <a href={GITHUB_APP_URL}>
                        <Github className="mr-2 h-4 w-4" />
                        Connect with GitHub
                      </a>
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Free User View */}
          {user?.role !== 'proUser' && (
            <>
              {freeUserWorkspace && (
                <Card key={freeUserWorkspace.id} className={cn("cursor-pointer h-[202px] flex flex-grow flex-col p-4 hover:border-primary transition-all relative", openingId === freeUserWorkspace.id && "opacity-50 pointer-events-none")} onClick={() => handleWorkspaceClick(freeUserWorkspace)}>
                            {openingId === freeUserWorkspace.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            )}
                  <CardHeader>
                    <CardTitle>{freeUserWorkspace.name}</CardTitle>
                    <CardDescription>Repo: {freeUserWorkspace.githubRepo}</CardDescription>
                    <CardDescription>Branch: {freeUserWorkspace.githubBranch}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Open Editor</p>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {!hasGithubConnection && (
                  <Card className="cursor-pointer h-[202px] flex flex-grow flex-col p-4 hover:border-primary transition-all" onClick={() => handleWorkspaceClick(defaultWorkspace)}>
                      <CardHeader>
                          <CardTitle>Default Project</CardTitle>
                          <CardDescription>Start with a local template (no GitHub connection).</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">Open Editor</p>
                              <ArrowRight className="h-4 w-4" />
                          </div>
                      </CardContent>
                  </Card>
              )}
              
              {hasGithubConnection && !freeUserWorkspace && (
                   <Card className="h-[202px] flex flex-grow flex-col p-4 flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-all cursor-pointer">
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                          <Button variant="ghost" className="flex flex-col items-center justify-center h-full w-full">
                              <PlusCircle className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="font-semibold">Connect GitHub Workspace</p>
                          </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Connect GitHub Workspace</DialogTitle>
                                <DialogDescription>
                                Select a GitHub repository to use as your workspace. You can only connect one repository on the free plan.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                <Label htmlFor="repo-select">Repository</Label>
                                <Select onValueChange={onRepoSelectInDialog} value={selectedRepo}>
                                    <SelectTrigger id="repo-select">
                                    <SelectValue placeholder="Select a repository..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {repos.map(repo => <SelectItem key={repo} value={repo}>{repo}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </div>
                                <div>
                                <Label htmlFor="branch-select">Branch</Label>
                                <Select onValueChange={setSelectedBranch} value={selectedBranch} disabled={!selectedRepo || isFetchingBranches}>
                                    <SelectTrigger id="branch-select">
                                    <SelectValue placeholder="Select a branch..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {isFetchingBranches ? (
                                        <div className="flex items-center justify-center p-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        </div>
                                    ) : (
                                        branches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)
                                    )}
                                    </SelectContent>
                                </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateWorkspace} disabled={isCreating || !selectedRepo || !selectedBranch}>
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isCreating ? 'Connecting...' : 'Connect Workspace'}
                                </Button>
                            </DialogFooter>
                          </DialogContent>
                      </Dialog>
                  </Card>
              )}

              {!hasGithubConnection && (
                  <Card className="h-[202px] flex flex-grow p-4 flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-all cursor-pointer">
                      <div className="flex flex-col items-center justify-center h-full w-full text-center">
                          <p className="mb-4 text-muted-foreground">Connect your GitHub account to import your own repository.</p>
                          <Button asChild>
                          <a href={GITHUB_APP_URL}>
                              <Github className="mr-2 h-4 w-4" />
                              Connect with GitHub
                          </a>
                          </Button>
                      </div>
                  </Card>
              )}

              <Card
                className="relative h-[202px] flex flex-grow p-4 flex-col items-center justify-center border-2 border-dashed hover:border-primary hover:text-primary transition-all cursor-pointer overflow-hidden"
                onClick={() => toast({ title: 'Pro Feature', description: 'Upgrade to Pro to create multiple workspaces from your GitHub repositories.' })}
              >
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <Lock className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="relative z-0 flex flex-col items-center justify-center h-full w-full opacity-50">
                  <PlusCircle className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="font-semibold">Create New Workspace</p>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}