// ─── Shared constants, types, mock data, and pure utility functions ──────────
// Extracted from WorkflowCanvas.tsx — used across multiple workflow sub-modules.

import React from 'react';
import { WorkflowNode } from '../../../types';
import { CONNECTORS } from './workflowConnectors';
import {
  Agents24Filled,
  ArrowSplit24Filled,
  Tag24Filled,
  Apps24Filled,
  Code24Filled,
  BracesVariable24Filled,
  ArrowSwap24Filled,
  ArrowRepeatAll24Filled,
  ArrowClockwise24Filled,
  LayerDiagonal24Filled,
  RecordStop24Filled,
  Timer24Filled,
  CalendarClock24Filled,
  Note24Filled,
  Shield24Filled,
  DocumentTextExtract24Filled,
  PersonAlert24Filled,
  PersonFeedback24Filled,
  ApprovalsApp24Filled,
  ClipboardCheckmark24Filled,
  ClipboardArrowRight24Filled,
  DocumentTextClock24Filled,
  ClipboardClock24Filled,
  DataPie24Filled,
  Clock24Filled,
  RowChild24Filled,
  Globe24Filled,
  Calculator24Filled,
  Send24Filled,
  DrawText24Filled,
} from '@fluentui/react-icons';
import { ClaudeSonnetIcon } from '../../../components/ui/ClaudeModelIcons';
import { GPT52AutoIcon } from '../../../components/ui/OpenAIModelIcons';

// ─── Shared SVG icon components ─────────────────────────────────────────────

export const TeamsIcon = ({ style }: { style?: React.CSSProperties }) => (
  React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'currentColor', style, 'aria-hidden': 'true', focusable: 'false' },
    React.createElement('path', { d: 'M19.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.5 1h-3a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V8.5h.5V13a1 1 0 0 0 2 0V7.5a1 1 0 0 0-.5-.5zM14 8H8a1 1 0 0 0-1 1v7a4 4 0 0 0 8 0V9a1 1 0 0 0-1-1zm-1 8a2 2 0 0 1-4 0v-6h4v6z' })
  )
);

// ─── Connector / dot style constants ─────────────────────────────────────────
export const CONNECTOR_COLOR = 'hsl(var(--stroke-default))';
export const CONNECTOR_WIDTH = 2;
export const DOT_FILL = 'hsl(var(--stroke-default))';
export const DOT_STROKE = 'white';
export const DOT_FILL_END = 'white';
export const DOT_STROKE_END = 'hsl(var(--stroke-default))';
export const DOT_SIZE = 10; // diameter in px

// ─── Color constants ────────────────────────────────────────────────────────

export const CONTROL_FLOW_COLOR = '#c05a2e';
export const HITL_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const BG_STYLE = {
  backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
  backgroundSize: '20px 20px',
  backgroundColor: '#f9fafb',
};

// ─── HITL helpers ───────────────────────────────────────────────────────────

export const MOCK_DIRECTORY = [
  { name: 'Priya Nair',   email: 'priya.nair@contoso.com' },
  { name: 'Marcus Webb',  email: 'marcus.webb@contoso.com' },
  { name: 'Tyler Chen',   email: 'tyler.chen@contoso.com' },
  { name: 'Sarah Kim',    email: 'sarah.kim@contoso.com' },
  { name: 'James Okafor', email: 'james.okafor@contoso.com' },
];

export const getHitlInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ─── Per-action icons for Control + Schedule built-in tools ─────────────────

