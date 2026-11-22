import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  UserMinus,
  Settings,
  Shield,
  Crown,
  Mail,
  MoreVertical,
  Check,
  X,
  Loader2,
  Search,
  Building2,
} from 'lucide-react';
import { cn, formatDate, getInitials } from '../../utils/helpers';
import { teamsApi, usersApi } from '../../services/api';
import { Team, TeamMember, TeamRole, User } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { Avatar } from '../common/Avatar';
import { toast } from 'react-hot-toast';

const roleOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const roleHierarchy: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function Team() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list(),
    enabled: !!selectedTeam,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created successfully');
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create team');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; slug: string; description?: string }> }) =>
      teamsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team updated successfully');
      setEditingTeam(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update team');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete team');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ teamId, email, role }: { teamId: string; email: string; role: TeamRole }) =>
      teamsApi.inviteMember(teamId, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      toast.success('Invitation sent');
      setInviteEmail('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send invitation');
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role: TeamRole }) =>
      teamsApi.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      toast.success('Role updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      toast.success('Member removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    },
  });

  const filteredTeams = teams?.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleCreateSubmit = (data: { name: string; slug: string; description?: string }) => {
    createMutation.mutate(data);
  };

  const handleUpdateSubmit = (data: { name: string; slug: string; description?: string }) => {
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data });
    }
  };

  const handleDelete = (team: Team) => {
    if (confirm(`Are you sure you want to delete "${team.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(team.id);
    }
  };

  const canManageRole = (currentUserRole: TeamRole, targetUserRole: TeamRole) => {
    return roleHierarchy[currentUserRole] > roleHierarchy[targetUserRole];
  };

  const getCurrentUserRole = (team: Team): TeamRole => {
    // This would come from the team members data
    return 'member';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Teams</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your teams and members</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4" />
          New Team
        </Button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {/* Teams Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {searchQuery ? 'No teams found' : 'No teams yet'}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {searchQuery ? 'Try adjusting your search' : 'Create your first team to get started'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus className="w-4 h-4" />
              Create Team
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team, index) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="card-hover h-full p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{team.name}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">@{team.slug}</p>
                  {team.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4">
                      {team.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {team.member_count || 0} members
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTeam(team)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Team Modal */}
      <Modal
        isOpen={showCreateModal || !!editingTeam}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTeam(null);
        }}
        title={editingTeam ? 'Edit Team' : 'Create Team'}
        size="lg"
      >
        <TeamForm
          onSubmit={editingTeam ? handleUpdateSubmit : handleCreateSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
          defaultValues={editingTeam || undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTeam(null);
          }}
        />
      </Modal>

      {/* Team Settings Modal */}
      {selectedTeam && (
        <TeamSettingsModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          allUsers={allUsers || []}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          onInvite={() => inviteMutation.mutate({ teamId: selectedTeam!.id, email: inviteEmail, role: inviteRole })}
          onUpdateRole={updateMemberRoleMutation.mutate}
          onRemoveMember={removeMemberMutation.mutate}
          isInviting={inviteMutation.isPending}
          isUpdatingRole={updateMemberRoleMutation.isPending}
          isRemoving={removeMemberMutation.isPending}
        />
      )}
    </div>
  );
}

interface TeamFormProps {
  onSubmit: (data: { name: string; slug: string; description?: string }) => void;
  isLoading: boolean;
  defaultValues?: Partial<{ name: string; slug: string; description?: string }>;
  onClose: () => void;
}

function TeamForm({ onSubmit, isLoading, defaultValues, onClose }: TeamFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Input
        label="Name"
        placeholder="Team name"
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />

      <Input
        label="Slug"
        placeholder="team-slug"
        error={errors.slug?.message}
        {...register('slug', {
          required: 'Slug is required',
          pattern: /^[a-z0-9-]+$/,
        })}
        maxLength={100}
        helperText="Lowercase letters, numbers, and hyphens only"
      />

      <div>
        <label className="label">Description</label>
        <textarea
          {...register('description')}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 resize-y min-h-[100px]"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {defaultValues ? 'Save Changes' : 'Create Team'}
        </Button>
      </div>
    </form>
  );
}

interface TeamSettingsModalProps {
  team: Team;
  onClose: () => void;
  allUsers: User[];
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: TeamRole;
  setInviteRole: (role: TeamRole) => void;
  onInvite: () => void;
  onUpdateRole: ({ teamId, userId, role }: { teamId: string; userId: string; role: TeamRole }) => void;
  onRemoveMember: ({ teamId, userId }: { teamId: string; userId: string }) => void;
  isInviting: boolean;
  isUpdatingRole: boolean;
  isRemoving: boolean;
}

function TeamSettingsModal({
  team,
  onClose,
  allUsers,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  onInvite,
  onUpdateRole,
  onRemoveMember,
  isInviting,
  isUpdatingRole,
  isRemoving,
}: TeamSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const { data: members } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => teamsApi.getMembers(team.id),
    enabled: !!team,
  });

  const currentUserRole = 'owner'; // Would come from auth context

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={team.name}
      size="xl"
      description="Manage team members and settings"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Tab Navigation */}
        <div className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="flex" aria-label="Team settings tabs">
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === 'members'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              <Users className="w-4 h-4" /> Members
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === 'settings'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'members' && (
            <MembersTab
              team={team}
              members={members || []}
              allUsers={allUsers}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              onInvite={onInvite}
              onUpdateRole={onUpdateRole}
              onRemoveMember={onRemoveMember}
              currentUserRole={currentUserRole}
              isInviting={isInviting}
              isUpdatingRole={isUpdatingRole}
              isRemoving={isRemoving}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab team={team} />
          )}
        </div>
      </div>
    </Modal>
  );
}

function MembersTab({
  team,
  members,
  allUsers,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  onInvite,
  onUpdateRole,
  onRemoveMember,
  currentUserRole,
  isInviting,
  isUpdatingRole,
  isRemoving,
}: {
  team: Team;
  members: TeamMember[];
  allUsers: User[];
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: TeamRole;
  setInviteRole: (role: TeamRole) => void;
  onInvite: () => void;
  onUpdateRole: ({ teamId, userId, role }: { teamId: string; userId: string; role: TeamRole }) => void;
  onRemoveMember: ({ teamId, userId }: { teamId: string; userId: string }) => void;
  currentUserRole: TeamRole;
  isInviting: boolean;
  isUpdatingRole: boolean;
  isRemoving: boolean;
}) {
  const canManage = (memberRole: TeamRole) => roleHierarchy[currentUserRole] > roleHierarchy[memberRole];
  const isOwner = (memberRole: TeamRole) => memberRole === 'owner';

  return (
    <div className="space-y-6">
      {/* Invite Member */}
      <div className="card p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Invite Member</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            label="Email"
            type="email"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1"
          />
          <Select
            value={inviteRole}
            onValueChange={setInviteRole}
            options={roleOptions.filter((r) => roleHierarchy[r.value as TeamRole] < roleHierarchy[currentUserRole])}
            className="w-40"
          />
          <Button onClick={onInvite} loading={isInviting} disabled={!inviteEmail || isInviting}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite
          </Button>
        </div>
      </div>

      {/* Members List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <th className="pb-3 font-medium">Member</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id} className="border-b border-neutral-100 dark:border-neutral-800/50">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.user?.full_name || member.user?.username || 'Unknown'}
                        src={member.user?.avatar_url}
                        size="sm"
                      />
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {member.user?.full_name || member.user?.username}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          @{member.user?.username}
                        </p>
                      </div>
                      {member.role === 'owner' && (
                        <span className="badge badge-yellow">Owner</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4">
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        onUpdateRole({ teamId: team.id, userId: member.user_id, role: role as TeamRole })
                      }
                      options={roleOptions.filter((r) => roleHierarchy[r.value as TeamRole] <= roleHierarchy[currentUserRole])}
                      disabled={isUpdatingRole || isOwner(member.role) || !canManage(member.role)}
                      className="w-36"
                    />
                  </td>
                  <td className="py-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {formatDate(member.joined_at)}
                  </td>
                  <td className="py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember({ teamId: team.id, userId: member.user_id })}
                      loading={isRemoving}
                      disabled={isRemoving || isOwner(member.role) || !canManage(member.role)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody          </table>
        </div>

        {members.length === 0 && (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
            <p>No members yet. Invite someone to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ team }: { team: Team }) {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Team Information</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <p className="text-neutral-900 dark:text-neutral-100">{team.name}</p>
          </div>
          <div>
            <label className="label">Slug</label>
            <p className="text-neutral-900 dark:text-neutral-100 font-mono">@{team.slug}</p>
          </div>
          <div>
            <label className="label">Description</label>
            <p className="text-neutral-600 dark:text-neutral-400">{team.description || 'No description'}</p>
          </div>
          <div>
            <label className="label">Created</label>
            <p className="text-neutral-600 dark:text-neutral-400">{formatDate(team.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="card p-6 border-red-200 dark:border-red-900/30">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 text-red-600 dark:text-red-400">
          Danger Zone
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Deleting this team is permanent and cannot be undone. All projects and data associated with this team will be lost.
        </p>
        <Button variant="destructive">Delete Team</Button>
      </div>
    </div>
  );
}