'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth'; // Assuming this hook exists and provides user and token
import { Button } from '@/components/ui/button'; // Assuming you have a Button component

type Status = 'loading' | 'waiting_for_login' | 'linking' | 'success' | 'error';

export default function CliLoginPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { user, idToken, login } = useAuth(); // Using your existing auth hook

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('The session ID is missing from the URL. Please try the login command again.');
      return;
    }

    if (user && idToken) {
      // User is already logged in, proceed to link the session
      setStatus('linking');
      
      fetch('/api/cli/link-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ sessionId }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to link the session. Please try again.');
        }
        setStatus('success');
      })
      .catch(err => {
        setStatus('error');
        setError(err.message);
      });

    } else {
      // User is not logged in, wait for them to click the login button
      setStatus('waiting_for_login');
    }
  }, [sessionId, user, idToken]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return <p>Loading...</p>;
      case 'waiting_for_login':
        return (
          <>
            <h1 className="text-2xl font-bold mb-4">Login to Jekyll Buildr CLI</h1>
            <p className="mb-6">Click the button below to authenticate with your account.</p>
            <Button onClick={login} size="lg">
              Login with GitHub
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
