import React from 'react';
import ReactDOM from 'react-dom';
import { Dismiss20Regular } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  /** Override styles on the inner container (e.g. custom max-width / max-height). */
  containerStyle?: React.CSSProperties;
  /** Override the max height. Defaults to 80vh. */
  maxHeight?: string;
  /** Force a fixed height (e.g. "85vh"). Useful for editors where you want a tall dialog regardless of content. */
  height?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = '2xl',
  containerStyle,
  maxHeight = '80vh',
  height,
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        style={{ animation: 'fadeInText 0.2s ease-out forwards' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`bg-[hsl(var(--card))] shadow-2xl w-full ${maxWidthClasses[maxWidth]} overflow-hidden flex flex-col`}
          style={{
            borderRadius: 'var(--radius-4xl)',
            animation: 'slide-up-fade 0.3s ease-out forwards',
            opacity: 0,
            transform: 'translateY(10px)',
            maxHeight,
            ...(height ? { height } : {}),
            ...containerStyle,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  );
};

interface DialogHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, onClose }) => {
  return (
    <div className="flex items-center justify-between px-6 pt-4 pb-2">
      {children}
      {onClose && (
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2"
        >
          <Dismiss20Regular />
        </CopilotButton>
      )}
    </div>
  );
};

interface DialogContentProps {
  children: React.ReactNode;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children }) => {
  return (
    <div className="flex-1 overflow-y-auto px-6 pt-2 pb-2 flex flex-col">
      {children}
    </div>
  );
};

interface DialogFooterProps {
  children: React.ReactNode;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
  return (
    <div className="flex-shrink-0 px-6 pt-2 pb-5 flex justify-end gap-2">
      {children}
    </div>
  );
};

interface DialogTitleProps {
  children: React.ReactNode;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => {
  return (
    <h2 className="text-title-3 font-semibold">{children}</h2>
  );
};

interface DialogDescriptionProps {
  children: React.ReactNode;
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children }) => {
  return (
    <p className="text-body-2 text-text-secondary mb-6">{children}</p>
  );
};
