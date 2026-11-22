import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  Target,
  BarChart2,
  MessageSquare,
  Send,
  Loader2,
  X,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Brain,
  Zap,
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { projectsApi, aiApi, tasksApi } from '../../services/api';
import { Project, Task, TaskStatus } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { toast } from 'react-hot-toast';

type AITab = 'generate' | 'summarize' | 'plan' | 'insights' | 'chat';

interface GeneratedTask {
  title: string;
  description: string;
  priority: string;
  story_points: number;
}

interface SprintPlan {
  sprint_name: string;
  sprint_goal: string;
  selected_tasks: Array<{ task_id: string; title: string; story_points: number }>;
  total_story_points: number;
  capacity: number;
  reasoning: string;
}

interface ProjectSummary {
  summary: string;
  key_metrics: {
    total_tasks: number;
    completed: number;
    in_progress: number;
    completion_rate: number;
  };
  recommendations: string[];
}

interface Insight {
  type: string;
  title: string;
  description: string;
  severity: 'positive' | 'warning' | 'negative' | 'neutral';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AITab>('generate');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showCreateTasksModal, setShowCreateTasksModal] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [sprintPlan, setSprintPlan] = useState<SprintPlan | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: backlogTasks } = useQuery({
    queryKey: ['tasks', projectId, 'backlog'],
    queryFn: () => tasksApi.list(projectId!, { status: 'backlog' }),
    enabled: !!projectId,
  });

  // Generate tasks mutation
  const generateTasksMutation = useMutation({
    mutationFn: (description: string) => aiApi.generateTasks(projectId!, description),
    onSuccess: (data) => {
      setGeneratedTasks(data.tasks);
      setShowCreateTasksModal(true);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate tasks');
    },
  });

  // Summarize project mutation
  const summarizeMutation = useMutation({
    mutationFn: () => aiApi.summarizeProject(projectId!),
    onSuccess: (data) => {
      setProjectSummary(data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to summarize project');
    },
  });

  // Plan sprint mutation
  const planSprintMutation = useMutation({
    mutationFn: (params: { sprint_name: string; capacity: number }) =>
      aiApi.planSprint(projectId!, params),
    onSuccess: (data) => {
      setSprintPlan(data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to plan sprint');
    },
  });

  // Generate insights mutation
  const insightsMutation = useMutation({
    mutationFn: () => aiApi.generateInsights(projectId!),
    onSuccess: (data) => {
      setInsights(data.insights);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate insights');
    },
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (params: { message: string; conversation_id?: string }) =>
      aiApi.chat(projectId!, params),
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response, timestamp: new Date() }]);
      if (data.conversation_id) {
        setChatConversationId(data.conversation_id);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    },
  });

  // Create tasks from generated
  const createTasksMutation = useMutation({
    mutationFn: (tasks: GeneratedTask[]) =>
      Promise.all(tasks.map((task) => tasksApi.create(projectId!, task))),
    onSuccess: () => {
      toast.success(`${generatedTasks.length} tasks created successfully`);
      setShowCreateTasksModal(false);
      setGeneratedTasks([]);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create tasks');
    },
  });

  // Create sprint from plan
  const createSprintMutation = useMutation({
    mutationFn: (plan: SprintPlan) =>
      projectsApi.createSprint(projectId!, {
        name: plan.sprint_name,
        goal: plan.sprint_goal,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    onSuccess: (sprint) => {
      if (sprintPlan) {
        // Add tasks to sprint
        sprintPlan.selected_tasks.forEach((task) => {
          tasksApi.update(task.task_id, { sprint_id: sprint.id });
        });
      }
      toast.success('Sprint created and tasks assigned');
      setSprintPlan(null);
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create sprint');
    },
  });

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const message = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: message, timestamp: new Date() }]);
    chatMutation.mutate({ message, conversation_id: chatConversationId || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleCreateSelectedTasks = () => {
    const tasksToCreate = generatedTasks.filter((_, index) => selectedTasks.has(`task-${index}`));
    if (tasksToCreate.length > 0) {
      createTasksMutation.mutate(tasksToCreate);
    }
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Project not found</h2>
        <p className="text-neutral-500 dark:text-neutral-400">The project you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => navigate('/projects')} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  const tabs: { id: AITab; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'generate', label: 'Generate Tasks', icon: <Sparkles className="w-4 h-4" />, description: 'Create tasks from project description' },
    { id: 'summarize', label: 'Summarize', icon: <FileText className="w-4 h-4" />, description: 'Get AI-powered project summary' },
    { id: 'plan', label: 'Plan Sprint', icon: <Target className="w-4 h-4" />, description: 'AI-assisted sprint planning' },
    { id: 'insights', label: 'Insights', icon: <BarChart2 className="w-4 h-4" />, description: 'AI-generated project insights' },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" />, description: 'Chat with AI about your project' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to={`/projects/${projectId}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline mb-1 inline-block">
            ← Back to {project.key}
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">AI Assistant</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Intelligent features powered by AI for {project.name}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="flex overflow-x-auto" aria-label="AI Assistant tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'generate' && (
            <GenerateTasksTab
              project={project}
              backlogTasks={backlogTasks || []}
              onGenerate={generateTasksMutation.mutate}
              isLoading={generateTasksMutation.isPending}
            />
          )}

          {activeTab === 'summarize' && (
            <SummarizeTab
              project={project}
              summary={projectSummary}
              onSummarize={summarizeMutation.mutate}
              isLoading={summarizeMutation.isPending}
            />
          )}

          {activeTab === 'plan' && (
            <PlanSprintTab
              project={project}
              backlogTasks={backlogTasks || []}
              plan={sprintPlan}
              onPlan={planSprintMutation.mutate}
              onCreateSprint={createSprintMutation.mutate}
              isLoading={planSprintMutation.isPending}
              isCreatingSprint={createSprintMutation.isPending}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsTab
              project={project}
              insights={insights}
              onGenerate={insightsMutation.mutate}
              isLoading={insightsMutation.isPending}
            />
          )}

          {activeTab === 'chat' && (
            <ChatTab
              project={project}
              messages={chatMessages}
              input={chatInput}
              onInputChange={setChatInput}
              onSend={handleSendChat}
              onKeyDown={handleKeyDown}
              isLoading={chatMutation.isPending}
            />
          )}
        </div>
      </div>

      {/* Create Tasks Modal */}
      <Modal
        isOpen={showCreateTasksModal}
        onClose={() => setShowCreateTasksModal(false)}
        title="Review Generated Tasks"
        size="xl"
        description="Select tasks to create in your project"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {generatedTasks.map((task, index) => (
            <motion.div
              key={`task-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'p-4 rounded-lg border transition-all',
                selectedTasks.has(`task-${index}`)
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700'
              )}
              onClick={() => toggleTaskSelection(`task-${index}`)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedTasks.has(`task-${index}`)}
                  onChange={() => toggleTaskSelection(`task-${index}`)}
                  className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{task.title}</h4>
                    <span className={cn('badge', task.priority === 'high' || task.priority === 'urgent' ? 'badge-red' : task.priority === 'medium' ? 'badge-yellow' : 'badge-green')}>
                      {task.priority}
                    </span>
                    {task.story_points && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                        {task.story_points} pts
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{task.description}</p>
                </div>
              </div>
            </motion.div>
          ))}

          {generatedTasks.length === 0 && (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              No tasks generated yet. Click "Generate Tasks" to create some.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button variant="ghost" onClick={() => setShowCreateTasksModal(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedTasks(new Set());
                generatedTasks.forEach((_, index) => setSelectedTasks((prev) => new Set([...prev, `task-${index}`])));
              }}
              disabled={generatedTasks.length === 0}
            >
              Select All
            </Button>
            <Button
              onClick={handleCreateSelectedTasks}
              loading={createTasksMutation.isPending}
              disabled={selectedTasks.size === 0 || createTasksMutation.isPending}
            >
              Create {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Sub-components for each tab
function GenerateTasksTab({
  project,
  backlogTasks,
  onGenerate,
  isLoading,
}: {
  project: Project;
  backlogTasks: Task[];
  onGenerate: (description: string) => void;
  isLoading: boolean;
}) {
  const [description, setDescription] = useState('');

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Generate Tasks</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Describe what you want to build and let AI create tasks</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Project Description"
            as="textarea"
            placeholder="e.g., Build a task management app with user authentication, project boards, real-time collaboration, and reporting dashboard..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            helperText="Be specific about features, user flows, and technical requirements"
          />

          <div className="flex items-center gap-4">
            <Button
              onClick={() => onGenerate(description)}
              loading={isLoading}
              disabled={!description.trim() || isLoading}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Tasks
            </Button>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Uses {backlogTasks.length} existing backlog tasks as context
            </span>
          </div>
        </div>
      </Card>

      {backlogTasks.length > 0 && (
        <Card>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Current Backlog ({backlogTasks.length} tasks)</h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {backlogTasks.slice(0, 6).map((task) => (
              <div key={task.id} className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 truncate mb-1">{task.title}</h4>
                <div className="flex items-center gap-2">
                  <span className={cn('badge-xs', task.priority === 'high' || task.priority === 'urgent' ? 'badge-red' : task.priority === 'medium' ? 'badge-yellow' : 'badge-green')}>
                    {task.priority}
                  </span>
                  {task.story_points && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{task.story_points} pts</span>
                  )}
                </div>
              </div>
            ))}
            {backlogTasks.length > 6 && (
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center text-neutral-500 dark:text-neutral-400">
                +{backlogTasks.length - 6} more tasks
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function SummarizeTab({
  project,
  summary,
  onSummarize,
  isLoading,
}: {
  project: Project;
  summary: ProjectSummary | null;
  onSummarize: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Project Summary</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Get an AI-generated overview of your project status</p>
          </div>
        </div>

        <Button onClick={onSummarize} loading={isLoading} disabled={isLoading} className="w-full sm:w-auto">
          <Brain className="w-4 h-4 mr-2" />
          {summary ? 'Regenerate Summary' : 'Generate Summary'}
        </Button>
      </Card>

      {summary && (
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Summary</h3>
            <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{summary.summary}</p>
          </Card>

          <Card>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Tasks" value={summary.key_metrics.total_tasks} icon={<FileText className="w-5 h-5" />} />
              <StatCard label="Completed" value={summary.key_metrics.completed} color="green" icon={<Check className="w-5 h-5" />} />
              <StatCard label="In Progress" value={summary.key_metrics.in_progress} color="blue" icon={<Loader2 className="w-5 h-5" />} />
              <StatCard label="Completion Rate" value={`${summary.key_metrics.completion_rate}%`} color="purple" icon={<Target className="w-5 h-5" />} />
            </div>
          </Card>

          {summary.recommendations.length > 0 && (
            <Card>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {summary.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3 text-neutral-600 dark:text-neutral-400">
                    <Zap className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PlanSprintTab({
  project,
  backlogTasks,
  plan,
  onPlan,
  onCreateSprint,
  isLoading,
  isCreatingSprint,
}: {
  project: Project;
  backlogTasks: Task[];
  plan: SprintPlan | null;
  onPlan: (params: { sprint_name: string; capacity: number }) => void;
  onCreateSprint: (plan: SprintPlan) => void;
  isLoading: boolean;
  isCreatingSprint: boolean;
}) {
  const [sprintName, setSprintName] = useState(`Sprint ${Date.now()}`);
  const [capacity, setCapacity] = useState(20);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Plan Sprint</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Let AI select the best tasks for your next sprint</p>
          </div>
        </div>

        {!plan ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sprint Name"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="Sprint 1"
              />
              <Input
                label="Team Capacity (story points)"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                min={1}
              />
            </div>
            <Button onClick={() => onPlan({ sprint_name: sprintName, capacity })} loading={isLoading} disabled={isLoading}>
              <Brain className="w-4 h-4 mr-2" />
              Plan Sprint
            </Button>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Analyzing {backlogTasks.length} backlog tasks...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{plan.sprint_name}</h3>
              <span className="badge badge-purple">Planned</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">{plan.sprint_goal}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Selected Tasks" value={plan.selected_tasks.length} icon={<FileText className="w-5 h-5" />} />
              <StatCard label="Total Points" value={plan.total_story_points} color="blue" icon={<Target className="w-5 h-5" />} />
              <StatCard label="Capacity" value={plan.capacity} color="green" icon={<Zap className="w-5 h-5" />} />
              <StatCard label="Utilization" value={`${Math.round((plan.total_story_points / plan.capacity) * 100)}%`} color="purple" icon={<BarChart2 className="w-5 h-5" />} />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {plan.selected_tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">{index + 1}.</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{task.title}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                      {task.story_points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">{plan.reasoning}</p>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="secondary" onClick={() => setSprintPlan?.(null)}>
                Plan Again
              </Button>
              <Button onClick={() => onCreateSprint(plan)} loading={isCreatingSprint} disabled={isCreatingSprint}>
                Create Sprint
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function InsightsTab({
  project,
  insights,
  onGenerate,
  isLoading,
}: {
  project: Project;
  insights: Insight[];
  onGenerate: () => void;
  isLoading: boolean;
}) {
  const severityColors = {
    positive: 'badge-green',
    warning: 'badge-yellow',
    negative: 'badge-red',
    neutral: 'badge-blue',
  };

  const severityIcons = {
    positive: <Check className="w-4 h-4" />,
    warning: <Zap className="w-4 h-4" />,
    negative: <X className="w-4 h-4" />,
    neutral: <Brain className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Project Insights</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">AI-powered analysis of your project health and velocity</p>
          </div>
        </div>

        <Button onClick={onGenerate} loading={isLoading} disabled={isLoading}>
          <Brain className="w-4 h-4 mr-2" />
          {insights.length > 0 ? 'Regenerate Insights' : 'Generate Insights'}
        </Button>
      </Card>

      {insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <Card key={index} className={cn('border-l-4', insight.severity === 'positive' && 'border-green-500', insight.severity === 'warning' && 'border-yellow-500', insight.severity === 'negative' && 'border-red-500', insight.severity === 'neutral' && 'border-blue-500')}>
              <div className="flex items-start gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', insight.severity === 'positive' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400', insight.severity === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400', insight.severity === 'negative' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', insight.severity === 'neutral' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400')}>
                  {severityIcons[insight.severity]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-neutral-900 dark:text-neutral-100">{insight.title}</h4>
                    <span className={cn('badge-xs', severityColors[insight.severity])}>{insight.type}</span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400">{insight.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatTab({
  project,
  messages,
  input,
  onInputChange,
  onSend,
  onKeyDown,
  isLoading,
}: {
  project: Project;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col h-[500px]">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
              <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">Start a conversation</p>
              <p className="max-w-md mx-auto">Ask me anything about your project - tasks, sprints, priorities, or general advice.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    message.role === 'user'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  )}
                >
                  {message.role === 'user' ? (
                    <span className="text-sm font-medium">{project.key[0]}</span>
                  ) : (
                    <Brain className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2',
                    message.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-none'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={cn('text-xs mt-1', message.role === 'user' ? 'text-primary-100' : 'text-neutral-400')}>
                    {formatDate(message.timestamp.toISOString(), true)}
                  </p>
                </div>
              </motion.div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-neutral-600 dark:text-neutral-400 animate-pulse" />
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-bl-none px-4 py-2 max-w-[75%]">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about your project..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              disabled={isLoading}
            />
            <Button onClick={onSend} loading={isLoading} disabled={!input.trim() || isLoading} size="lg">
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color = 'neutral', icon }: { label: string; value: string | number; color?: string; icon: React.ReactNode }) {
  const colorClasses = {
    neutral: 'text-neutral-900 dark:text-neutral-100',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
        <div className={cn('text-2xl', colorClasses[color as keyof typeof colorClasses] || colorClasses.neutral)}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
    </div>
  );
}