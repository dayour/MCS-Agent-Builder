import { Suggestion } from '../components/modals/AddComponentModalTypes';

/**
 * Database of search suggestions with keyword matching
 * Used to provide dynamic suggestions as user types
 */
export const SUGGESTION_DATABASE: Suggestion[] = [
  {
    text: "Answer internal IT support questions",
    keywords: ["it", "support", "help", "question", "tech", "internal"],
    apps: []
  },
  {
    text: "Respond using approved sources",
    keywords: ["source", "approved", "document", "policy", "compliance", "official"],
    apps: []
  },
  {
    text: "Search internal IT SharePoint sites",
    keywords: ["sharepoint", "site", "document", "internal", "share"],
    apps: ["sharepoint"]
  },
  {
    text: "Review internal IT support channel",
    keywords: ["teams", "channel", "chat", "meeting", "conversation"],
    apps: ["teams"]
  },
  {
    text: "Find IT documentation in OneDrive",
    keywords: ["onedrive", "drive", "file", "folder", "storage"],
    apps: ["onedrive"]
  },
  {
    text: "Check IT helpdesk emails",
    keywords: ["outlook", "email", "mail", "inbox", "message"],
    apps: ["outlook"]
  },
  {
    text: "Analyze IT support tickets",
    keywords: ["ticket", "issue", "problem", "report", "incident"],
    apps: []
  },
  {
    text: "Access IT knowledge base",
    keywords: ["knowledge", "wiki", "documentation", "guide", "manual"],
    apps: []
  },
  {
    text: "Troubleshoot common IT issues",
    keywords: ["troubleshoot", "fix", "solve", "repair", "debug"],
    apps: []
  },
  {
    text: "Review IT policies and procedures",
    keywords: ["policy", "procedure", "guideline", "standard", "rule"],
    apps: []
  },
];
