import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Github,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/authStore';
import { cn } from '../../utils/helpers';
import { Button } from '../common/Button';

export function GitHubCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGitHub } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const handleCallback = async () => {
      if (error) {
        setStatus('error');
        setErrorMessage(`GitHub authorization failed: ${error}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received from GitHub');
        return;
      }

      try {
        await loginWithGitHub(code);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.response?.data?.detail || 'Failed to connect GitHub account');
      }
    };

    handleCallback();
  }, [searchParams, loginWithGitHub]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 max-w-md w-full mx-4 text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Github className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Connecting to GitHub
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            Please wait while we authorize your account...
          </p>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 max-w-md w-full mx-4 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </motion.div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Successfully Connected!
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            Your GitHub account has been linked to DevFlow AI.
          </p>
          <Button
            onClick={() => navigate('/settings?tab=integrations')}
            className="w-full"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            Go to Settings
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 max-w-md w-full mx-4 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Connection Failed
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-6">
          {errorMessage || 'An unexpected error occurred while connecting to GitHub.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate('/settings?tab=integrations')}>
            Try Again
          </Button>
          <Button variant="ghost" onClick={() => navigate('/settings')}>
            Back to Settings
          </Button>
        </div>
      </motion.div>
    </div>
  );
}