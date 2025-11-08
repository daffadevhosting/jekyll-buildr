'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';
import { GithubAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { initializeUser } from '@/actions/user';
import { Github } from 'lucide-react';

type Status = 'waiting_for_login' | 'linking' | 'success' | 'error';

function CliLoginContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [status, setStatus] = useState<Status>('waiting_for_login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('The session ID is missing from the URL. Please try the login command again.');
    }
  }, [sessionId]);

  const handleLoginSuccess = async (user: User) => {
    if (!sessionId) {
        setStatus('error');
        setError('Session ID is missing. Cannot link session.');
        return;
    }

    setStatus('linking');
    try {
      // Ensure user is initialized in our database
      const githubId = user.providerData.find(p => p.providerId === 'github.com')?.uid;
      if (!githubId) {
        throw new Error("Could not find GitHub ID from provider data.");
      }
      await initializeUser({
        uid: user.uid,
        githubId: githubId,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      // Get ID token to authenticate with our API
      const idToken = await user.getIdToken(true);

      // Link the session
      const response = await fetch('/api/cli/link-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link the session. Please try again.');
      }

      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'An unexpected error occurred during login setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setLoading(true);
    setError(null);
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleLoginSuccess(result.user);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("GitHub Sign-In Error:", error);
        setError(error.message || 'Failed to sign in with GitHub.');
        setStatus('error');
      }
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'waiting_for_login':
        return (
          <>
            <h1 className="text-2xl font-bold mb-4">Login to Jekyll Buildr CLI</h1>
            <p className="mb-6">Click the button below to authenticate with your account.</p>
            <Button onClick={handleGithubSignIn} size="lg" disabled={loading}>
              {loading ? 'Redirecting to GitHub...' : (
                <>
                  <Github className="mr-2 h-4 w-4" />
                  Login with GitHub
                </>
              )}
            </Button>
          </>
        );
      case 'linking':
        return (
          <>
            <h1 className="text-2xl font-bold mb-4">Finalizing Login...</h1>
            <p>Please wait while we securely connect to your terminal.</p>
          </>
        );
      case 'success':
        return (
          <>
            <h1 className="text-2xl font-bold mb-4 text-green-500">✅ Success!</h1>
            <p>Your CLI is now authenticated. You can close this window and return to your terminal.</p>
          </>
        );
      case 'error':
        return (
          <>
            <h1 className="text-2xl font-bold mb-4 text-red-500">❌ Error</h1>
            <p>{error || 'An unknown error occurred. Please try again.'}</p>
          </>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 text-center border rounded-lg shadow-lg">
        {renderContent()}
      </div>
    </div>
  );
}

export default function CliLoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <CliLoginContent />
    </Suspense>
  );
}

