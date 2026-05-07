import { SearchResultsData } from '../components/modals/AddComponentModalTypes';

/**
 * Mock search results data
 * In production, this would come from an API
 */
export const SEARCH_RESULTS_DATA: SearchResultsData = {
  topPicks: [
    {
      id: 'result-1',
      title: 'Review support emails',
      description: 'Summarize IT-related emails and help draft or respond to support communications',
      type: 'Tools',
      category: 'tools',
      icon: 'outlook'
    },
    {
      id: 'result-2',
      title: 'Search internal IT knowledge',
      description: 'Find answers from internal IT docs, policies, and troubleshooting guides',
      type: 'Knowledge',
      category: 'knowledge',
      icon: 'sharepoint'
    },
    {
      id: 'result-3',
      title: 'Read Teams messages',
      description: 'Help users get IT answers when they message you in Teams',
      type: 'Trigger',
      category: 'triggers',
      icon: 'teams'
    }
  ],
  allResults: [
    {
      id: 'result-4',
      title: 'Send a message',
      description: 'Share a claim summary and recommendation with the claim adjuster via Teams',
      type: 'Tools',
      category: 'tools',
      icon: 'teams'
    },
    {
      id: 'result-5',
      title: 'Create a SharePoint item',
      description: 'Add new items to SharePoint lists or document libraries',
      type: 'Tools',
      category: 'tools',
      icon: 'sharepoint'
    },
    {
      id: 'result-6',
      title: 'Download a file',
      description: 'Retrieve files from SharePoint or OneDrive',
      type: 'Tools',
      category: 'tools',
      icon: 'document-arrow-down'
    },
    {
      id: 'result-7',
      title: 'Post in Teams channel',
      description: 'Share updates and notifications in specific Teams channels',
      type: 'Tools',
      category: 'tools',
      icon: 'teams'
    },
    {
      id: 'result-8',
      title: 'IT Policies Knowledge Base',
      description: 'Access comprehensive IT policies, procedures, and compliance documentation',
      type: 'Knowledge',
      category: 'knowledge',
      icon: 'sharepoint'
    },
    {
      id: 'result-9',
      title: 'Connect to IT Support Agent',
      description: 'Escalate complex issues to specialized IT support agent',
      type: 'Agent',
      category: 'agents',
      icon: 'agent-outlined'
    },
    {
      id: 'result-10',
      title: 'Schedule recurring report',
      description: 'Automatically generate and send IT support reports on a schedule',
      type: 'Trigger',
      category: 'triggers',
      icon: 'flow-dot'
    }
  ]
};
