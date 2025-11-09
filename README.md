# Jekyll Buildr - Modern Jekyll Development Platform

[![NPM Version](https://img.shields.io/npm/v/jekyll-buildr-cli.svg)](https://www.npmjs.com/package/jekyll-buildr-cli)
[![License](https://img.shields.io/npm/l/jekyll-buildr-cli.svg)](https://github.com/DaffaDev/jekyll-buildr-cli/blob/main/LICENSE)
![Status](https://img.shields.io/badge/status-release-green)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DaffaDev.jekyll-buildr?label=VS%20Code%20Extension)](https://marketplace.visualstudio.com/items?itemName=DaffaDev.jekyll-buildr)

**Jekyll Buildr** is a comprehensive development platform for Jekyll websites, available in three integrated versions:
- **Web App**: Browser-based mini-IDE with AI features
- **CLI Tool**: Command-line interface for advanced developers
- **VS Code Extension**: Integrated development environment for VS Code

## 🌟 Key Features

### 🖥️ **Browser-Based Integrated Development Environment**
- **Full-Featured Code Editor**: In-browser editor with syntax highlighting for HTML, Markdown, YAML, CSS, and more
- **File Management**: Complete file explorer with create, rename, and delete capabilities
- **Real-time Jekyll Preview**: Interactive preview pane that shows live updates when running `jekyll serve`
- **Terminal Integration**: Built-in terminal emulator with support for Jekyll commands, bundle management, and system operations
- **Keyboard Shortcuts**: Efficient shortcuts including `Ctrl + `` to toggle terminal

### 🤖 **AI-Powered Development Tools**
- **AI Component Generation**: Describe what you need and generate Jekyll-compliant HTML and Liquid code
- **AI Code Completion**: Mini-Copilot with real-time code suggestions (Pro feature)
- **AI Code Fixes**: One-click error correction for problematic code (Pro feature)
- **AI Content Generation**: Create blog posts and content from text prompts
- **AI Image Generation**: Generate unique images for your site from descriptions

### 🔐 **Secure GitHub Integration**
- **GitHub OAuth**: Secure authentication using your GitHub account
- **Repository Cloning**: Import GitHub repositories directly into the editor
- **Push to Branch**: Commit and push changes directly to your GitHub repository
- **Pull Request Creation**: Create new branches and pull requests for code review workflows
- **Cloud Auto-Save**: Automatic saving to Firestore every 2 seconds

### 💰 **Pro Tier Features**
- **Unlimited Workspaces**: Create and manage multiple projects simultaneously
- **Advanced AI Tools**: Enhanced code completion, fixes, and generation capabilities
- **Priority Support**: Dedicated support for Pro users

## 📦 Available Versions

### 1. Web Application
The browser-based IDE with all features accessible through your web browser.

### 2. CLI Tool
Command-line interface for developers who prefer terminal-based workflows.

```bash
npm install -g jekyll-buildr-cli
```

### 3. VS Code Extension
Full integration with Visual Studio Code for desktop development.

```bash
ext install DaffaDev.jekyll-buildr
```

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Authentication & Database**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
- **AI Features**: [Google AI & Genkit](https://firebase.google.com/docs/genkit)
- **Payments**: [PayPal](https://www.paypal.com/)
- **Terminal**: [xterm.js](https://xtermjs.org/) for terminal emulation

## 🚀 Getting Started

### Web Application
1. **Sign In**: Log in using your GitHub account at [jekyll-buildr.vercel.app](https://jekyll-buildr.vercel.app)
2. **Connect GitHub**: Install the Jekyll Buildr GitHub App in your repositories
3. **Select Project**: Choose your repository and branch to begin working
4. **Start Developing**: Create, edit, and manage your Jekyll site

### CLI Tool
```bash
# Install globally
npm install -g jekyll-buildr-cli

# Initialize a new project
jekyll-buildr init my-blog

# Or connect to existing project
jekyll-buildr connect <repository-url>
```

### VS Code Extension
1. Install from the VS Code Marketplace
2. Sign in with your Jekyll Buildr account
3. Open your Jekyll project
4. Access all features directly in VS Code

## 📚 Using the Integrated Terminal

The web app includes a powerful terminal emulator:

- **Open Terminal**: Click the `>_` icon or press `Ctrl + `` (backtick)
- **Run Jekyll Commands**: Execute `jekyll serve`, `jekyll build`, `jekyll doctor`
- **Manage Dependencies**: Run `bundle install` and other Ruby commands
- **System Commands**: Use `ls`, `pwd`, `cat`, and other file operations
- **Real-time Preview**: When running `jekyll serve`, the preview pane automatically activates

## 💡 Example Output

Check out a live example of a blog created with Jekyll Buildr: [My Blog Site](https://daffadevhosting.github.io/blog/)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please open an issue in this repository or contact us through the application.