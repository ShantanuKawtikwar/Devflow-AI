import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Bell,
  Shield,
  Github,
  Key,
  Mail,
  Moon,
  Sun,
  Monitor,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { api, authApi, githubApi, usersApi } from '../../services/api';
import { User as UserType, GitHubAccount } from '../../types';
import { useAuth } from '../../context/authStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { Avatar } from '../common/Avatar';
import { Tabs, TabList, TabTrigger, TabContent } from '../common/Tabs';
import { Card } from '../common/Card';
import { toast } from 'react-hot-toast';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function Settings() {
  const { user, updateUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance' | 'integrations' | 'security' | 'danger'>('profile');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: githubAccount } = useQuery({
    queryKey: ['github-account'],
    queryFn: () => githubApi.getAccount(),
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<UserType>) => usersApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      toast.success('Profile updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Record<string, any>) => api.patch('/users/me/preferences', data),
    onSuccess: () => {
      toast.success('Preferences saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save preferences');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed');
      setShowChangePasswordModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    },
  });

  const connectGitHubMutation = useMutation({
    mutationFn: () => githubApi.getAuthUrl(),
    onSuccess: (data) => {
      window.location.href = data.auth_url;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to initiate GitHub connection');
    },
  });

  const disconnectGitHubMutation = useMutation({
    mutationFn: () => githubApi.disconnect(),
    onSuccess: () => {
      toast.success('GitHub account disconnected');
      queryClient.invalidateQueries({ queryKey: ['github-account'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to disconnect GitHub');
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => {
      logout();
      toast.success('Account deleted');
      window.location.href = '/login';
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    },
  });

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  };

  const handlePreferenceChange = (key: string, value: any) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'integrations', label: 'Integrations', icon: Github },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="border-b border-neutral-200 dark:border-neutral-800">
        <TabList className="gap-1">
          {tabs.map((tab) => (
            <TabTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-4 py-3 text-sm"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabTrigger>
          ))}
        </TabList>

        {/* Profile Tab */}
        <TabContent value="profile" className="space-y-6 pt-6 animate-fade-in">
          <Card>
            <div className="flex items-center gap-6 p-6 border-b border-neutral-200 dark:border-neutral-800">
              <Avatar
                name={user?.full_name || user?.username || 'User'}
                src={user?.avatar_url}
                size="xl"
              />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {user?.full_name || user?.username}
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400">@{user?.username}</p>
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
                  {user?.email}
                </p>
              </div>
              {user?.github_connected && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>GitHub connected</span>
                </div>
              )}
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate({
                full_name: fullName,
                bio: bio,
              });
            }} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="Full Name"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label="Username"
                  placeholder="username"
                  value={user?.username || ''}
                  disabled
                  helperText="Username cannot be changed"
                />
              </div>

              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={user?.email || ''}
                disabled
                helperText="Email cannot be changed. Contact support to update."
              />

              <div>
                <label className="label">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 resize-y min-h-[100px]"
                  rows={4}
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button type="submit" loading={updateProfileMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </TabContent>

        {/* Notifications Tab */}
        <TabContent value="notifications" className="space-y-6 pt-6 animate-fade-in">
          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Email Notifications</h3>
            <div className="space-y-4">
              {notificationOptions.map((option) => (
                <NotificationToggle
                  key={option.key}
                  label={option.label}
                  description={option.description}
                  checked={preferences.notifications?.[option.key] ?? true}
                  onChange={(checked) => handlePreferenceChange(`notifications.${option.key}`, checked)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">In-App Notifications</h3>
            <div className="space-y-4">
              {inAppNotificationOptions.map((option) => (
                <NotificationToggle
                  key={option.key}
                  label={option.label}
                  description={option.description}
                  checked={preferences.inAppNotifications?.[option.key] ?? true}
                  onChange={(checked) => handlePreferenceChange(`inAppNotifications.${option.key}`, checked)}
                />
              ))}
            </div>
          </Card>
        </TabContent>

        {/* Appearance Tab */}
        <TabContent value="appearance" className="space-y-6 pt-6 animate-fade-in">
          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Theme</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themeOptions.map((theme) => (
                <ThemeOption
                  key={theme.value}
                  theme={theme}
                  selected={preferences.theme === theme.value}
                  onSelect={() => handlePreferenceChange('theme', theme.value)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Density</h3>
            <Select
              value={preferences.density || 'comfortable'}
              onValueChange={(value) => handlePreferenceChange('density', value)}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Spacious' },
              ]}
              className="max-w-xs"
            />
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Sidebar</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">Collapse sidebar by default</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Start with a minimized sidebar</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.collapseSidebar}
                  onChange={(e) => handlePreferenceChange('collapseSidebar', e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
              </label>
            </div>
          </Card>
        </TabContent>

        {/* Integrations Tab */}
        <TabContent value="integrations" className="space-y-6 pt-6 animate-fade-in">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Github className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">GitHub</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Connect your GitHub account for repository sync</p>
                </div>
              </div>
              {githubAccount ? (
                <div className="flex items-center gap-3">
                  <span className="badge badge-green">Connected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectGitHubMutation.mutate()}
                    loading={disconnectGitHubMutation.isPending}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => connectGitHubMutation.mutate()}
                  loading={connectGitHubMutation.isPending}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Connect GitHub
                </Button>
              )}
            </div>

            {githubAccount && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    name={githubAccount.login}
                    src={githubAccount.avatar_url}
                    size="md"
                  />
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">@{githubAccount.login}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{githubAccount.name || 'No name'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-white dark:bg-neutral-900 rounded-lg">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{githubAccount.public_repos}</p>
                    <p className="text-neutral-500 dark:text-neutral-400">Repositories</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-neutral-900 rounded-lg">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{githubAccount.followers}</p>
                    <p className="text-neutral-500 dark:text-neutral-400">Followers</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-neutral-900 rounded-lg">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{githubAccount.following}</p>
                    <p className="text-neutral-500 dark:text-neutral-400">Following</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-neutral-900 rounded-lg">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatDate(githubAccount.created_at)}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400">Member since</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 border-t border-neutral-200 dark:border-neutral-800">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">What GitHub integration provides:</h4>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Sync repositories and branches</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Link commits and PRs to tasks</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Automatic task updates from GitHub activity</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Import GitHub issues as tasks</li>
              </ul>
            </div>
          </Card>
        </TabContent>

        {/* Security Tab */}
        <TabContent value="security" className="space-y-6 pt-6 animate-fade-in">
          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Password</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              Your password was last changed {formatDate(user?.password_changed_at || user?.created_at)}.
            </p>
            <Button
              variant="secondary"
              onClick={() => setShowChangePasswordModal(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Two-Factor Authentication</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">
              Add an extra layer of security to your account.
            </p>
            <Button variant="secondary" disabled>
              <Shield className="w-4 h-4 mr-2" />
              Enable 2FA (Coming Soon)
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Active Sessions</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">
              Manage your active login sessions.
            </p>
            <Button variant="secondary" disabled>
              <Loader2 className="w-4 h-4 mr-2" />
              View Sessions (Coming Soon)
            </Button>
          </Card>
        </TabContent>

        {/* Danger Zone Tab */}
        <TabContent value="danger" className="space-y-6 pt-6 animate-fade-in">
          <Card className="p-6 border-red-200 dark:border-red-900/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Delete Account</h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">Permanently delete your account and all data</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              <p>This action is irreversible and will:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Delete your account and profile</li>
                <li>Remove you from all teams and projects</li>
                <li>Delete all your tasks, comments, and activity</li>
                <li>Disconnect all integrations (GitHub, etc.)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <Input
                label="Type 'DELETE' to confirm"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                error={showDeleteModal && deleteConfirmText !== 'DELETE' ? 'Must type DELETE exactly' : undefined}
              />

              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmText === 'DELETE') {
                    deleteAccountMutation.mutate();
                  }
                }}
                loading={deleteAccountMutation.isPending}
                disabled={deleteConfirmText !== 'DELETE'}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </div>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  );
}

const [fullName, setFullName] = useState(user?.full_name || '');
const [bio, setBio] = useState(user?.bio || '');
const [preferences, setPreferences] = useState({
  theme: 'system',
  density: 'comfortable',
  collapseSidebar: false,
  notifications: {
    email: true,
    mentions: true,
    assignments: true,
    comments: true,
    sprintUpdates: true,
    weeklyDigest: false,
  },
  inAppNotifications: {
    mentions: true,
    assignments: true,
    comments: true,
    taskUpdates: true,
    sprintUpdates: true,
  },
});

useEffect(() => {
  if (user) {
    setFullName(user.full_name || '');
    setBio(user.bio || '');
  }
}, [user]);

useEffect(() => {
  const saved = localStorage.getItem('user-preferences');
  if (saved) {
    try {
      setPreferences(JSON.parse(saved));
    } catch {}
  }
}, []);

const notificationOptions = [
  { key: 'email', label: 'All email notifications', description: 'Receive email notifications for all activity' },
  { key: 'mentions', label: 'Mentions', description: 'When someone mentions you in a comment' },
  { key: 'assignments', label: 'Assignments', description: 'When a task is assigned to you' },
  { key: 'comments', label: 'Comments', description: 'When someone comments on your tasks' },
  { key: 'sprintUpdates', label: 'Sprint updates', description: 'When sprints start, end, or are updated' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'Weekly summary of your projects' },
];

const inAppNotificationOptions = [
  { key: 'mentions', label: 'Mentions', description: 'When someone mentions you' },
  { key: 'assignments', label: 'Assignments', description: 'When a task is assigned to you' },
  { key: 'comments', label: 'Comments', description: 'When someone comments on your tasks' },
  { key: 'taskUpdates', label: 'Task updates', description: 'When tasks you follow are updated' },
  { key: 'sprintUpdates', label: 'Sprint updates', description: 'When sprints start or end' },
];

function NotificationToggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
      <div className="flex-1">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
      />
    </label>
  );
}

function ThemeOption({ theme, selected, onSelect }: {
  theme: { value: string; label: string; icon: typeof Sun };
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = theme.icon;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-xl border-2 transition-all',
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <Icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </div>
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{theme.label}</span>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}