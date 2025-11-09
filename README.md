# Jekyll Buildr v.2.1 [with AI Generation]

Welcome to Jekyll Buildr, a modern mini-IDE web-based editor designed to streamline your Jekyll workflow. Built with a powerful tech stack, this application provides an intuitive interface to create, edit, and manage your Jekyll projects, complete with AI-powered features and direct integration with VScode & GitHub.

VS Code extension:
```sh
ext install DaffaDev.jekyll-buildr
```

CLI Version
```sh
npm i jekyll-buildr-cli
```

![Status](https://img.shields.io/badge/status-release-green)
![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DaffaDev.jekyll-buildr?label=Marketplace)

## ✨ Key Features

*   **🌀️ VSCode Integrated**: All AI features are integrated with Jekyll Buildr VS Code extension.
*   **💻 In-Browser Code Editor**: A full-featured mini-IDE / code editor with syntax highlighting for various file types (`.html`, `.md`, `.yml`, `.css`, etc.), right in your browser.
*   **🗂️ File Management**: A familiar file explorer to navigate, create, rename, and delete files and folders within your Jekyll project structure.
*   **🤖 AI Component Generation**: Describe a component you need—like a navigation bar or a post layout—and let the AI generate the Jekyll-compliant HTML and Liquid code for you.
*   **🧑‍💻️ AI Code Completion**: Mini-Copilot that can provide code suggestions, 'click the tab' to apply the AI code suggestions.
*   **🛠️ AI Code fixes**: AI can fix error code by blocking the error code and clicking the 'Wrench' button and let AI fix your code.
*   **🧾️ AI Content Generation**: AI can help you create content and images based on the title prompt you input.
*   **🎨 AI Image Generation**: Generate unique images for your posts and assets by simply providing a text prompt.
*   **🔐 Secure Authentication**: User authentication is handled securely via GitHub OAuth through Firebase Authentication.
*   **🚀 Direct GitHub Integration**:
    *   **Repository Cloning**: Users can import (clone) a public repository from GitHub to start a new project, where the application will automatically fetch all the text files.
    *   **Push to Branch**: Commit and push all your changes directly to your selected GitHub repository branch.
    *   **Create Pull Requests**: Create a new branch, commit your changes, and open a pull request for a safer, review-based workflow.
    *   **Auto-save to Cloud**: Any changes to code or file structure will be automatically saved to Firestore every 2 seconds, ensuring no work is lost.

*   **👑 Pro Tier Subscriptions**: Unlock advanced features by upgrading to a Pro account, managed via PayPal subscriptions.
    - **Multi-Workspace Management**: Ability to create, save, and switch between unlimited projects/repositories.
    - **AI Code Completion (Mini-Copilot)**: An AI assistant integrated into the editor to provide real-time code completion suggestions, powered by Gemini 2.5pro.
    - **AI Fix Code**: Advanced feature to analyze and fix all problematic code files automatically with one click.
    - **AI Component, Image & Post Generation**: The ability to generate Jekyll components or entire blog posts and image from just a short text description.

### 🌐️ result buildr for [My Blog Site](https://daffadevhosting.github.io/blog/)

## 🛠️ Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (with App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
*   **Authentication & Database**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
*   **AI Features**: [Google AI & Genkit](https://firebase.google.com/docs/genkit)
*   **Payments**: [PayPal](https://www.paypal.com/)

## 🚀 Getting Started

1.  **Login**: Sign in to the application using your GitHub account.
2.  **Connect GitHub**: Navigate to the **Settings** page.
3.  **Install App**: Click "Connect with GitHub" to install the Jekyll Buildr GitHub App on your desired repositories.
4.  **Select Repo & Branch**: Once connected, select the repository and the primary branch you want to work on.
5.  **Edit & Create**: Return to the main editor page. You can now edit existing files or create new files and folders.
6.  **Use AI**:
    *   Click the **✨ (Sparkles)** icon in the editor header to generate a Jekyll component from a text prompt.
    *   In the `assets/images` folder, use the **✨ (Sparkles)** icon to generate an image from a text prompt.
7.  **Publish**:
    *   Use the **Push to GitHub** button to commit your changes directly to the selected branch.
    *   Use the **Create Pull Request** button for a safer workflow, which will create a new branch and a PR for you to review and merge on GitHub.
