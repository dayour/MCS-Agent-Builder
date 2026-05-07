/// <reference types="vite/client" />

// Fluent UI web components type declaration (from Elevate)
declare module '@fluentui/web-components' {
  export function provideFluentDesignSystem(): any;
  export function fluentProgressRing(): any;
}

// Allow importing CSS modules
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Allow importing SVG as component
declare module '*.svg' {
  const content: string;
  export default content;
}

// Allow importing image files
declare module '*.png' {
  const content: string;
  export default content;
}
declare module '*.jpg' {
  const content: string;
  export default content;
}
declare module '*.woff2' {
  const content: string;
  export default content;
}
