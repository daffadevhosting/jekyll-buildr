// src/app/workspace/page.tsx
'use client';

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {FileNode} from '@/types';
import {AppHeader} from '@/components/app/header';
import {FileExplorer} from '@/components/app/file-explorer';
import {useIsMobile} from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {Button} from '@/components/ui/button';
import {PanelLeft, Sparkles, Plus, FolderPlus, Wrench} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import {AppFooter} from '@/components/app/footer';
import {generateJekyllComponent} from '@/ai/flows/jekyll-generator-flow';
import { fixJekyllCode } from '@/ai/flows/code-fixer-flow';
import {useAuth} from '@/hooks/use-auth';
import {IconSidebar} from '@/components/app/icon-sidebar';
import {
  publishTemplateFiles,
  getSettings,
  createPullRequestAction,
  saveWorkspaceState,
  getWorkspaceState,
  cloneRepository,
} from '@/actions/content';
import {useDebouncedCallback} from 'use-debounce';
import {CodeEditor} from '@/components/app/code-editor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UpgradeModal } from '@/components/upgrade-modal';
import { CloningScreen } from '@/components/app/CloningScreen';
import {Textarea} from '@/components/ui/textarea';
import { checkAndRecordComponentGeneration } from '@/actions/user';
import { PostEditor } from '@/components/app/post-editor';
import { useRouter } from 'next/navigation';

const initialFileStructure: FileNode[] = [
  {
    name: '_layouts',
    path: '_layouts',
    type: 'folder',
    children: [
      {name: 'default.html', path: '_layouts/default.html', type: 'file'},
      {name: 'post.html', path: '_layouts/post.html', type: 'file'},
    ],
  },
  {
    name: '_includes',
    path: '_includes',
    type: 'folder',
    children: [
      {name: 'header.html', path: '_includes/header.html', type: 'file'},
      {name: 'footer.html', path: '_includes/footer.html', type: 'file'},
    ],
  },
  {
    name: '_posts',
    path: '_posts',
    type: 'folder',
    children: [
      {
        name: '2024-01-01-welcome-to-jekyll.md',
        path: '_posts/2024-01-01-welcome-to-jekyll.md',
        type: 'file',
      },
    ],
  },
  {
    name: '_data',
    path: '_data',
    type: 'folder',
    children: [{name: 'navigation.yml', path: '_data/navigation.yml', type: 'file'}],
  },
  {
    name: 'assets',
    path: 'assets',
    type: 'folder',
    children: [
      {
        name: 'css',
        path: 'assets/css',
        type: 'folder',
        children: [{name: 'style.css', path: 'assets/css/style.css', type: 'file'}],
      },
      {
        name: 'images',
        path: 'assets/images',
        type: 'folder',
        children: [{name: '.gitkeep', path: 'assets/images/.gitkeep', type: 'file'}],
      },
      {
        name: 'js',
        path: 'assets/js',
        type: 'folder',
        children: [{name: 'script.js', path: 'assets/js/script.js', type: 'file'}],
      },
    ],
  },
  {name: '_config.yml', path: '_config.yml', type: 'file'},
  {name: 'index.html', path: 'index.html', type: 'file'},
  {name: 'Gemfile', path: 'Gemfile', type: 'file'},
];

