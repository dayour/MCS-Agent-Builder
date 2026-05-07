// TypeScript declarations for Fluent UI Web Components
declare namespace JSX {
  interface IntrinsicElements {
    'fluent-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      appearance?: 'accent' | 'neutral' | 'outline' | 'stealth';
      disabled?: boolean;
    };
    'fluent-card': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'fluent-checkbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      checked?: boolean;
      disabled?: boolean;
    };
    'fluent-radio': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'fluent-radio-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'fluent-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      checked?: boolean;
      disabled?: boolean;
    };
    'fluent-text-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      placeholder?: string;
      value?: string;
      disabled?: boolean;
    };
    'fluent-text-area': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      placeholder?: string;
      rows?: number;
      value?: string;
      disabled?: boolean;
    };
    'fluent-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      fill?: 'primary' | 'danger' | 'success' | 'warning' | 'informational';
    };
    'fluent-divider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      role?: string;
    };
    'fluent-progress': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      value?: number;
      min?: number;
      max?: number;
    };
    'fluent-skeleton': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'fluent-anchor': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      href?: string;
      target?: string;
      appearance?: string;
    };
  }
}
