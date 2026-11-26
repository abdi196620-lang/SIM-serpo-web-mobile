import React, { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
}

interface UseDialogFocusTrapOptions {
  isOpen: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function useDialogFocusTrap({
  isOpen,
  containerRef,
  onClose,
}: UseDialogFocusTrapOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const active = document.activeElement;
    previousFocusRef.current = active instanceof HTMLElement ? active : null;

    const rafId = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusableElements(container);
        if (focusables.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;

        if (!container.contains(current)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }

        if (e.shiftKey) {
          if (current === first || current === container) {
            e.preventDefault();
            last.focus();
          }
        } else if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected) {
        window.requestAnimationFrame(() => {
          prev.focus();
        });
      }
    };
  }, [isOpen, containerRef]);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  panelClassName?: string;
  backdropClassName?: string;
  closeOnBackdropClick?: boolean;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  ariaLabel,
  maxWidthClass = 'max-w-lg',
  panelClassName = 'p-5 shadow-lg space-y-4 max-h-[92vh] overflow-y-auto',
  backdropClassName = 'bg-black/40',
  closeOnBackdropClick = true,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useDialogFocusTrap({
    isOpen: open,
    containerRef: panelRef,
    onClose,
  });

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClassName}`}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`bg-white rounded-xl border border-[#E2E8F0] w-full focus:outline-none ${maxWidthClass} ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