export const CONTROL_ACTION_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  'Apply to each': { bg: CONTROL_FLOW_COLOR, icon: React.createElement(ArrowRepeatAll24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Condition':     { bg: CONTROL_FLOW_COLOR, icon: React.createElement(ArrowSplit24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Delay':         { bg: CONTROL_FLOW_COLOR, icon: React.createElement(Timer24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Delay Until':   { bg: CONTROL_FLOW_COLOR, icon: React.createElement(CalendarClock24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Do until':      { bg: CONTROL_FLOW_COLOR, icon: React.createElement(ArrowClockwise24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Scope':         { bg: CONTROL_FLOW_COLOR, icon: React.createElement(LayerDiagonal24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Switch':        { bg: CONTROL_FLOW_COLOR, icon: React.createElement(ArrowSwap24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
  'Terminate':     { bg: CONTROL_FLOW_COLOR, icon: React.createElement(RecordStop24Filled, { style: { color: 'white', width: 18, height: 18 } }) },
};

// ─── Step type definitions ──────────────────────────────────────────────────

export interface StepType {
  label: string;
  type: WorkflowNode['type'];
  connector?: string;
  icon: React.ReactNode;
  hasChevron?: boolean;
  mcpServerId?: string;
  divider?: never;
}
export interface StepDivider { divider: true; label?: never; type?: never; icon?: never; }
export type StepItem = StepType | StepDivider;

export const PromptIcon = React.createElement('svg', { width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { color: 'hsl(var(--primary))' } },
  React.createElement('path', { d: 'M20.5 4.75C20.5 5.16421 20.8358 5.5 21.25 5.5C21.6642 5.5 22 5.16421 22 4.75V3.5H23.25C23.6642 3.5 24 3.16421 24 2.75C24 2.33579 23.6642 2 23.25 2H22V0.75C22 0.335786 21.6642 0 21.25 0C20.8358 0 20.5 0.335786 20.5 0.75V2H19.25C18.8358 2 18.5 2.33579 18.5 2.75C18.5 3.16421 18.8358 3.5 19.25 3.5H20.5V4.75ZM6.60558 1.62042C6.77918 0.78495 7.5075 3.57628e-06 8.50167 9.44734e-05C9.49547 0.000185251 10.2236 0.784735 10.3971 1.62015C10.574 2.47172 11.0186 3.7577 12.1305 4.87038C13.242 5.9827 14.5277 6.42728 15.3793 6.60407C16.215 6.77754 17 7.50588 17 8.50011C17 9.49418 16.2152 10.2225 15.3797 10.3961C14.5283 10.5731 13.2426 11.018 12.1304 12.1307C11.0187 13.2431 10.5744 14.5278 10.3977 15.3789C10.2241 16.2146 9.4957 17 8.50117 17C7.50736 17 6.77901 16.2156 6.60531 15.3801C6.42819 14.5282 5.98323 13.2417 4.87114 12.1292C3.75887 11.0165 2.47322 10.5722 1.6223 10.3956C0.787871 10.2225 0.00362456 9.49616 0.00185096 8.50341C7.22408e-05 7.50777 0.786019 6.77769 1.62262 6.60398C2.47424 6.42714 3.75917 5.98255 4.87117 4.87027C5.98397 3.75718 6.42871 2.47165 6.60558 1.62042ZM9.5 20.25V17.8204C9.1961 17.9351 8.86183 18 8.50117 18C8.32789 18 8.16068 17.985 8 17.9567V20.25C8 22.3211 9.67893 24 11.75 24H20.25C22.3211 24 24 22.3211 24 20.25V11.75C24 9.67893 22.3211 8 20.25 8H17.9569C17.9851 8.16035 18 8.3272 18 8.50011C18 8.86117 17.9349 9.19581 17.82 9.5H20.25C21.4926 9.5 22.5 10.5074 22.5 11.75V20.25C22.5 21.4926 21.4926 22.5 20.25 22.5H11.75C10.5074 22.5 9.5 21.4926 9.5 20.25ZM0 21.25C0 20.8358 0.335786 20.5 0.75 20.5H2V19.25C2 18.8358 2.33579 18.5 2.75 18.5C3.16421 18.5 3.5 18.8358 3.5 19.25V20.5H4.75C5.16421 20.5 5.5 20.8358 5.5 21.25C5.5 21.6642 5.16421 22 4.75 22H3.5V23.25C3.5 23.6642 3.16421 24 2.75 24C2.33579 24 2 23.6642 2 23.25V22H0.75C0.335786 22 0 21.6642 0 21.25ZM12 14.25C12 13.8358 12.3358 13.5 12.75 13.5H19.75C20.1642 13.5 20.5 13.8358 20.5 14.25C20.5 14.6642 20.1642 15 19.75 15H12.75C12.3358 15 12 14.6642 12 14.25ZM12.75 17C12.3358 17 12 17.3358 12 17.75C12 18.1642 12.3358 18.5 12.75 18.5H17.25C17.6642 18.5 18 18.1642 18 17.75C18 17.3358 17.6642 17 17.25 17H12.75Z', fill: 'currentColor' })
);

export const M365_COPILOT_SVG_PATH = 'M4.69405 17.2446C5.24991 17.2628 5.50461 17.4557 5.6798 17.6881C5.91739 18.0032 6.0556 18.4507 6.24191 19.0836L6.25254 19.1197C6.41716 19.6793 6.63012 20.4032 7.07658 20.9707C7.58358 21.6151 8.33343 22.0002 9.4036 22.0002H16.6324C18.1221 22.0002 19.2187 21.0357 20.0072 19.8691C20.8004 18.6958 21.3883 17.1702 21.8439 15.71L21.8455 15.7049C22.3662 14.0357 23.0272 11.9171 23.0027 10.2055C22.9903 9.33717 22.8024 8.45216 22.2166 7.78029C21.6119 7.08675 20.7049 6.75637 19.5545 6.75637H19.3132C18.7574 6.73824 18.5027 6.54532 18.3275 6.31296C18.0899 5.99786 17.9517 5.55028 17.7654 4.91746L17.7548 4.88131C17.5901 4.32172 17.3772 3.59778 16.9307 3.03032C16.4237 2.38592 15.6739 2.00079 14.6037 2.00079H7.37493C5.88524 2.00079 4.78863 2.96535 4.00007 4.13188C3.20688 5.30525 2.61901 6.83079 2.16344 8.29097L2.16184 8.29611C1.64105 9.96532 0.980067 12.0839 1.00457 13.7955C1.017 14.6638 1.20489 15.5489 1.79069 16.2207C2.39539 16.9143 3.30237 17.2446 4.45284 17.2446H4.69405ZM3.59537 8.73772C4.0389 7.31613 4.57492 5.95989 5.24277 4.97193C5.91525 3.97712 6.61685 3.50079 7.37493 3.50079H12.0042C11.8121 3.84488 11.6504 4.22575 11.505 4.6185C11.3066 5.15409 11.1225 5.75728 10.9335 6.37682L10.8914 6.51482C10.1409 8.97189 9.20203 12.1375 8.59718 14.1874C8.33206 15.086 7.52308 15.7101 6.59332 15.7433H4.60686C4.59139 15.7433 4.57602 15.7437 4.56078 15.7446H4.45284C3.58706 15.7446 3.15609 15.5043 2.92129 15.235C2.66759 14.944 2.51443 14.4741 2.50441 13.7741C2.48404 12.3509 3.0512 10.4819 3.59537 8.73772ZM18.7645 19.0291C18.092 20.0239 17.3904 20.5002 16.6324 20.5002H12.0031C12.1952 20.1561 12.3569 19.7753 12.5023 19.3825C12.7007 18.8469 12.8848 18.2437 13.0738 17.6242L13.1159 17.4862C13.8664 15.0291 14.8053 11.8636 15.4101 9.81361C15.6752 8.91506 16.4842 8.29097 17.414 8.25776H19.4004C19.4159 8.25776 19.4313 8.25729 19.4465 8.25637H19.5545C20.4202 8.25637 20.8512 8.49676 21.086 8.76606C21.3397 9.05704 21.4929 9.52695 21.5029 10.2269C21.5233 11.6501 20.9561 13.5191 20.4119 15.2633C19.9684 16.6849 19.4324 18.0411 18.7645 19.0291ZM10.4645 15.7433H9.47628C9.72189 15.4081 9.9133 15.0273 10.0359 14.6119C10.3021 13.7096 10.6328 12.5921 10.9834 11.4147L11.4676 9.80149C11.7427 8.8852 12.5861 8.25776 13.5428 8.25776H14.531C14.2854 8.59293 14.094 8.97372 13.9714 9.38912C13.7052 10.2914 13.3745 11.4089 13.0239 12.5863L12.5397 14.1995C12.2646 15.1158 11.4212 15.7433 10.4645 15.7433ZM13.5428 6.75776C13.118 6.75776 12.7063 6.83089 12.3217 6.96679L12.364 6.82822C12.5575 6.19447 12.7291 5.63203 12.9116 5.13951C13.1069 4.61215 13.2965 4.21683 13.4999 3.93828C13.5469 3.87383 13.6781 3.75782 13.9058 3.65616C14.1242 3.55862 14.3738 3.50079 14.6037 3.50079C15.2609 3.50079 15.5571 3.71029 15.7518 3.95782C15.9974 4.26999 16.1425 4.71614 16.3265 5.3411L16.3495 5.41962C16.4677 5.82265 16.6105 6.30933 16.8437 6.75776H13.5428ZM10.4645 17.2433C10.8893 17.2433 11.301 17.1701 11.6856 17.0342L11.6433 17.1728C11.4498 17.8065 11.2782 18.369 11.0957 18.8615C10.9004 19.3889 10.7108 19.7842 10.5074 20.0627C10.4604 20.1272 10.3292 20.2432 10.1015 20.3449C9.88305 20.4424 9.63346 20.5002 9.4036 20.5002C8.7464 20.5002 8.45021 20.2907 8.25546 20.0432C8.00986 19.731 7.86484 19.2849 7.68084 18.6599L7.65778 18.5814C7.53959 18.1784 7.39685 17.6917 7.16357 17.2433H10.4645Z';

const M365CopilotIcon = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { color: 'hsl(var(--primary))', flexShrink: 0 } },
  React.createElement('path', { d: M365_COPILOT_SVG_PATH, fill: 'currentColor' })
);

export const STEP_TYPES: StepItem[] = [
  { label: 'Agent',        type: 'agent',     icon: React.createElement(Agents24Filled, { style: { color: 'hsl(var(--primary))' } }) },
  { label: 'Prompt',       type: 'ai-action', icon: PromptIcon },
  { label: 'Classify',     type: 'ai-action', icon: React.createElement(Tag24Filled, { style: { color: 'hsl(var(--primary))' } }) },
  { label: 'Guardrails',   type: 'ai-action', icon: React.createElement(Shield24Filled, { style: { color: 'hsl(var(--primary))' } }) },
  { label: 'Extract',      type: 'ai-action', icon: React.createElement(DocumentTextExtract24Filled, { style: { color: 'hsl(var(--primary))' } }) },
  { label: 'M365 Copilot', type: 'action',    icon: M365CopilotIcon },
  { label: 'MCP',           type: 'action',    icon: React.createElement('svg', { width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', style: { color: 'hsl(var(--primary))' } }, React.createElement('path', { d: 'M10.7198 2.4695C12.2553 0.934194 14.7449 0.934123 16.2804 2.4695C17.2057 3.39481 17.5718 4.66656 17.3819 5.8672C18.5827 5.67708 19.8549 6.04405 20.7804 6.9695C22.3158 8.50496 22.3157 10.9945 20.7804 12.53L13.4356 19.8748L14.7804 21.2195C15.0732 21.5123 15.073 21.9871 14.7804 22.28C14.4875 22.5729 14.0127 22.5729 13.7198 22.28L11.8448 20.405C11.552 20.1121 11.5519 19.6374 11.8448 19.3445L19.7198 11.4695C20.6693 10.5197 20.6695 8.97972 19.7198 8.03004C18.7701 7.08043 17.2301 7.08053 16.2804 8.03004L10.2804 14.03C9.98747 14.3229 9.51271 14.3229 9.21981 14.03C8.92713 13.7371 8.92699 13.2623 9.21981 12.9695L15.2198 6.9695C16.1693 6.01973 16.1695 4.47972 15.2198 3.53004C14.2701 2.58046 12.7301 2.58053 11.7804 3.53004L3.53035 11.78C3.23746 12.0729 2.7627 12.0729 2.46981 11.78C2.17712 11.4871 2.17699 11.0123 2.46981 10.7195L10.7198 2.4695Z', fill: 'currentColor' }), React.createElement('path', { d: 'M12.9713 4.7195C13.2642 4.42688 13.739 4.42677 14.0318 4.7195C14.3246 5.01234 14.3245 5.48716 14.0318 5.78004L8.40609 11.405C7.45628 12.3547 7.45581 13.8947 8.40535 14.8445C9.35504 15.7942 10.895 15.7941 11.8448 14.8445L17.8463 8.8445C18.1392 8.55188 18.614 8.55177 18.9068 8.8445C19.1996 9.13734 19.1995 9.61216 18.9068 9.90504L12.9054 15.9058C11.3698 17.441 8.8802 17.4404 7.34481 15.905C5.80944 14.3694 5.80985 11.8799 7.34554 10.3445L12.9713 4.7195Z', fill: 'currentColor' })) },
  { label: 'Human Review',  type: 'action',    icon: React.createElement(PersonAlert24Filled, { style: { color: 'hsl(var(--primary))' } }) },
  { label: 'Computer Use',  type: 'action',    icon: React.createElement('svg', { width: '24', height: '24', viewBox: '0 0 32 32', fill: 'none', style: { color: 'hsl(var(--primary))' } }, React.createElement('path', { d: 'M21.4512 8.54971C21.3548 8.42515 21.2504 8.3064 21.1387 8.19425C20.7224 7.77673 20.2143 7.46221 19.6548 7.27577L17.8178 6.67919C17.6762 6.62928 17.5535 6.53671 17.4668 6.41424C17.38 6.29177 17.3335 6.14544 17.3335 5.99541C17.3335 5.84539 17.38 5.69905 17.4668 5.57659C17.5535 5.45411 17.6762 5.36155 17.8178 5.31163L19.6548 4.71504C20.2064 4.52469 20.7067 4.2094 21.1162 3.79383C21.5144 3.38965 21.8166 2.90127 22.0002 2.36496L22.0154 2.31951L22.6124 0.483859C22.6624 0.342376 22.7551 0.21986 22.8776 0.133199C23.0002 0.046538 23.1466 0 23.2967 0C23.447 0 23.5934 0.046538 23.7159 0.133199C23.8384 0.21986 23.9311 0.342376 23.9811 0.483859L24.5782 2.31951C24.7638 2.87759 25.0771 3.38471 25.4932 3.80055C25.9095 4.2164 26.417 4.52953 26.9755 4.71504L28.8126 5.31163L28.8492 5.32081C28.9908 5.37072 29.1135 5.46329 29.2002 5.58576C29.287 5.70823 29.3335 5.85456 29.3335 6.00459C29.3335 6.15461 29.287 6.30095 29.2002 6.42341C29.1135 6.54589 28.9908 6.63845 28.8492 6.68837L27.0122 7.28496C26.4538 7.47047 25.9462 7.7836 25.53 8.19945C25.1139 8.61529 24.8006 9.12241 24.6148 9.68049L24.0178 11.5161C24.0124 11.5314 24.0066 11.5464 24.0002 11.5612C23.9475 11.6836 23.862 11.7895 23.7527 11.8668C23.63 11.9535 23.4836 12 23.3335 12C23.1834 12 23.037 11.9535 22.9143 11.8668C22.7918 11.7801 22.6991 11.6576 22.6492 11.5161L22.0522 9.68049C21.9172 9.27108 21.7136 8.88885 21.4512 8.54971Z', fill: 'currentColor' }), React.createElement('path', { d: 'M31.7107 13.6177L30.6902 13.2862C30.3799 13.1831 30.0979 13.0092 29.8667 12.7782C29.6355 12.5471 29.4614 12.2654 29.3583 11.9554L29.0266 10.9356C28.9988 10.857 28.9474 10.7889 28.8792 10.7407C28.8112 10.6926 28.7299 10.6667 28.6464 10.6667C28.563 10.6667 28.4816 10.6926 28.4135 10.7407C28.3455 10.7889 28.294 10.857 28.2663 10.9356L27.9346 11.9554C27.8335 12.2632 27.6624 12.5436 27.435 12.7744C27.2075 13.0053 26.9296 13.1805 26.6231 13.2862L25.6026 13.6177C25.5239 13.6454 25.4558 13.6967 25.4075 13.7649C25.3594 13.8329 25.3335 13.9142 25.3335 13.9975C25.3335 14.0809 25.3594 14.1622 25.4075 14.2302C25.4558 14.2982 25.5239 14.3497 25.6026 14.3774L26.6231 14.7089C26.9339 14.8125 27.2162 14.9871 27.4475 15.2191C27.6787 15.451 27.8526 15.7338 27.955 16.0447L28.2867 17.0646C28.3144 17.1431 28.3659 17.2113 28.434 17.2594C28.502 17.3075 28.5834 17.3334 28.6668 17.3334C28.7503 17.3334 28.8316 17.3075 28.8996 17.2594C28.9678 17.2113 29.0192 17.1431 29.047 17.0646L29.3787 16.0447C29.4819 15.7347 29.6559 15.453 29.8871 15.2219C30.1183 14.991 30.4003 14.817 30.7106 14.7139L31.7311 14.3825C31.8098 14.3547 31.8779 14.3034 31.9262 14.2353C31.9743 14.1673 32.0002 14.0859 32.0002 14.0026C32.0002 13.9193 31.9743 13.8379 31.9262 13.7699C31.8779 13.7019 31.8098 13.6505 31.7311 13.6227L31.7107 13.6177Z', fill: 'currentColor' }), React.createElement('path', { d: 'M26.6668 16.6165V18.3333C26.6668 19.9901 25.3236 21.3333 23.6668 21.3333H8.3335C6.67664 21.3333 5.3335 19.9901 5.3335 18.3333V8.33325C5.3335 6.6764 6.67664 5.33325 8.3335 5.33325H16.0982C16.0348 5.53137 16.0007 5.74159 16.0002 5.95863C16.0028 6.80529 16.5547 7.66149 17.3335 7.99863L19.2002 8.61196C19.8887 8.84551 20.5526 9.36663 20.7868 10.0653L21.3335 11.9986C21.6172 12.829 22.402 13.3959 23.2802 13.3986C23.5952 13.4025 23.9066 13.3292 24.1868 13.1853C24.0284 13.4514 23.9455 13.7557 23.9468 14.0653C23.941 14.7847 24.4295 15.4627 25.1068 15.7053C25.2047 15.7363 25.3155 15.7643 25.432 15.7938C25.9115 15.9153 26.4858 16.0607 26.6402 16.5319L26.6668 16.6165Z', fill: 'currentColor' }), React.createElement('path', { d: 'M3.6665 23.3333C3.11422 23.3333 2.6665 23.781 2.6665 24.3333C2.6665 24.8855 3.11422 25.3333 3.6665 25.3333H28.3332C28.8854 25.3333 29.3332 24.8855 29.3332 24.3333C29.3332 23.781 28.8854 23.3333 28.3332 23.3333H3.6665Z', fill: 'currentColor' })) },
  { divider: true },
  { label: 'Function',  type: 'action',    icon: React.createElement(Code24Filled, { style: { color: CONTROL_FLOW_COLOR } }) },
  { label: 'Variable',  type: 'action',    icon: React.createElement(BracesVariable24Filled, { style: { color: CONTROL_FLOW_COLOR } }) },
  { label: 'Branch',    type: 'condition', icon: React.createElement(ArrowSplit24Filled, { style: { color: CONTROL_FLOW_COLOR } }) },
  { label: 'Switch',    type: 'condition', icon: React.createElement(ArrowSwap24Filled, { style: { color: CONTROL_FLOW_COLOR } }) },
  { label: 'Loop',      type: 'action',    icon: React.createElement(ArrowRepeatAll24Filled, { style: { color: CONTROL_FLOW_COLOR } }) },
  { divider: true },
  { label: 'Connector', type: 'action',    icon: React.createElement(Apps24Filled, { style: { color: '#111827' } }), hasChevron: true },
  { divider: true },
  { label: 'Note',      type: 'note',      icon: React.createElement(Note24Filled, { style: { color: '#994A00' } }) },
];

export const ALL_STEPS = STEP_TYPES.filter((s): s is StepType => !('divider' in s));

export const isUnnamedStep = (node: WorkflowNode): boolean =>
  !node.placeholder &&
  node.type !== 'condition' &&
  ALL_STEPS.some(s => s.label === node.label && s.type === node.type);

export const getNodeErrors = (node: WorkflowNode): string[] => {
  if (node.placeholder || node.type === 'note') return [];

  const configKeys = node.config ? Object.keys(node.config) : [];
  if (configKeys.length === 0) return [];

  const errors: string[] = [];

  if (node.label === 'Agent' || node.type === 'agent') {
    if (!node.config?.instructions?.trim()) errors.push('"Instructions" are required');
  } else if (['Prompt', 'Classify', 'Extract', 'Guardrails'].includes(node.label)) {
    if (!node.config?.instructions?.trim() && !node.config?.task?.trim())
      errors.push('"Instructions" are required');
  } else if (node.label === 'MCP') {
    if (!node.config?.instructions?.trim()) errors.push('"Instructions" are required');
  } else if (node.label === 'Computer Use') {
    if (node.config?.cuaId) {
      // A saved CUA environment is selected — only instructions are required
      if (!node.config?.instructions?.trim()) errors.push('"Instructions" are required');
    } else {
      // New-form mode — validate all required fields
      if (!node.config?.instructions?.trim()) errors.push('"Instructions" are required');
      // machineType defaults to 'hosted-browser' in the UI; treat absent as 'hosted-browser' (valid)
      const machineType = node.config?.machineType ?? 'hosted-browser';
      if (machineType === 'byom' && !node.config?.connectionUrl?.trim())
        errors.push('"Connection URL" is required');
    }
  } else if (node.type === 'condition') {
    const conditions: Array<{ left?: string }> = node.config?.conditions ?? [];
    const hasValid = conditions.some(c => c.left?.trim());
    if (!hasValid) errors.push('At least one condition must have a value');
  } else if (node.type === 'action' && node.connector === 'Outlook') {
    if (!node.config?.to?.trim()) errors.push('"To" is required');
    if (!node.config?.subject?.trim()) errors.push('"Subject" is required');
    if (!node.config?.body?.trim()) errors.push('"Body" is required');
  }

  return errors;
};

// Step labels that have a saved/existing library the user could pick from instead of creating new.
export const STEPS_WITH_EXISTING = new Set(['Prompt', 'Classify', 'Agent', 'Connector', 'Computer Use']);

// Model options shown in the Model picker for prompt/ai-action steps
export const PROMPT_MODEL_OPTIONS = [
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6', icon: React.createElement(ClaudeSonnetIcon, { size: 16 }) },
  { label: 'Claude Sonnet 3.5', value: 'claude-3-5-sonnet', icon: React.createElement(ClaudeSonnetIcon, { size: 16 }) },
  { label: 'GPT-5.2 Auto', value: 'gpt-5.2-auto', icon: React.createElement(GPT52AutoIcon, { size: 16 }) },
];

// Maps each step label to its V2 palette sidebar category
export const V2_STEP_CAT: Record<string, 'ai' | 'tools' | 'utilities'> = {
  'Agent': 'ai', 'Prompt': 'ai', 'Classify': 'ai', 'Guardrails': 'ai', 'Extract': 'ai', 'M365 Copilot': 'ai', 'MCP': 'ai', 'Computer Use': 'ai',
  'Note': 'utilities',
};

// Built-in tool categories with sub-actions
export const V2_BUILTIN_TOOLS: Array<{ id: string; label: string; iconBg: string; iconLabel: string; icon?: React.ReactNode; actions: string[] }> = [
  { id: 'control',          label: 'Control',          iconBg: CONTROL_FLOW_COLOR, iconLabel: 'Ct',  icon: React.createElement(ArrowSplit24Filled,    { style: { color: 'white', width: 18, height: 18 } }), actions: ['Apply to each', 'Condition', 'Do until', 'Scope', 'Switch', 'Terminate'] },
  { id: 'data-operation',   label: 'Data Operation',   iconBg: '#7c3aed', iconLabel: '{/}', icon: React.createElement(DataPie24Filled,       { style: { color: 'white', width: 18, height: 18 } }), actions: ['Compose', 'Create CSV table', 'Create HTML table', 'Filter array', 'Join', 'Parse JSON', 'Select'] },
  { id: 'date-time',        label: 'Date Time',        iconBg: '#2563eb', iconLabel: 'DT',  icon: React.createElement(Clock24Filled,         { style: { color: 'white', width: 18, height: 18 } }), actions: ['Add to time', 'Convert time zone', 'Current time', 'Get future time', 'Get past time', 'Subtract from time'] },
  { id: 'flows',            label: 'Flows',            iconBg: '#2563eb', iconLabel: 'Fl',  icon: React.createElement(RowChild24Filled,       { style: { color: 'white', width: 18, height: 18 } }), actions: ['Run a Child Flow'] },
  { id: 'http',             label: 'HTTP',             iconBg: '#0d9488', iconLabel: 'HT',  icon: React.createElement(Globe24Filled,         { style: { color: 'white', width: 18, height: 18 } }), actions: ['HTTP', 'HTTP + Swagger', 'HTTP Webhook'] },
  { id: 'number-functions', label: 'Number Functions', iconBg: '#7c3aed', iconLabel: '123', icon: React.createElement(Calculator24Filled,    { style: { color: 'white', width: 18, height: 18 } }), actions: ['Format number'] },
  { id: 'request',          label: 'Request',          iconBg: '#0d9488', iconLabel: 'Rq',  icon: React.createElement(Send24Filled,          { style: { color: 'white', width: 18, height: 18 } }), actions: ['Response'] },
  { id: 'schedule',         label: 'Schedule',         iconBg: '#2563eb', iconLabel: 'Sc',  icon: React.createElement(CalendarClock24Filled, { style: { color: 'white', width: 18, height: 18 } }), actions: ['Delay', 'Delay Until'] },
  { id: 'text-functions',   label: 'Text Functions',   iconBg: '#7c3aed', iconLabel: 'Ab',  icon: React.createElement(DrawText24Filled,      { style: { color: 'white', width: 18, height: 18 } }), actions: ['Find text position', 'Substring'] },
  { id: 'variable',         label: 'Variable',         iconBg: '#7c3aed', iconLabel: '{x}', icon: React.createElement(BracesVariable24Filled,{ style: { color: 'white', width: 18, height: 18 } }), actions: ['Append to array variable', 'Append to string variable', 'Decrement variable', 'Increment variable', 'Initialize variable', 'Set variable'] },
];

// Steps that need a "select existing or create new" dialog before being added
export const NEEDS_CONFIG_DIALOG = (label: string) => ['Computer Use', 'Agent', 'Prompt', 'Classify', 'Guardrails', 'Extract', 'MCP', 'Human Review'].includes(label);

export const HUMAN_REVIEW_OPTIONS: { id: string; name: string; description: string; icon: React.ReactElement }[] = [
  { id: 'request-for-info',         name: 'Request for information',               description: 'Pause the workflow and ask a person to provide additional information.',         icon: React.createElement(PersonFeedback24Filled,       { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
  { id: 'multistage-approval',      name: 'Run a multistage approval (preview)',    description: 'Route an approval through multiple sequential stages and approvers.',           icon: React.createElement(ApprovalsApp24Filled,        { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
  { id: 'create-approval',          name: 'Create an approval',                    description: 'Create an approval request and send it to the specified approvers.',            icon: React.createElement(ClipboardCheckmark24Filled,   { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
  { id: 'start-wait-approval',      name: 'Start and wait for an approval',        description: 'Send an approval request and pause the workflow until a response is received.', icon: React.createElement(ClipboardArrowRight24Filled,  { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
  { id: 'start-wait-approval-text', name: 'Start and wait for an approval of text', description: 'Request approval on a block of text and wait for the approver to respond.',   icon: React.createElement(DocumentTextClock24Filled,    { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
  { id: 'wait-for-approval',        name: 'Wait for an approval',                  description: 'Pause the workflow at this step until an existing approval is completed.',      icon: React.createElement(ClipboardClock24Filled,       { style: { color: 'hsl(var(--primary))', width: 22, height: 22 } }) },
];

// ─── Power Fx functions ─────────────────────────────────────────────────────

export const POWER_FX_FUNCTIONS: { category: string; fns: string[] }[] = [
  { category: 'Logic',      fns: ['If(condition, trueResult, falseResult)', 'Switch(value, match1, result1)', 'And(condition1, condition2)', 'Or(condition1, condition2)', 'Not(condition)'] },
  { category: 'Text',       fns: ['Concatenate(text1, text2)', 'Left(text, count)', 'Right(text, count)', 'Mid(text, start, count)', 'Len(text)', 'Upper(text)', 'Lower(text)', 'Trim(text)', 'Text(value, format)'] },
  { category: 'Math',       fns: ['Sum(value1, value2)', 'Round(number, decimals)', 'Abs(number)', 'Mod(number, divisor)', 'Value(text)'] },
  { category: 'Date & Time',fns: ['Now()', 'Today()', 'DateDiff(startDate, endDate, units)', 'DateAdd(date, count, units)', 'DateTimeValue(text)'] },
  { category: 'Table',      fns: ['Filter(table, condition)', 'Sort(table, column)', 'First(table)', 'Last(table)', 'Count(table)', 'LookUp(table, condition)'] },
  { category: 'Utility',    fns: ['IsBlank(value)', 'Coalesce(value1, value2)', 'Error(message)'] },
];

// ─── Instruction segment types ──────────────────────────────────────────────

export type InstrSegment =
  | { type: 'text'; value: string }
  | { type: 'pill'; nodeLabel: string; output: string; nodeConnector?: string }
  | { type: 'power-fx-pill'; expression: string; label: string };

// ─── Connector registry ─────────────────────────────────────────────────────

// The full CONNECTORS array is extracted to a separate file to keep this module readable.
// Re-exported for consumers.
export { CONNECTORS };

// ─── Context-aware V2 step suggestions ──────────────────────────────────────

export type V2Suggestion = { label: string; type: 'action' | 'agent' | 'ai-action' | 'condition' | 'trigger'; connector?: string; subtitle: string; };

export function getV2Suggestions(prevNode: { type: string; label: string; connector?: string } | null): V2Suggestion[] {
  if (!prevNode || prevNode.type === 'trigger') {
    return [
      { label: 'Agent',            type: 'agent',    subtitle: 'AI \u2014 Process trigger data' },
      { label: 'Condition',        type: 'condition', subtitle: 'Control \u2014 Branch on trigger data' },
      { label: 'Initialize variable', type: 'action', subtitle: 'Variable \u2014 Set up tracking' },
      { label: 'Compose',          type: 'action',    subtitle: 'Data Operation \u2014 Build a value' },
      { label: 'HTTP',             type: 'action',    subtitle: 'HTTP \u2014 Call an external API' },
    ];
  }
  const lbl = prevNode.label.toLowerCase();
  const conn = (prevNode.connector ?? prevNode.label).toLowerCase();
  if (conn.includes('excel') || lbl.includes('excel') || lbl.includes('get rows') || lbl.includes('list rows')) {
    return [
      { label: 'Apply to each',   type: 'action', subtitle: 'Control \u2014 Loop through rows' },
      { label: 'Filter array',    type: 'action', subtitle: 'Data Operation \u2014 Filter rows' },
      { label: 'Agent',           type: 'agent',  subtitle: 'AI \u2014 Summarize with AI' },
      { label: 'Microsoft Teams', type: 'action', connector: 'Microsoft Teams', subtitle: 'Send results to Teams' },
      { label: 'Office 365 Outlook', type: 'action', connector: 'Office 365 Outlook', subtitle: 'Email the results' },
    ];
  }
  if (conn.includes('sharepoint') || lbl.includes('sharepoint')) {
    return [
      { label: 'Apply to each',      type: 'action',    subtitle: 'Control \u2014 Loop through items' },
      { label: 'Condition',          type: 'condition', subtitle: 'Control \u2014 Filter by property' },
      { label: 'Agent',              type: 'agent',     subtitle: 'AI \u2014 Process content' },
      { label: 'Office 365 Outlook', type: 'action', connector: 'Office 365 Outlook', subtitle: 'Send notification' },
    ];
  }
  if (prevNode.type === 'agent' || prevNode.type === 'ai-action') {
    return [
      { label: 'Condition',          type: 'condition', subtitle: 'Control \u2014 Branch on AI result' },
      { label: 'Office 365 Outlook', type: 'action', connector: 'Office 365 Outlook', subtitle: 'Email the result' },
      { label: 'Microsoft Teams',    type: 'action', connector: 'Microsoft Teams', subtitle: 'Post to Teams' },
      { label: 'Compose',            type: 'action', subtitle: 'Data Operation \u2014 Format output' },
    ];
  }
  if (conn.includes('outlook') || conn.includes('gmail') || lbl.includes('send email') || lbl.includes('email')) {
    return [
      { label: 'Condition',   type: 'condition', subtitle: 'Control \u2014 Check if sent successfully' },
      { label: 'Increment variable', type: 'action', subtitle: 'Variable \u2014 Track send count' },
      { label: 'Terminate',   type: 'action', subtitle: 'Control \u2014 End the flow' },
    ];
  }
  if (conn.includes('teams') || lbl.includes('teams')) {
    return [
      { label: 'Condition',   type: 'condition', subtitle: 'Control \u2014 Check response' },
      { label: 'Compose',     type: 'action',    subtitle: 'Data Operation \u2014 Build follow-up' },
      { label: 'Terminate',   type: 'action',    subtitle: 'Control \u2014 End the flow' },
    ];
  }
  if (lbl === 'http' || lbl.includes('http')) {
    return [
      { label: 'Condition',   type: 'condition', subtitle: 'Control \u2014 Check status code' },
      { label: 'Parse JSON',  type: 'action',    subtitle: 'Data Operation \u2014 Parse the response' },
      { label: 'Compose',     type: 'action',    subtitle: 'Data Operation \u2014 Extract a field' },
      { label: 'Agent',       type: 'agent',     subtitle: 'AI \u2014 Interpret the result' },
    ];
  }
  if (prevNode.type === 'condition' || lbl.includes('condition') || lbl.includes('switch')) {
    return [
      { label: 'Office 365 Outlook', type: 'action', connector: 'Office 365 Outlook', subtitle: 'Send email for this branch' },
      { label: 'Microsoft Teams',    type: 'action', connector: 'Microsoft Teams', subtitle: 'Notify in Teams' },
      { label: 'Terminate',          type: 'action', subtitle: 'Control \u2014 End this branch' },
      { label: 'Compose',            type: 'action', subtitle: 'Data Operation \u2014 Build a message' },
    ];
  }
  if (lbl.includes('apply to each') || lbl.includes('loop') || lbl.includes('do until')) {
    return [
      { label: 'Compose',                  type: 'action', subtitle: 'Data Operation \u2014 Aggregate results' },
      { label: 'Append to string variable',type: 'action', subtitle: 'Variable \u2014 Build summary' },
      { label: 'Office 365 Outlook',       type: 'action', connector: 'Office 365 Outlook', subtitle: 'Send summary email' },
    ];
  }
  if (lbl.includes('variable') || lbl.includes('compose') || lbl.includes('parse json')) {
    return [
      { label: 'Condition',   type: 'condition', subtitle: 'Control \u2014 Branch on the value' },
      { label: 'Apply to each', type: 'action',  subtitle: 'Control \u2014 Loop through array' },
      { label: 'Agent',       type: 'agent',     subtitle: 'AI \u2014 Process the data' },
    ];
  }
  return [
    { label: 'Agent',            type: 'agent',    subtitle: 'AI \u2014 Process with an agent' },
    { label: 'Condition',        type: 'condition', subtitle: 'Control \u2014 Branch on result' },
    { label: 'Microsoft Teams',  type: 'action', connector: 'Microsoft Teams', subtitle: 'Send a notification' },
    { label: 'Office 365 Outlook', type: 'action', connector: 'Office 365 Outlook', subtitle: 'Send an email' },
    { label: 'Apply to each',    type: 'action', subtitle: 'Control \u2014 Loop through items' },
  ];
}

// ─── Microsoft connector helpers ────────────────────────────────────────────

const MS_PREFIXES = [
  'Microsoft ', 'Office 365', 'OneDrive', 'OneNote', 'SharePoint', 'Outlook',
  'Azure ', 'Dynamics ', 'Bing ', 'MSN ', 'Viva ', 'Windows ',
  'Power BI', 'Power Apps', 'Power Automate', 'Power Platform', 'Power Query', 'Power Textor', 'Power Virtual',
  'Excel Online', 'Word Online', 'Copilot for ', 'Updates App (Microsoft',
];
const MS_EXACT = new Set(['Excel', 'Planner', 'MSN Weather', 'Shifts for Microsoft Teams']);
export const isMicrosoftConnector = (name: string): boolean =>
  MS_EXACT.has(name) || MS_PREFIXES.some(p => name.startsWith(p));

export type MsGroup = { id: string; label: string; prefixes: string[]; exact: string[] };
export const MS_GROUPS: MsGroup[] = [
  {
    id: 'office365', label: 'Microsoft 365',
    prefixes: ['Office 365', 'OneDrive', 'OneNote', 'SharePoint', 'Outlook', 'Excel Online', 'Word Online', 'Viva ', 'Updates App (Microsoft', 'Microsoft Teams', 'Microsoft Forms', 'Microsoft Bookings', 'Microsoft Loop', 'Microsoft To-Do', 'M365 Search', 'Microsoft 365'],
    exact: ['Excel', 'Planner', 'Shifts for Microsoft Teams'],
  },
  { id: 'azure',    label: 'Azure',               prefixes: ['Azure '],                                                                                                                                      exact: [] },
  { id: 'dynamics', label: 'Dynamics 365',         prefixes: ['Dynamics '],                                                                                                                                   exact: [] },
  { id: 'power',    label: 'Power Platform',       prefixes: ['Power BI', 'Power Apps', 'Power Automate', 'Power Platform', 'Power Query', 'Power Textor', 'Power Virtual'],                                   exact: [] },
  {
    id: 'ms-dev', label: 'Developer & Security',
    prefixes: ['Microsoft Graph', 'Microsoft Entra', 'Microsoft Defender', 'Microsoft Sentinel', 'Microsoft Security', 'Bing ', 'MSN ', 'Copilot for ', 'Windows '],
    exact: ['MSN Weather', 'MS Graph Groups and Users'],
  },
];
export const connInMsGroup = (name: string, group: MsGroup): boolean =>
  group.exact.includes(name) || group.prefixes.some(p => name.startsWith(p));
export const getMsGroupConnectors = (groupId: string): string[] => {
  const msAll = CONNECTORS.filter(isMicrosoftConnector);
  const raw = groupId === 'ms-other'
    ? msAll.filter(n => !MS_GROUPS.some(g => connInMsGroup(n, g)))
    : (() => { const group = MS_GROUPS.find(g => g.id === groupId); return group ? msAll.filter(n => connInMsGroup(n, group)) : []; })();
  return raw.slice().sort((a, b) => a.localeCompare(b));
};
const MS_GROUP_STRIP: Record<string, string[]> = {
  office365:  ['Office 365 ', 'Microsoft 365 ', 'Microsoft '],
  azure:      ['Azure '],
  dynamics:   ['Dynamics 365 ', 'Dynamics '],
  power:      ['Power '],
  'ms-dev':   ['Microsoft Graph ', 'Microsoft Entra ', 'Microsoft Defender ', 'Microsoft Sentinel ', 'Microsoft Security ', 'Microsoft '],
  'ms-other': ['Microsoft '],
};
export const shortenForGroup = (name: string, groupId: string): string => {
  for (const prefix of (MS_GROUP_STRIP[groupId] ?? [])) {
    if (name.startsWith(prefix)) return name.slice(prefix.length);
  }
  return name;
};

// Icons for each Microsoft sub-group
export const MS_GROUP_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  office365:  { bg: '#f3f4f6', icon: React.createElement('img', { src: '/copilot-color-icon.svg', alt: '', style: { width: 22, height: 22 } }) },
  azure:      { bg: '#f0f4ff', icon: React.createElement('img', { src: '/component-icons/Azure24.svg', alt: '', style: { width: 22, height: 22 } }) },
  dynamics:   { bg: '#f0f4ff', icon: React.createElement('img', { src: '/component-icons/Dynamics36524.svg',   alt: '', style: { width: 22, height: 22 } }) },
  power:      { bg: '#f5f0ff', icon: React.createElement('img', { src: '/component-icons/PowerPlatform24.png',  alt: '', style: { width: 22, height: 22 } }) },
  'ms-dev':   { bg: '#e8eef6', icon: React.createElement(Shield24Filled, { style: { width: 20, height: 20, color: '#3b82f6' } }) },
  'ms-other': { bg: '#f3f4f6', icon: React.createElement('img', { src: '/component-icons/MicrosoftLogo.svg', alt: '', style: { width: 20, height: 20 } }) },
};

// ─── V2 preview action type ─────────────────────────────────────────────────

export type V2PreviewAction = {
  label: string;
  type: WorkflowNode['type'];
  connector?: string;
  parentLabel?: string;
  iconNode: React.ReactNode;
};

// ─── Preview descriptions/visuals ───────────────────────────────────────────

export const PREVIEW_DESCRIPTIONS: Record<string, { description: string; inputs: string[]; outputs: string[] }> = {
  'Condition':             { description: 'Evaluates a boolean expression and routes the workflow to a true or false branch based on the result.',   inputs: ['Left value', 'Operator', 'Right value'],                         outputs: ['True branch', 'False branch'] },
  'Apply to each':         { description: 'Iterates over every item in an array and runs the enclosed actions for each one.',                          inputs: ['Array to iterate'],                                               outputs: ['Current item'] },
  'Do until':              { description: 'Repeats the enclosed actions until a condition becomes true or a loop limit is reached.',                    inputs: ['Condition', 'Count', 'Timeout'],                                  outputs: [] },
  'Scope':                 { description: 'Groups a set of actions so you can apply error handling or run-after logic to the group as a whole.',        inputs: ['Enclosed actions'],                                               outputs: ['Scope result'] },
  'Switch':                { description: 'Evaluates a value against multiple cases and routes execution to the matching branch.',                       inputs: ['Switch-on value'],                                                outputs: ['Matched case'] },
  'Terminate':             { description: 'Immediately ends the workflow run and sets the final status to Succeeded, Failed, or Cancelled.',             inputs: ['Status', 'Code', 'Message'],                                      outputs: [] },
  'Delay':                 { description: 'Pauses the workflow for a specified duration before continuing to the next step.',                            inputs: ['Count', 'Unit'],                                                  outputs: [] },
  'Delay Until':           { description: 'Pauses the workflow until a specific date and time before continuing.',                                       inputs: ['Timestamp'],                                                      outputs: [] },
  'Compose':               { description: 'Constructs any output \u2014 string, number, object, or array \u2014 from an expression or input values.',             inputs: ['Inputs'],                                                         outputs: ['Output'] },
  'Filter array':          { description: 'Returns a subset of an array containing only the items where the condition is true.',                         inputs: ['Array', 'Condition'],                                             outputs: ['Filtered array'] },
  'Parse JSON':            { description: 'Parses a JSON string and exposes each property as a dynamic token for downstream steps.',                     inputs: ['Content', 'Schema'],                                              outputs: ['Parsed properties'] },
  'Initialize variable':   { description: 'Declares a new workflow variable and sets its name, type, and initial value.',                               inputs: ['Name', 'Type', 'Value'],                                          outputs: ['Variable'] },
  'Set variable':          { description: 'Updates the value of a previously initialized variable.',                                                    inputs: ['Name', 'Value'],                                                  outputs: [] },
  'Append to array variable': { description: 'Adds a new item to the end of an array variable.',                                                       inputs: ['Name', 'Value'],                                                  outputs: [] },
  'HTTP':                  { description: 'Sends an HTTP request to any web endpoint and returns the response status, headers, and body.',              inputs: ['Method', 'URI', 'Headers', 'Body'],                               outputs: ['Status code', 'Headers', 'Body'] },
  'HTTP Webhook':          { description: 'Subscribes to a webhook endpoint and triggers the workflow when the callback URL is called.',                inputs: ['Subscribe URL', 'Unsubscribe URL'],                               outputs: ['Body'] },
  'Response':              { description: 'Sends an HTTP response back to the caller when the workflow is triggered by a Request trigger.',             inputs: ['Status code', 'Headers', 'Body'],                                 outputs: [] },
  'Agent':                 { description: 'Runs an AI agent to reason over a task, call tools, and produce a structured result.',                       inputs: ['Agent configuration', 'Input data'],                              outputs: ['Agent output'] },
  'Prompt':                { description: 'Sends a prompt to a language model and returns the generated text or structured response.',                  inputs: ['Model', 'System prompt', 'User message'],                         outputs: ['Completion', 'Usage'] },
  'Classify':              { description: 'Uses an AI model to classify an input into one of the defined categories.',                                  inputs: ['Input text', 'Categories'],                                       outputs: ['Category', 'Confidence'] },
  'MCP':                   { description: 'Calls a tool exposed by a Model Context Protocol server.',                                                   inputs: ['Server', 'Tool', 'Arguments'],                                    outputs: ['Tool result'] },
  'Computer Use':          { description: 'Instructs an AI model to interact with a desktop or browser UI to complete a task.',                         inputs: ['Task description', 'Target environment'],                         outputs: ['Result', 'Screenshots'] },
};

export function getV2PreviewContent(label: string): { description: string; inputs: string[]; outputs: string[] } {
  if (PREVIEW_DESCRIPTIONS[label]) return PREVIEW_DESCRIPTIONS[label];
  return {
    description: `Integrate and automate tasks using ${label}.`,
    inputs: ['Authentication', 'Action parameters'],
    outputs: ['Response data'],
  };
}

// ─── Connector utilities ────────────────────────────────────────────────────

export const connectorColor = (name: string): string => {
  const PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#3b82f6','#06b6d4','#84cc16'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
};

export const CONNECTOR_ICON_SRCS: Array<{ test: (n: string) => boolean; src: string }> = [
  { test: n => /teams/i.test(n), src: '/component-icons/Teams24.svg' },
  { test: n => /outlook/i.test(n), src: '/component-icons/Outlook24.svg' },
  { test: n => /sharepoint/i.test(n), src: '/component-icons/SharePoint24.svg' },
  { test: n => /onedrive/i.test(n), src: '/component-icons/OneDrive24.svg' },
  { test: n => /excel/i.test(n), src: '/component-icons/Excel24.svg' },
  { test: n => /\bword\b/i.test(n), src: '/component-icons/Word24.svg' },
  { test: n => /forms/i.test(n), src: '/component-icons/Forms24.svg' },
  { test: n => /planner/i.test(n), src: '/component-icons/Planner24.svg' },
  { test: n => /power\s*bi/i.test(n), src: '/component-icons/PowerBI24.svg' },
  { test: n => /dataverse/i.test(n), src: '/component-icons/Dataverse24.svg' },
  { test: n => /slack/i.test(n), src: '/component-icons/Slack24.svg' },
  { test: n => /whatsapp/i.test(n), src: '/component-icons/Whatsapp24.svg' },
  { test: n => /microsoft\s*365|m365|office\s*365/i.test(n), src: '/component-icons/Microsoft36524.svg' },
  { test: n => /to-do|todo/i.test(n), src: '/component-icons/ToDo24.svg' },
  { test: n => /onenote/i.test(n), src: '/component-icons/OneNote24.svg' },
];
export const getConnectorIconSrc = (name: string): string | null => {
  for (const entry of CONNECTOR_ICON_SRCS) {
    if (entry.test(name)) return entry.src;
  }
  return null;
};

// ─── Per-connector action lists ─────────────────────────────────────────────

export const V2_CONNECTOR_ACTIONS: Record<string, string[]> = {
  'Microsoft Teams': [
    'Post message in a chat or channel', 'Create a Teams meeting', 'Add a member to a team', 'Create a chat',
    'Create a team', 'Create a channel', 'Get messages', 'Get message details', 'List members', 'List channels',
    'List all channels', 'List chats', 'List joined teams', 'List associated teams',
    'List replies of a channel message', 'List all tags for a team', 'List the members of a team tag',
    'Post card in a chat or channel', 'Post adaptive card and wait for a response',
    'Post a choice of options as the Flow bot to a channel', 'Reply with a message in a chat or channel',
    'Reply with an adaptive card in a chat or channel', 'Respond in Teams task module',
    'Update an adaptive card in a chat or channel', 'Send a Microsoft Graph HTTP request',
    'Get a team', 'Get details for a specific channel', 'Get an @mention token for a channel',
    'Get an @mention token for a user', 'Add a member to a team tag', 'Create a tag for a team',
    'Delete a team tag', 'Delete a member from a team tag', 'Post a feed notification',
  ],
  'Office 365 Outlook': [
    'Send an email (V2)', 'Send an email with options', 'Create event (V4)', 'Get emails (V3)', 'Get email (V2)',
    'Move email', 'Delete email', 'Reply to email (V3)', 'Forward an email (V2)',
    'Get calendar view of events (V3)', 'Get events (V4)', 'Get event (V3)', 'Update event (V4)',
    'Delete event (V3)', 'Get calendars (V2)', 'Get contact (V2)', 'Get contacts (V2)',
    'Create contact (V2)', 'Update contact (V2)', 'Delete contact (V2)', 'Get attachment (V2)',
    'Export email (V2)', 'Set up automatic replies (V2)', 'Flag email (V2)',
  ],
  'SharePoint': [
    'Create item', 'Get items', 'Get item', 'Update item', 'Delete item', 'Get files (properties only)',
    'Create file', 'Get file content', 'Get file metadata', 'Update file properties', 'Delete file',
    'Copy file', 'Move or rename a file', 'Get folder metadata', 'Create new folder', 'List folder',
    'Send an HTTP request to SharePoint', 'Get list views', 'Get lists', 'Get columns', 'Add attachment',
    'Get attachments', 'Get attachment content', 'Check in file', 'Check out file', 'Discard check out',
    'Grant access to an item or a folder', 'Stop sharing an item or a file',
  ],
  'OneDrive for Business': [
    'Create file', 'Get file content', 'Get file content using path', 'Get file metadata',
    'Get file metadata using path', 'Update file', 'Delete file', 'Copy file',
    'Move or rename a file or folder', 'Create share link', 'List files in folder',
    'List files in root folder', 'Create new folder', 'Extract archive to folder',
    'Convert file (preview)', 'Find files in folder',
  ],
  'Excel Online (Business)': [
    'Delete a row', 'Get a comment present in a worksheet', 'Get a row', 'Get worksheets',
    'List all comments present in a worksheet', 'List rows present in a table',
    'Reply to a comment present in a worksheet', 'Run script', 'Run script from SharePoint library',
    'Update a row', 'Add a key column to a table', 'Add a row into a table', 'Create table',
    'Create worksheet', 'Get tables',
  ],
  'Excel': [
    'Add a key column to a table', 'Add a row into a table', 'Create table', 'Create worksheet',
    'Delete a row', 'Get a comment present in a worksheet', 'Get a row', 'Get tables', 'Get worksheets',
    'List all comments present in a worksheet', 'List rows present in a table',
    'Reply to a comment present in a worksheet', 'Run script', 'Run script from SharePoint library',
    'Update a row',
  ],
  'Planner': [
    'Create a task', 'Add assignees to a task', 'Create a bucket', 'Delete a task',
    'Get a task', 'Get plan details', 'Get task details', 'List buckets',
    'List my tasks', 'List plans for a group', 'List tasks', 'Remove assignees from a task',
    'Update a task', 'Update task details',
  ],
  'Microsoft Forms': [
    'Get response details', 'List responses', 'Get form metadata', 'Apply a sensitivity label',
  ],
  'Microsoft To-Do (Business)': [
    'Add a to-do', 'Create a to-do list', 'Delete a to-do list', 'Get a to-do',
    'Get a to-do list', 'Update a to-do list', 'Update to-do', 'Delete to-do',
    'List all to-do lists', "List to-do's by folder",
  ],
  // Merged display keys — combined action lists for variant connectors
  'OneDrive': [
    'Create file', 'Get file content', 'Get file content using path', 'Get file metadata',
    'Get file metadata using path', 'Update file', 'Delete file', 'Copy file',
    'Move or rename a file or folder', 'Create share link', 'List files in folder',
    'List files in root folder', 'Create new folder', 'Extract archive to folder',
    'Convert file (preview)', 'Find files in folder',
  ],
  'Microsoft To-Do': [
    'Add a to-do', 'Create a to-do list', 'Delete a to-do list', 'Get a to-do',
    'Get a to-do list', 'Update a to-do list', 'Update to-do', 'Delete to-do',
    'List all to-do lists', "List to-do's by folder",
  ],
  'OneNote': [],
  'Outlook': [
    'Send an email (V2)', 'Send an email with options', 'Create event (V4)', 'Get emails (V3)', 'Get email (V2)',
    'Move email', 'Delete email', 'Reply to email (V3)', 'Forward an email (V2)',
    'Get calendar view of events (V3)', 'Get events (V4)', 'Get event (V3)', 'Update event (V4)',
    'Delete event (V3)', 'Get calendars (V2)', 'Get contact (V2)', 'Get contacts (V2)',
    'Create contact (V2)', 'Update contact (V2)', 'Delete contact (V2)', 'Get attachment (V2)',
    'Export email (V2)', 'Set up automatic replies (V2)', 'Flag email (V2)',
  ],
};

export const V2_ACTION_SUBTEXTS: Record<string, Record<string, string>> = {
  'Excel': {
    'Get a comment present in a worksheet':      'Business',
    'List all comments present in a worksheet':  'Business',
    'Reply to a comment present in a worksheet': 'Business',
    'Run script':                                'Business',
    'Run script from SharePoint library':        'Business',
  },
  'OneDrive': {
    'Create file':                        'Business',
    'Get file content':                   'Business',
    'Get file content using path':        'Business',
    'Get file metadata':                  'Business',
    'Get file metadata using path':       'Business',
    'Update file':                        'Business',
    'Delete file':                        'Business',
    'Copy file':                          'Business',
    'Move or rename a file or folder':    'Business',
    'Create share link':                  'Business',
    'List files in folder':               'Business',
    'List files in root folder':          'Business',
    'Create new folder':                  'Business',
    'Extract archive to folder':          'Business',
    'Convert file (preview)':             'Business',
    'Find files in folder':               'Business',
  },
  'Microsoft To-Do': {
    'Add a to-do':          'Business',
    'Create a to-do list':  'Business',
    'Delete a to-do list':  'Business',
    'Get a to-do':          'Business',
    'Get a to-do list':     'Business',
    'Update a to-do list':  'Business',
    'Update to-do':         'Business',
    'Delete to-do':         'Business',
    'List all to-do lists':     'Business',
    "List to-do's by folder":   'Business',
  },
  'Outlook': {
    'Send an email (V2)':             'Office 365',
    'Send an email with options':     'Office 365',
    'Create event (V4)':              'Office 365',
    'Get emails (V3)':                'Office 365',
    'Get email (V2)':                 'Office 365',
    'Move email':                     'Office 365',
    'Delete email':                   'Office 365',
    'Reply to email (V3)':            'Office 365',
    'Forward an email (V2)':          'Office 365',
    'Get calendar view of events (V3)': 'Office 365',
    'Get events (V4)':                'Office 365',
    'Get event (V3)':                 'Office 365',
    'Update event (V4)':              'Office 365',
    'Delete event (V3)':              'Office 365',
    'Get calendars (V2)':             'Office 365',
    'Get contact (V2)':               'Office 365',
    'Get contacts (V2)':              'Office 365',
    'Create contact (V2)':            'Office 365',
    'Update contact (V2)':            'Office 365',
    'Delete contact (V2)':            'Office 365',
    'Get attachment (V2)':            'Office 365',
    'Export email (V2)':              'Office 365',
    'Set up automatic replies (V2)':  'Office 365',
    'Flag email (V2)':                'Office 365',
  },
};

export const V2_CONNECTOR_DISPLAY_MERGE: Record<string, string[]> = {
  'Excel':          ['Excel', 'Excel Online (Business)', 'Excel Online (OneDrive)'],
  'OneDrive':       ['OneDrive', 'OneDrive for Business'],
  'Microsoft To-Do': ['Microsoft To-Do (Business)', 'Microsoft To-Do (Consumer)'],
  'OneNote':        ['OneNote (Business)', 'OneNote Consumer'],
  'Outlook':        ['Office 365 Outlook', 'Outlook Tasks', 'Outlook.com'],
};
export const V2_MERGED_CONNECTOR_NAMES = new Set(Object.values(V2_CONNECTOR_DISPLAY_MERGE).flat());

// V1 connector trigger events
export const V1_CONNECTOR_TRIGGER_EVENTS: Record<string, string[]> = {
  'Microsoft Teams': [
    'When a new channel message is added', 'For a selected message (V2)', 'From the compose box (V2)',
    'When I am mentioned in a channel message', 'When someone responds to an adaptive card',
    "When I'm @mentioned", 'When a new chat message is added', 'When a new message is added to a conversation',
    'When a new team member is added', 'When a new team member is removed',
    'When keywords are mentioned', 'When someone reacted to a message',
  ],
};

export const CONNECTOR_ACTIONS = [
  { label: 'Trigger: When a new item is added', type: 'trigger' as const },
  { label: 'Get items',    type: 'action' as const },
  { label: 'Create item',  type: 'action' as const },
  { label: 'Update item',  type: 'action' as const },
  { label: 'Delete item',  type: 'action' as const },
];

export const M365_COPILOT_ACTIONS = [
  { label: 'Draft an email',              type: 'action' as const },
  { label: 'Summarize a meeting',         type: 'action' as const },
  { label: 'Create a document',           type: 'action' as const },
  { label: 'Search for information',      type: 'action' as const },
  { label: 'Translate content',           type: 'action' as const },
  { label: 'Rewrite text',                type: 'action' as const },
  { label: 'Generate meeting agenda',     type: 'action' as const },
  { label: 'Summarize a document',        type: 'action' as const },
];

// ─── Mock MCP servers ───────────────────────────────────────────────────────

export const MOCK_MCPS = [
  { id: 'outlook',    name: 'Outlook MCP',      description: 'Read and send emails, manage calendar events and contacts', url: 'mcp.outlook.contoso.com:3000',    docsUrl: 'https://learn.microsoft.com/en-us/outlook/', tools: [
    { id: 'read_email',            description: 'Retrieve emails from inbox and folders' },
    { id: 'send_email',            description: 'Compose and send email messages' },
    { id: 'list_calendar_events',  description: 'List upcoming calendar events' },
    { id: 'create_event',          description: 'Create new calendar events' },
    { id: 'list_contacts',         description: 'Retrieve contact information' },
  ]},
  { id: 'github',     name: 'GitHub MCP',       description: 'Access repos, issues, PRs, and code search',               url: 'mcp.github.contoso.com:3000',     docsUrl: 'https://docs.github.com/en/rest', tools: [
    { id: 'list_repos',            description: 'List repositories for a user or org' },
    { id: 'create_issue',          description: 'Open a new issue on a repository' },
    { id: 'list_pull_requests',    description: 'List open pull requests' },
    { id: 'search_code',           description: 'Search across code in repositories' },
    { id: 'merge_pr',              description: 'Merge a pull request' },
    { id: 'create_branch',         description: 'Create a new branch' },
  ]},
  { id: 'dataverse',  name: 'Dataverse MCP',    description: 'Query and manage Microsoft Dataverse tables and records',   url: 'mcp.dataverse.contoso.com:3000',  docsUrl: 'https://learn.microsoft.com/en-us/power-apps/developer/data-platform/', tools: [
    { id: 'list_tables',           description: 'List available Dataverse tables' },
    { id: 'query_records',         description: 'Query records from a table' },
    { id: 'create_record',         description: 'Create a new record' },
    { id: 'update_record',         description: 'Update an existing record' },
    { id: 'delete_record',         description: 'Delete a record' },
  ]},
  { id: 'brave',      name: 'Brave Search MCP', description: 'Web search via the Brave Search API',                      url: 'mcp.bravesearch.local:3000',      docsUrl: 'https://api.search.brave.com/app/documentation/web-search', tools: [
    { id: 'web_search',            description: 'Search the web using Brave Search' },
    { id: 'image_search',          description: 'Search for images on the web' },
    { id: 'news_search',           description: 'Search for recent news articles' },
  ]},
  { id: 'filesystem', name: 'Filesystem MCP',   description: 'Read and write local filesystem operations',               url: 'localhost:3001',                  docsUrl: 'https://modelcontextprotocol.io/docs/tools/filesystem', tools: [
    { id: 'read_file',             description: 'Read the contents of a file' },
    { id: 'write_file',            description: 'Write or overwrite a file' },
    { id: 'list_directory',        description: 'List files in a directory' },
    { id: 'create_directory',      description: 'Create a new directory' },
    { id: 'delete_file',           description: 'Delete a file or directory' },
  ]},
  { id: 'slack',      name: 'Slack MCP',        description: 'Send messages and manage Slack workspaces',                url: 'mcp.slack.contoso.com:3000',      docsUrl: 'https://api.slack.com/docs', tools: [
    { id: 'send_message',          description: 'Send a message to a channel or user' },
    { id: 'list_channels',         description: 'List available Slack channels' },
    { id: 'create_channel',        description: 'Create a new Slack channel' },
    { id: 'get_thread',            description: 'Retrieve messages in a thread' },
  ]},
  { id: 'postgres',   name: 'PostgreSQL MCP',   description: 'Query and manage PostgreSQL databases',                    url: 'mcp.db.contoso.com:5432',         docsUrl: 'https://www.postgresql.org/docs/', tools: [
    { id: 'execute_query',         description: 'Run a SQL query and return results' },
    { id: 'list_tables',           description: 'List tables in the database' },
    { id: 'describe_table',        description: 'Show columns and types for a table' },
    { id: 'insert_row',            description: 'Insert a new row into a table' },
    { id: 'update_row',            description: 'Update an existing row' },
  ]},
];

export const MCP_PRODUCTS = [
  { id: 'outlook',   label: 'Outlook',    color: '#0078D4', initials: 'OL' },
  { id: 'github',    label: 'GitHub',     color: '#24292F', initials: 'GH' },
  { id: 'dataverse', label: 'Dataverse',  color: '#742774', initials: 'DV' },
];

// ─── Mock Computer Use environments ─────────────────────────────────────────

export const MOCK_CUAS = [
  { id: 'dev-env',   name: 'Contoso Dev Environment', description: 'Windows 11 browser automation for development tasks', type: 'Windows', url: 'cua.dev.contoso.com',
    hitl: { contacts: [{ id: 'cua-hitl-1', name: 'Priya Nair', email: 'priya.nair@contoso.com', notifyVia: 'teams' as const }] } },
  { id: 'marketing', name: 'Marketing Browser Agent', description: 'Chrome-based agent for marketing web tasks',         type: 'Browser', url: 'cua.marketing.contoso.com' },
  { id: 'qa-env',    name: 'Shared QA Environment',   description: 'Cross-browser testing and validation environment',   type: 'Linux',   url: 'cua.qa.contoso.com' },
];

// ─── Mock existing agents ───────────────────────────────────────────────────

export const MOCK_AGENTS = [
  { id: 'customer-support',    name: 'Customer Support Agent',   description: 'Handles customer inquiries, FAQs, and escalations', model: 'sonnet-4.5' },
  { id: 'invoice-processing',  name: 'Invoice Processing Agent', description: 'Extracts and validates invoice data against POs',    model: 'opus-4.5'   },
  { id: 'hr-onboarding',       name: 'HR Onboarding Agent',      description: 'Guides new employees through onboarding steps',     model: 'haiku-4.5'  },
  { id: 'code-review',         name: 'Code Review Agent',        description: 'Reviews pull requests and suggests improvements',   model: 'sonnet-4.5' },
];

// ─── Mock saved prompt templates ────────────────────────────────────────────

export const MOCK_PROMPTS = [
  { id: 'summarize',         name: 'Summarize Document', description: 'Condenses long documents into key bullet points',         category: 'Analysis'       },
  { id: 'extract-entities',  name: 'Extract Entities',   description: 'Pulls structured data \u2014 names, dates, and amounts',       category: 'Extraction'     },
  { id: 'classify-intent',   name: 'Classify Intent',    description: 'Determines the intent or category of user input',         category: 'Classification' },
  { id: 'translate',         name: 'Translate Content',  description: 'Converts text between languages with context awareness',  category: 'Transform'      },
  { id: 'generate-response', name: 'Generate Response',  description: 'Drafts a contextual response based on guidelines',        category: 'Generation'     },
];

export const MOCK_CLASSIFIERS = [
  { id: 'intent',     name: 'Intent Classifier',  description: 'Determines the intent or category behind user input'        },
  { id: 'sentiment',  name: 'Sentiment Analyzer',  description: 'Classifies text as positive, neutral, or negative'          },
  { id: 'category',   name: 'Category Router',     description: 'Routes content into predefined business categories'         },
];

export const MOCK_GUARDRAILS = [
  { id: 'content-safety', name: 'Content Safety', description: 'Blocks harmful, sensitive, or off-topic responses'          },
  { id: 'pii-filter',     name: 'PII Filter',      description: 'Detects and redacts personally identifiable information'    },
  { id: 'compliance',     name: 'Compliance Guard',description: 'Enforces regulatory and policy constraints on outputs'      },
];

export const MOCK_EXTRACTORS = [
  { id: 'entities', name: 'Entity Extractor', description: 'Pulls names, dates, amounts, and key facts from text'           },
  { id: 'invoice',  name: 'Invoice Parser',   description: 'Extracts line items, totals, and vendor details from invoices'  },
  { id: 'resume',   name: 'Resume Parser',    description: 'Extracts candidate details, skills, and experience from CVs'    },
];

export const MOCK_M365_COPILOTS = [
  { id: 'teams',      name: 'Teams Copilot',      description: 'Generates meeting summaries and action items from Teams chats' },
  { id: 'outlook',    name: 'Outlook Copilot',     description: 'Drafts email replies and summarizes thread context'           },
  { id: 'sharepoint', name: 'SharePoint Copilot',  description: 'Answers questions over SharePoint content and documents'      },
];

// ─── V1 Trigger type definitions ────────────────────────────────────────────

export const V1_TRIGGER_TYPES = [
  {
    id: 'manual',
    label: 'Manual',
    nodeLabel: 'Run manually',
    description: 'Run on demand from the workflow list.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('circle', { cx: '10', cy: '10', r: '8', stroke: 'currentColor', strokeWidth: '1.5' }),
      React.createElement('path', { d: 'M8 7.5l5 2.5-5 2.5V7.5z', fill: 'currentColor' })
    ),
  },
  {
    id: 'recurrence',
    label: 'Recurrence',
    nodeLabel: 'Recurrence',
    description: 'Runs on a fixed repeating schedule.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('path', { d: 'M3 10a7 7 0 1 0 7-7', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
      React.createElement('path', { d: 'M3 6v4h4', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' })
    ),
  },
  {
    id: 'sliding-window',
    label: 'Sliding Window',
    nodeLabel: 'Sliding Window',
    description: 'Recurring with no gaps between runs.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('rect', { x: '2', y: '7', width: '7', height: '6', rx: '1.5', stroke: 'currentColor', strokeWidth: '1.5' }),
      React.createElement('rect', { x: '11', y: '7', width: '7', height: '6', rx: '1.5', stroke: 'currentColor', strokeWidth: '1.5' }),
      React.createElement('path', { d: 'M9 10h2', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' })
    ),
  },
  {
    id: 'http-request',
    label: 'HTTP Request',
    nodeLabel: 'When an HTTP request is received',
    description: 'Triggered by an inbound HTTP request.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('circle', { cx: '10', cy: '10', r: '7.5', stroke: 'currentColor', strokeWidth: '1.5' }),
      React.createElement('path', { d: 'M2.5 10h15M10 2.5a10.5 10.5 0 0 1 0 15M10 2.5a10.5 10.5 0 0 0 0 15', stroke: 'currentColor', strokeWidth: '1.5' })
    ),
  },
  {
    id: 'http',
    label: 'HTTP',
    nodeLabel: 'HTTP',
    description: 'Polls an external HTTP endpoint.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('path', { d: 'M3 6h14M3 10h14M3 14h9', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' })
    ),
  },
  {
    id: 'http-webhook',
    label: 'HTTP Webhook',
    nodeLabel: 'HTTP Webhook',
    description: 'Triggered by a webhook callback.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('path', { d: 'M10 3v5m0 0c-2.5 0-5 2-5 4.5S7 17 10 17s5-2 5-4.5', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
      React.createElement('circle', { cx: '10', cy: '8', r: '1.5', fill: 'currentColor' }),
      React.createElement('path', { d: 'M15 12.5c.5-.8.5-1.5.5-2', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' })
    ),
  },
  {
    id: 'connector',
    label: 'Connector',
    nodeLabel: 'Connector',
    description: 'Triggered by a connector event.',
    icon: React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      React.createElement('rect', { x: '2', y: '2', width: '7', height: '7', rx: '1.5', fill: 'currentColor', opacity: '.8' }),
      React.createElement('rect', { x: '11', y: '2', width: '7', height: '7', rx: '1.5', fill: 'currentColor', opacity: '.5' }),
      React.createElement('rect', { x: '2', y: '11', width: '7', height: '7', rx: '1.5', fill: 'currentColor', opacity: '.5' }),
      React.createElement('rect', { x: '11', y: '11', width: '7', height: '7', rx: '1.5', fill: 'currentColor', opacity: '.3' })
    ),
  },
] as const;
export type V1TriggerTypeId = typeof V1_TRIGGER_TYPES[number]['id'];

// ─── Auto description placeholder ──────────────────────────────────────────

export const AUTO_DESC_PLACEHOLDER = 'Add steps to describe what this workflow does.';

// ─── Default workflow nodes ─────────────────────────────────────────────────

export const DEFAULT_NODES: WorkflowNode[] = [
  { id: 'trigger-1',   type: 'trigger',   label: 'Workflow trigger' },
  { id: 'ai-action-1', type: 'ai-action', label: 'Extract data from document', config: { task: 'Given a list of target entities (comma-separated) and an input name/string, extract each entity with high precision.', entities: ['Entity', 'Text'] } },
  { id: 'agent-1',     type: 'agent',     label: 'Agent - Document validation', config: { instructions: 'You are an Invoice Validation Agent. Verify that the extracted invoice data is complete and accurate.', knowledge: ['Invoice policy'], tools: ['Dataverse MCP'] } },
  { id: 'condition-1', type: 'condition', label: 'Branch' },
  { id: 'action-1',    type: 'action',    label: 'Send approval email',  connector: 'Outlook', branch: 'true' },
  { id: 'action-2',    type: 'action',    label: 'Send rejection email', connector: 'Outlook', branch: 'false' },
  // Pre-built CUA
  { id: 'cua-1', type: 'action', label: 'Computer Use',
    config: { instanceMode: 'dev-env', instanceName: 'Contoso Dev Environment', stepTypeLabel: 'Computer Use', cuaId: 'dev-env' },
    hitlEnabled: true, hitlMode: 'custom', hitlLocked: true,
    hitlContacts: [{ id: 'cua-hitl-1', name: 'Priya Nair', email: 'priya.nair@contoso.com', notifyVia: 'teams' }] },
  // Agent created during this workflow
  { id: 'agent-2', type: 'agent', label: 'Agent',
    config: { instanceMode: 'create', instanceName: 'Customer Support Agent', stepTypeLabel: 'Agent', instructions: 'You are a Customer Support Agent. Handle customer inquiries, resolve issues, and escalate when needed.', knowledge: [], tools: [] },
    hitlEnabled: true, hitlMode: 'custom', hitlLocked: false,
    hitlContacts: [{ id: 'wf-hitl-1', name: 'Marcus Webb', email: 'marcus.webb@contoso.com', notifyVia: 'email' }] },
];

// ─── Shared CSS class for canvas control buttons ────────────────────────────

export const canvasControlBtnClass = "w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors";
