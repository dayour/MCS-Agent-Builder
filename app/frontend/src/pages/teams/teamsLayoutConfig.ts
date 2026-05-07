/**
 * Teams visual constants — colors, sizing, and layout values
 * derived from the Teams screenshot reference (public/teams-chrome.png).
 *
 * The shell is built as real HTML/CSS flex layout (not screenshot overlay)
 * so it grows/shrinks naturally with the browser window.
 */

// --- Colors (sampled from Teams screenshot) ---
export const TEAMS_COLORS = {
  // Chrome
  headerBg: '#ffffff',
  sidebarBg: '#f5f5f5',
  sidebarBorder: '#e0e0e0',
  chatBg: '#ffffff',
  composeBg: '#ffffff',
  composeBorder: '#e0e0e0',

  // Brand
  purple: '#6264A7',       // Teams purple (active nav icon, badges)
  purpleLight: '#E8E8F5',  // Selected item bg
  activeBg: '#E8EAF0',     // Active sidebar item

  // Text
  textPrimary: '#242424',
  textSecondary: '#616161',
  textTertiary: '#adadad',

  // Messages
  userBubbleBg: '#E5E5FC',   // Light purple tint for user messages
  botBubbleBg: 'transparent',
  hoverBg: '#f5f5f5',
};

// --- Layout ---
export const TEAMS_LAYOUT = {
  sidebarWidth: 320,        // px — left sidebar width
  headerHeight: 48,         // px — top search bar
  chatHeaderHeight: 44,     // px — chat name + tabs row
  composeHeight: 52,        // px — compose bar height
  navRailWidth: 56,         // px — far-left icon rail
};

// --- Fonts ---
export const TEAMS_FONTS = {
  family: "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '14px',
  sizeLg: '16px',
  sizeXl: '18px',
};