const initialFileContents: {[key: string]: string} = {
  '_config.yml': `title: My Jekyll Site
email: your-email@example.com
description: >- # this means to ignore newlines until "baseurl:"
baseurl: "" # subpath situs Anda, mis. /blog
url: "" # nama host & protokol dasar untuk situs Anda, mis. http://example.com
twitter_username: jekyllrb
github_username:  jekyll

permalink: /post/:title

defaults:
- scope:
    type: posts
  values:
    layout: post

- scope:
    type: pages
  values:
    layout: page

# Pengaturan Markdown
markdown: kramdown

# Pengaturan build
plugins:
  - jekyll-feed
  - jekyll-sitemap

# Kecualikan dari pemrosesan.
# Item berikut tidak akan diproses, secara default.
# Setiap item yang tercantum di bawah kunci "exclude:" di sini akan secara otomatis ditambahkan ke
# daftar internal "default_excludes".
#
# Item yang dikecualikan dapat diproses dengan secara eksplisit mencantumkan direktori atau
# path file entri mereka dalam daftar "include:".
#
# exclude:
#   - .sass-cache/
#   - .jekyll-cache/
#   - gemfiles/
#   - Gemfile
#   - Gemfile.lock
#   - node_modules/
#   - vendor/bundle/
#   - vendor/cache/
#   - vendor/gems/
#   - vendor/ruby/
`,
  'index.html': `---
layout: default
title: Welcome to Your New Blog!
permalink: /
---

<h1 class="flex justify-center items-center mb-6 text-3xl font-bold text-center">Hello Broo..!</h1>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

  {% for post in site.posts %}
    <a href="{{ post.url | relative_url }}" class="group block rounded-lg overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-slate-800">
      
      {% if post.image %}
        <img src="{{ post.image | relative_url }}" alt="{{ post.title }}" class="w-full h-48 object-cover">
      {% endif %}

      <div class="p-6">
        <h2 class="mb-2 text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors">
          {{ post.title }}
        </h2>
        
        <p class="font-normal text-slate-600 dark:text-slate-400 mb-4">
          {{ post.excerpt | strip_html | truncatewords: 20 }}
        </p>

        <p class="text-sm text-slate-500 dark:text-slate-500">
          {{ post.date | date: "%b %d, %Y" }}
        </p>
      </div>

    </a>
  {% endfor %}

</div>
`,
  '_layouts/default.html': `<!DOCTYPE html>
<html lang="{{ page.lang | default: site.lang | default: "id-ID" }}" class="h-full">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ page.title | escape }} | {{ site.title | escape }}</title>
    <meta name="description" content="{{ page.excerpt | default: site.description | strip_html | normalize_whitespace | truncate: 160 | escape }}">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="stylesheet" href="{{ '/assets/css/style.css' | relative_url }}">
    <link rel="canonical" href="{{ page.url | replace:'index.html','' | absolute_url }}">
  </head>
  <body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans min-h-screen flex flex-col">
    {% include header.html %}
    
    <main class="page-content flex-grow" aria-label="Content">
      <div class="container mx-auto px-4 py-8">
        {{ content }}
      </div>
    </main>
    
    {% include footer.html %}
  </body>
</html>
`,
  '_layouts/post.html': `---
layout: default
---
<article class="post h-entry px-4 py-8 max-w-3xl mx-auto" itemscope itemtype="http://schema.org/BlogPosting">

        <h2 class="mb-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors">
          {{ page.title }}
        </h2>

      {% if page.image %}
        <img src="{{ page.image | relative_url }}" alt="{{ page.title }}" class="w-full h-58 rounded-md shadow object-cover">
      {% endif %}

  <div class="post-content e-content prose prose-lg dark:prose-invert" itemprop="articleBody">
    {{ content }}
  </div>
  
  <div class="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
    Posted on <time class="dt-published" datetime="{{ page.date | date_to_xmlschema }}" itemprop="datePublished">{{ page.date | date: "%b %-d, %Y" }}</time>
    {%- if page.author -%}
      by <span itemprop="author" itemscope itemtype="http://schema.org/Person"><span class="p-author h-card" itemprop="name">{{ page.author }}</span></span>
    {%- endif -%}
    {%- if page.tags and page.tags.size > 0 -%}
      <br>
      Categories:
      {%- for tag in page.tags -%}
        <a href="/tags/{{ tag | slugify }}/" class="text-purple-600 dark:text-purple-400 hover:underline">#{{ tag }}</a>{%- unless forloop.last -%},{%- endunless -%}
      {%- endfor -%}
    {%- endif -%}
  </div>

  <a class="u-url" href="{{ page.url | relative_url }}" hidden></a>
</article>
`,
  '_includes/header.html': `<header class="bg-white dark:bg-gray-800 shadow-md py-4">
  <div class="container mx-auto px-4 flex justify-between items-center">
    <a class="text-2xl font-bold text-gray-900 dark:text-white" href="{{ '/' | relative_url }}">{{ site.title | escape }}</a>
    
    <nav class="site-nav">
      <div class="hidden md:block">
        {%- for item in site.data.navigation -%}
          <a class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md font-medium" href="{{ item.url | relative_url }}">{{ item.title }}</a>
        {%- endfor -%}
      </div>
      </nav>
  </div>
</header>
`,
  '_includes/footer.html': `<footer class="w-full bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-700">
    <div class="container mx-auto py-5 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
      <p>&copy; {% capture current_year %}{{ 'now' | date: '%Y' }}{% endcapture %}{{ current_year }} {{ site.title }} <br /> Made with <a href="https://jekyll-buildr.vercel.app/" target="_blank">Jekyll-Buildr</a> by Daffa</p>
    </div>
  </footer>
`,
  '_posts/2024-01-01-welcome-to-jekyll.md': `---
title: "Welcome to Jekyll!"
image: "https://placehold.co/600x400?text=Jekyll-World"
date: 2024-01-01 00:00:00 -0000
categories: jekyll update
---
You’ll find this post in your \`_posts\` directory. Go ahead and edit it and re-build the site to see your changes. You can rebuild the site in many different ways, but the most common way is to run \`bundle exec jekyll serve\`, which launches a web server and auto-regenerates your site when a file is updated.

To add new posts, simply add a file in the \`_posts\` directory that follows the convention \`YYYY-MM-DD-name-of-post.ext\` and includes the necessary front matter. Take a look at the source for this post to get an idea about how it works.
`,
  '_data/navigation.yml': `- title: Home
  url: /
- title: About
  url: /about/
`,
  'assets/css/style.css': `/* Add your Tailwind CSS directives here, or other custom CSS */
`,
  'assets/js/script.js': `/* Add your Javascript code here */
`,
  'Gemfile': `source "https://rubygems.org"

gem "jekyll"
gem "jekyll-feed"
gem "jekyll-sitemap"
`,
};

function HomePageContent() {
  const {toast} = useToast();
  const [fileStructure, setFileStructure] =
    React.useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = React.useState<string>('');
  const [fileContents, setFileContents] =
    React.useState<{[key: string]: string}>({});
  const [renamingPath, setRenamingPath] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const {user, loading} = useAuth();
  const [loadingState, setLoadingState] = React.useState<'idle' | 'loading' | 'cloning' | 'loaded' | 'error'>('idle');
  const [projectLoaded, setProjectLoaded] = React.useState(false);
  const router = useRouter();
  const [isPostEditorOpen, setIsPostEditorOpen] = React.useState(false);
  const [isFixing, setIsFixing] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isCreatingPr, setIsCreatingPr] = React.useState(false);
  const [deletingPath, setDeletingPath] = React.useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = React.useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [content, setContent] = React.useState('');
  const [syncedFileState, setSyncedFileState] = React.useState<{[path: string]: string}>({});
  const [showPublishConfirm, setShowPublishConfirm] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null);


  React.useEffect(() => {
    const loadProject = async () => {
        // Jangan lakukan apa-apa sampai user dan status projectLoaded jelas
        if (!user || projectLoaded) {
            return;
        }

        setLoadingState('loading');
        // Tandai bahwa proses loading sudah dimulai untuk mencegah eksekusi ganda
        setProjectLoaded(true); 
        
        const settingsResult = await getSettings();
        const settingsData = settingsResult.success ? settingsResult.data : null;

        // ATURAN #1: Jika user punya koneksi GitHub...
        if (settingsData?.installationId) {
            const workspaceIdToLoad = settingsData.activeWorkspaceId;

            if (!workspaceIdToLoad) {
                // Jika tidak ada workspace aktif, jangan buat default. Tendang ke dasbor.
                toast({
                    title: "Pilih Workspace",
                    description: "Silakan pilih repositori dari dasbor untuk mulai bekerja.",
                });
                router.push('/dashboard');
                return;
            }
            
            setActiveWorkspaceId(workspaceIdToLoad);
            const workspaceDataResult = await getWorkspaceState(workspaceIdToLoad);

            if (workspaceDataResult.success && workspaceDataResult.data?.fileStructure) {
                // Ditemukan di Firestore, muat progres terakhir.
                const { data } = workspaceDataResult;
                setFileStructure(data.fileStructure);
                setActiveFile(data.activeFile);
                setFileContents(data.fileContents);
                setExpandedFolders(new Set(data.expandedFolders || []));
                setContent(data.fileContents[data.activeFile] ?? '');
                setSyncedFileState(data.syncedFileState || {});
            } else {
                // Tidak ada di Firestore (pertama kali buka), lakukan clone.
                setLoadingState('cloning');
                const cloneResult = await cloneRepository();
                if (cloneResult.success && cloneResult.fileStructure && cloneResult.fileContents) {
                    const repoName = settingsData?.githubRepo?.split('/')[1] || 'Cloned Workspace';
                    setWorkspaceName(repoName);
                    const clonedState = {
                        name: repoName,
                        githubRepo: settingsData?.githubRepo,
                        githubBranch: settingsData?.githubBranch,
                        fileStructure: cloneResult.fileStructure,
                        activeFile: 'index.html',
                        fileContents: cloneResult.fileContents,
                        expandedFolders: Array.from(new Set(['_layouts', '_includes', '_posts', '_data', 'assets', 'assets/css', 'assets/images', 'assets/js'])),
                        syncedFileState: cloneResult.syncedFileState,
                    };
                    await saveWorkspaceState(workspaceIdToLoad, clonedState);
                    setFileStructure(clonedState.fileStructure);
                    setFileContents(clonedState.fileContents);
                    setActiveFile(clonedState.activeFile);
                    setContent(clonedState.fileContents[clonedState.activeFile] ?? '');
                } else {
                    toast({ title: 'Gagal Clone Repositori', description: cloneResult.error, variant: 'destructive' });
                    setLoadingState('error');
                    return; // Hentikan jika clone gagal
                }
            }
        } else {
            // ATURAN #2: Jika TIDAK ADA koneksi GitHub, barulah kita urus default workspace.
            setWorkspaceName('Default Project');
            const workspaceDataResult = await getWorkspaceState('default');
             if (workspaceDataResult.success && workspaceDataResult.data?.fileStructure) {
                const { data } = workspaceDataResult;
                setFileStructure(data.fileStructure);
                setActiveFile(data.activeFile);
                setFileContents(data.fileContents);
                setExpandedFolders(new Set(data.expandedFolders || []));
                setContent(data.fileContents[data.activeFile] ?? '');
            } else {
                const defaultState = {
                    name: 'Default Template',
                    fileStructure: initialFileStructure,
                    activeFile: 'index.html',
                    fileContents: initialFileContents,
                    expandedFolders: Array.from(new Set(['_layouts', '_includes', '_posts', '_data', 'assets', 'assets/css', 'assets/images', 'assets/js'])),
                };
                await saveWorkspaceState('default', defaultState);
                setFileStructure(defaultState.fileStructure);
                setFileContents(defaultState.fileContents);
                setActiveFile(defaultState.activeFile);
                setContent(defaultState.fileContents[defaultState.activeFile] ?? '');
            }
        }

        setLoadingState('loaded');
    };
    
    loadProject();
  }, [user, projectLoaded, router, toast]);
  
  // Pembaruan fungsi debouncedSave
  const debouncedSave = useDebouncedCallback(async (stateToSave) => {
    if (!activeWorkspaceId) return; // Jangan simpan jika tidak ada workspace yang aktif

    setIsSaving(true);
    try {
      await saveWorkspaceState(activeWorkspaceId, stateToSave);
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, 2000);

  // Pembaruan useEffect yang memanggil debouncedSave
  React.useEffect(() => {
    if (loading || !user || !projectLoaded) return;

    const stateToSave = {
      fileStructure,
      activeFile,
      fileContents,
      expandedFolders: Array.from(expandedFolders),
    };
    debouncedSave(stateToSave);
  }, [fileStructure, activeFile, fileContents, expandedFolders, debouncedSave, loading, user, projectLoaded]);

  React.useEffect(() => {
    if (loading || !user) return;

    const stateToSave = {
      fileStructure,
      activeFile,
      fileContents,
      expandedFolders: Array.from(expandedFolders),
    };
    debouncedSave(stateToSave);
  }, [fileStructure, activeFile, fileContents, expandedFolders, debouncedSave, loading, user]);

  const handleActiveFileChange = (path: string) => {
    // Simpan konten saat ini sebelum beralih
    if (activeFile) {
      setFileContents((prev) => ({...prev, [activeFile]: content}));
    }
    // Atur file aktif baru dan muat kontennya
    setActiveFile(path);
    setContent(fileContents[path] ?? '');
    if (isMobile) {
      setIsSheetOpen(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (activeFile) {
      setFileContents((prev) => ({...prev, [activeFile]: newContent}));
    }
  };

  const findNodeAndParent = (
    path: string,
    nodes: FileNode[]
  ): {node: FileNode | null; parent: FileNode[] | null} => {
    if (!Array.isArray(nodes)) {
      return {node: null, parent: null};
    }
    for (const node of nodes) {
      if (node.path === path) return {node, parent: nodes};
      if (node.type === 'folder' && node.children) {
        const found = findNodeAndParent(path, node.children);
        if (found.node) return found;
      }
    }
    return {node: null, parent: null};
  };

  const findParent = (path: string, nodes: FileNode[]): FileNode[] | null => {
    const pathParts = path.split('/');
    if (pathParts.length === 1) return nodes; // Ini adalah item root
    const parentPath = pathParts.slice(0, -1).join('/');
    const {node} = findNodeAndParent(parentPath, nodes);
    if (node && node.type === 'folder') {
      return node.children || null;
    }
    return null;
  };

  const recursiveFileAction = (
    nodes: FileNode[],
    parentPath: string | null,
    action: (target: FileNode[], payload: any) => FileNode[],
    payload: any
  ): FileNode[] => {
    // Aksi pada root
    if (parentPath === null) {
      return action(nodes, payload);
    }
    // Aksi pada children
    return nodes.map((node) => {
      if (node.path === parentPath && node.type === 'folder') {
        const currentChildren = node.children || [];
        const newChildren = action(currentChildren, payload);
        return {...node, children: newChildren};
      }
      if (node.type === 'folder' && node.children) {
        return {
          ...node,
          children: recursiveFileAction(
            node.children,
            parentPath,
            action,
            payload
          ),
        };
      }
      return node;
    });
  };

  const handleNewItem = React.useCallback(
    (type: 'file' | 'folder', parentFolderPath: string | null) => {
      const baseName = type === 'file' ? 'untitled.html' : 'New-Folder';

      const newItemAction = (
        targetNodes: FileNode[],
        {baseName, parentPath}: {baseName: string; parentPath: string | null}
      ) => {
        let newName = baseName;
        let counter = 1;

        const currentItems = targetNodes || [];

        // Pastikan nama unik
        while (currentItems.some((n) => n.name === newName)) {
          newName =
            type === 'file'
              ? `untitled-${counter}.html`
              : `New-Folder-${counter}`;
          counter++;
        }

        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        const newNode: FileNode =
          type === 'file'
            ? {name: newName, path: newPath, type: 'file'}
            : {name: newName, path: newPath, type: 'folder', children: []};

        if (type === 'file') {
          setFileContents((prevContents) => ({
            ...prevContents,
            [newPath]: '',
          }));
          setActiveFile(newPath);
          setContent('');
        } else if (parentFolderPath) {
          // Hanya perluas jika itu adalah subfolder yang dibuat di dalam yang lain
          setExpandedFolders((prev) => new Set(prev).add(parentFolderPath));
        }

        setRenamingPath(newPath); // Atur mode ganti nama untuk item baru

        return [...currentItems, newNode];
      };

      setFileStructure((prev) => {
        const newStructure = recursiveFileAction(
          [...prev],
          parentFolderPath,
          newItemAction,
          {baseName, parentPath: parentFolderPath}
        );
        return newStructure;
      });
    },
    []
  );

  const handleDelete = React.useCallback(
    (path: string) => {
      const deleteAction = (
        nodes: FileNode[],
        pathToDelete: string
      ): FileNode[] => {
        return nodes.filter((node) => node.path !== pathToDelete);
      };

      setFileStructure((prev) => {
        const pathParts = path.split('/');
        const parentPath =
          pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
        const newStructure = recursiveFileAction(
          [...prev],
          parentPath,
          deleteAction,
          path
        );
        return newStructure;
      });

      setFileContents((prev) => {
        const newContents = {...prev};
        // Ini akan menghapus file atau semua file di dalam folder
        const keysToDelete = Object.keys(newContents).filter((k) =>
          k.startsWith(path)
        );
        keysToDelete.forEach((k) => delete newContents[k]);
        return newContents;
      });

      // Jika file aktif atau folder induknya dihapus, alihkan ke file default
      if (activeFile.startsWith(path)) {
        setActiveFile('index.html');
        setContent(fileContents['index.html'] ?? '');
      }
      setDeletingPath(null); // Close the confirmation dialog
    },
    [activeFile, fileContents]
  );

  const handleRename = React.useCallback(
    (oldPath: string, newName: string) => {
      if (!newName.trim()) {
        setRenamingPath(null);
        return;
      }

      setFileStructure((prev) => {
        const newStructure = JSON.parse(JSON.stringify(prev)); // Salin dalam untuk menghindari masalah mutasi

        const parentNodes = findParent(oldPath, newStructure);
        if (
          parentNodes &&
          parentNodes.some((n) => n.name === newName && n.path !== oldPath)
        ) {
          toast({
            title: 'Error',
            description: 'A file or folder with that name already exists.',
            variant: 'destructive',
          });
          setRenamingPath(null);
          return prev; // Kembalikan struktur sebelumnya
        }

        // Fungsi rekursif untuk memperbarui path children
        const updatePaths = (
          nodes: FileNode[],
          oldParentPath: string,
          newParentPath: string
        ): FileNode[] => {
          return nodes.map((node) => {
            const updatedNode = {...node};
            if (updatedNode.path.startsWith(oldParentPath)) {
              updatedNode.path = updatedNode.path.replace(
                oldParentPath,
                newParentPath
              );
            }
            if (updatedNode.children) {
              updatedNode.children = updatePaths(
                updatedNode.children,
                oldParentPath,
                newParentPath
              );
            }
            return updatedNode;
          });
        };

        const renameAction = (
          nodes: FileNode[],
          {oldPath, newName}: {oldPath: string; newName: string}
        ): FileNode[] => {
          return nodes.map((node) => {
            if (node.path === oldPath) {
              const newPath =
                oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newName;
              const updatedNode = {...node, name: newName, path: newPath};

              // Jika itu adalah folder, perbarui path children dan kunci konten secara rekursif
              if (updatedNode.type === 'folder' && updatedNode.children) {
                updatedNode.children = updatePaths(
                  updatedNode.children,
                  oldPath,
                  newPath
                );
              }

              // Perbarui kunci fileContents
              setFileContents((prevContents) => {
                const newContents: {[key: string]: string} = {};
                Object.keys(prevContents).forEach((key) => {
                  if (key.startsWith(oldPath)) {
                    const newKey = key.replace(oldPath, newPath);
                    newContents[newKey] = prevContents[key];
                  } else {
                    newContents[key] = prevContents[key];
                  }
                });
                return newContents;
              });

              // Perbarui file aktif jika itu atau childrennya diganti namanya
              if (activeFile.startsWith(oldPath)) {
                const newActiveFile = activeFile.replace(oldPath, newPath);
                setActiveFile(newActiveFile);
              }

              return updatedNode;
            }
            return node;
          });
        };

        const pathParts = oldPath.split('/');
        const parentPath =
          pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
        const finalStructure = recursiveFileAction(newStructure, parentPath, renameAction, {
          oldPath,
          newName,
        });

        return finalStructure;
      });

      setRenamingPath(null);
    },
    [activeFile, toast]
  );
  
  const handleFixCode = async () => {
    if (!content) return;

    setIsFixing(true);
    toast({ title: 'Analyzing & Fixing Code...', description: 'AI is at work, please wait.' });

    try {
      const language = getLanguage(activeFile);
      const fixedCode = await fixJekyllCode(content, language, activeFile);
      
      handleContentChange(fixedCode);
      
      toast({ title: 'Code Fixed Successfully!', description: 'Changes have been applied in the editor.' });
    } catch (error: any) {
      toast({ title: 'Failed to Fix Code', description: error.message, variant: 'destructive' });
    } finally {
      setIsFixing(false);
    }
  };

  const onFixCodeClick = () => {
    if (user?.role === 'proUser') {
      handleFixCode();
    } else {
      toast({
        title: 'Pro Feature 👑',
        description: 'Upgrade to Pro to use the automatic code fixing feature!',
      });
      setUpgradeModalOpen(true);
    }
  };

  function getLanguage(filename: string) {
    if (!filename) return 'markup';
    const extension = filename.split('.').pop() || '';
    switch (extension) {
        case 'html': case 'liquid': return 'markup';
        case 'css': return 'css';
        case 'js': return 'javascript';
        case 'yml': case 'yaml': return 'yaml';
        case 'md': case 'markdown': return 'markdown';
        case 'rb': return 'ruby';
        default: return 'markup';
    }
  }

  const handleGenerateComponent = React.useCallback(
    async (prompt: string) => {
      try {
         // Step 1: Check permissions before generating
        const checkResult = await checkAndRecordComponentGeneration();
        if (!checkResult.success) {
            toast({
                title: 'Limit Reached',
                description: checkResult.error,
                variant: 'destructive',
            });
            return; // Stop execution if not allowed
        }

        const result = await generateJekyllComponent(prompt, activeFile);
        const {filename, content: newContent} = result;

        const newFile: FileNode = {
          name: filename.split('/').pop() || filename,
          path: filename,
          type: 'file',
        };

        const parentFolder = filename.substring(0, filename.lastIndexOf('/'));

        const addAiFile = (
          nodes: FileNode[],
          parent: string | null
        ): FileNode[] => {
          // Ini mengasumsikan folder induk seperti `_includes` sudah ada.
          if (parent === null) {
            // Kasus ini idealnya tidak terjadi untuk fungsi ini
            return [...nodes, newFile];
          }
          return nodes.map((n) => {
            if (n.path === parent && n.type === 'folder') {
              // Hindari penambahan duplikat
              if (n.children?.some((child) => child.path === filename)) {
                return n;
              }
              return {...n, children: [...(n.children || []), newFile]};
            }
            if (n.type === 'folder' && n.children) {
              return {...n, children: addAiFile(n.children, parent)};
            }
            return n;
          });
        };

        setFileStructure((prev) => addAiFile(prev, parentFolder));
        setFileContents((prev) => ({...prev, [filename]: newContent}));

        // Perluas folder induk untuk menampilkan file baru
        if (parentFolder) {
          setExpandedFolders((prev) => new Set(prev).add(parentFolder));
        }

        // Atur file baru sebagai aktif
        setActiveFile(filename);
        setContent(newContent);

        toast({
          title: 'Component Generated',
          description: `${filename} has been created and opened.`,
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Generation Failed',
          description: 'Something went wrong while generating the component.',
          variant: 'destructive',
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [toast, activeFile]
  );

  const handleImageUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 1 * 1024 * 1024) {
        // Batas 1MB
        toast({
          title: 'Upload Failed',
          description: 'File size cannot exceed 1MB.',
          variant: 'destructive',
        });
        return;
      }

      const imagePath = `assets/images/${file.name}`;
      const newFile: FileNode = {name: file.name, path: imagePath, type: 'file'};
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        // Gunakan aksi rekursif yang kuat untuk menambahkan file
        setFileStructure((prev) =>
          recursiveFileAction(prev, 'assets/images', (nodes) => {
            // Cegah duplikat
            if (nodes.some(n => n.path === imagePath)) return nodes;
            return [...nodes, newFile];
          }, null)
        );
        
        setFileContents((prev) => ({...prev, [imagePath]: dataUrl}));
        setExpandedFolders((prev) => new Set(prev).add('assets/images')); // Pastikan folder diperluas
        
        toast({
          title: 'Image Uploaded',
          description: `${file.name} has been added to assets/images.`,
        });
      };
      reader.readAsDataURL(file);

      // Atur ulang nilai input untuk memungkinkan pengunggahan file yang sama lagi
      e.target.value = '';
    },
    [toast]
  );


  const collectFilesToCommit = () => {
    const filesToCommit: {
      path: string;
      name: string;
      content: string;
      type: 'file';
    }[] = [];

    const collect = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const content = fileContents[node.path];
          if (content !== undefined) {
            filesToCommit.push({
              path: node.path,
              name: node.name,
              content: content,
              type: 'file',
            });
          }
        } else if (node.type === 'folder' && node.children) {
          if (node.children.length === 0) {
            // Buat file .gitkeep untuk direktori kosong untuk menyimpannya di Git
            filesToCommit.push({
              path: `${node.path}/.gitkeep`,
              name: '.gitkeep',
              content: '',
              type: 'file',
            });
          } else {
            collect(node.children);
          }
        }
      }
    };

    collect(fileStructure);
    return filesToCommit;
  };

  const handlePublish = async () => {
    // Sembunyikan dialog dulu
    setShowPublishConfirm(false);

    setIsPublishing(true);
    toast({
      title: 'Publishing to GitHub...',
      description: 'Please wait while we commit your files.',
    });

    try {
      const settingsResult = await getSettings();
      if (!settingsResult.success || !settingsResult.data) {
        throw new Error(settingsResult.error || 'Could not retrieve user settings.');
      }

      const result = await publishTemplateFiles(fileStructure, fileContents, syncedFileState);

      if (result.success) {
        toast({
          title: 'Publish Successful!',
          description: 'Your changes have been pushed to your GitHub repository.',
        });
        const updatedState = await cloneRepository();
        if (updatedState.success) {
          setSyncedFileState(updatedState.syncedFileState || {});
        }
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error('Publishing error:', error);
      toast({
        title: 'Publishing Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePullRequest = async (details: {title: string; body: string}) => {
    setIsCreatingPr(true);
    toast({
      title: 'Creating Pull Request...',
      description: 'Creating a new branch and committing files.',
    });

    try {
      const settingsResult = await getSettings();
      if (
        !settingsResult.success ||
        !settingsResult.data?.githubRepo ||
        !settingsResult.data?.githubBranch
      ) {
        throw new Error(
          'GitHub repository details are incomplete. Please check your settings.'
        );
      }

      const filesToCommit = collectFilesToCommit();
      if (filesToCommit.length === 0) {
        toast({
          title: 'Nothing to Commit',
          description: 'No file changes were found to create a pull request.',
        });
        setIsCreatingPr(false);
        return;
      }

      const result = await createPullRequestAction(filesToCommit, details);

      if (result.success && result.prUrl) {
        toast({
          title: 'Pull Request Created!',
          description: (
            <a
              href={result.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Click here to view the pull request on GitHub.
            </a>
          ),
          duration: 10000,
        });
      } else {
        throw new Error(
          result.error ||
            'An unknown error occurred while creating the pull request.'
        );
      }
    } catch (error: any) {
      console.error('PR Creation error:', error);
      toast({
        title: 'PR Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingPr(false);
    }
  };

  const handleGenerateClick = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    await handleGenerateComponent(prompt);
    setIsGenerating(false);
    setGenerateDialogOpen(false);
    setPrompt('');
  };

  const folderToggle = React.useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handlePostPublished = React.useCallback((postData: { filename: string; content: string }) => {
    const { filename, content: newContent } = postData;
    const postPath = `_posts/${filename}`;

    const newFileNode: FileNode = {
      name: filename,
      path: postPath,
      type: 'file',
    };

    setFileStructure(prevStructure => {
      return recursiveFileAction(prevStructure, '_posts', (nodes) => {
        // Avoid duplicates if the file already exists
        if (nodes.some(n => n.path === postPath)) {
          return nodes;
        }
        return [...nodes, newFileNode];
      }, null);
    });

    setFileContents(prevContents => ({
      ...prevContents,
      [postPath]: newContent,
    }));
    
    // Open the newly published file
    setActiveFile(postPath);
    setContent(newContent);
  }, []);

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  if (loading || loadingState === 'loading' || loadingState === 'idle') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (loadingState === 'cloning') {
    return <CloningScreen />; 
  }

  if (loadingState === 'error') {
      return (
          <div className="flex h-screen w-full flex-col items-center justify-center text-center">
              <h2 className="text-2xl font-bold text-destructive">Gagal Memuat Proyek</h2>
              <p className="text-muted-foreground">Tidak dapat mengambil data dari repositori GitHub. <br /> Pastikan pengaturan Anda benar dan coba muat ulang halaman.</p>
          </div>
      );
  }

  const fileExplorerComponent = (
    <FileExplorer
      fileStructure={fileStructure}
      activeFile={activeFile}
      onFileSelect={handleActiveFileChange}
      onUploadClick={() => uploadInputRef.current?.click()}
      user={user}
      expandedFolders={expandedFolders}
      onFolderToggle={folderToggle}
      onNewFile={(parentPath) => handleNewItem('file', parentPath)}
      onNewFolder={(parentPath) => handleNewItem('folder', parentPath)}
      onFileDelete={setDeletingPath}
      renamingPath={renamingPath}
      onRename={handleRename}
      setRenamingPath={setRenamingPath}
    />
  );
  
  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col">
        <AppHeader
          workspaceName={workspaceName} onNewPost={() => setIsPostEditorOpen(true)}
            onUpgradeClick={() => setUpgradeModalOpen(true)}>
          {isMobile && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="p-4">
                  <SheetTitle className="sr-only">Workspace</SheetTitle>
                </SheetHeader>
                {fileExplorerComponent}
              </SheetContent>
            </Sheet>
          )}
        </AppHeader>
        <main className="flex flex-1 overflow-hidden">
          {!isMobile && <IconSidebar user={user} />}
          {!isMobile && fileExplorerComponent}
          <input
            type="file"
            ref={uploadInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/png, image/jpeg, image/gif, image/svg+xml"
          />
          <section className="flex flex-1 flex-col bg-background">
            <div className="flex h-14 shrink-0 items-center justify-between border-b bg-muted/30 px-4">
              <span className="font-mono text-sm">{activeFile}</span>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleNewItem('file', null)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New Root File</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleNewItem('folder', null)}
                      >
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New Root Folder</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onFixCodeClick} disabled={isFixing}>
                      {isFixing ? <Sparkles className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Fix Code with AI</p>
                    </TooltipContent>
                  </Tooltip>
                  <Dialog
                    open={generateDialogOpen}
                    onOpenChange={setGenerateDialogOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Generate with AI</p>
                      </TooltipContent>
                    </Tooltip>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="font-headline">
                          Generate Jekyll Component
                        </DialogTitle>
                        <DialogDescription>
                          Describe the component you want to create. For example, "a
                          responsive navigation header with a logo and three links".
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <Textarea
                          placeholder="e.g., a blog post layout with a title, date, and content area"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={handleGenerateClick}
                          disabled={isGenerating || !prompt}
                        >
                          {isGenerating && (
                            <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                          )}
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TooltipProvider>
              </div>
            </div>
            <CodeEditor
              activeFile={activeFile}
              content={content}
              setContent={handleContentChange}
              isSaving={isSaving}
              user={user}
            />
          </section>
        </main>
        <AppFooter
          onPublish={() => setShowPublishConfirm(true)}
          isPublishing={isPublishing}
          onPullRequest={handlePullRequest}
          isCreatingPr={isCreatingPr}
        />
        {/* --- DIALOG KONFIRMASI --- */}
        <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Publikasi</AlertDialogTitle>
                    <AlertDialogDescription>
                        Proses ini akan melakukan commit pada semua file teks (HTML, CSS, MD, dll.) dan menghapus file yang tidak ada lagi di workspace.
                        <br/><br/>
                        <strong className="text-foreground">Penting:</strong> File gambar (.png, .jpg, dll.) yang diunggah melalui File Explorer tidak akan di-publish. Untuk menambahkan gambar, silakan gunakan fitur "Create New Post".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePublish}>Lanjut & Push</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!deletingPath}
          onOpenChange={(open) => !open && setDeletingPath(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the{' '}
                <span className="font-bold">
                  {deletingPath &&
                    findNodeAndParent(deletingPath, fileStructure).node?.name}
                </span>{' '}
                and all its contents.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingPath(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingPath && handleDelete(deletingPath)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <PostEditor 
            open={isPostEditorOpen} 
            onOpenChange={setIsPostEditorOpen}
            onPostPublished={handlePostPublished}
        />
        <UpgradeModal isOpen={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
      </div>
    </TooltipProvider>
  );
}

export default function HomePage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </React.Suspense>
  );
}