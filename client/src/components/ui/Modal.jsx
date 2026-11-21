import { useEffect, useRef } from 'react';
import { Icon } from './Icon.jsx';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

/**
 * Accessible dialog built on the native <dialog> (focus trap, Esc, focus return come from the browser).
 * <Modal open onClose title description size="sm|md|lg" footer={<Buttons/>}>content</Modal> — children render only while open.
 */
export function Modal({ open, onClose, title, description, size = 'md', footer, children, dismissible = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    if (open && !d.open) { d.showModal(); document.body.style.overflow = 'hidden'; }
    if (!open && d.open) d.close();
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="modal-title" aria-describedby={description ? 'modal-desc' : undefined}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose?.(); }}
      onMouseDown={(e) => { if (dismissible && e.target === ref.current) onClose?.(); }}
      className={`m-auto w-[calc(100%-2rem)] ${SIZES[size]} max-h-[90vh] overflow-hidden rounded-2xl p-0 shadow-lift backdrop:bg-navy-950/60 open:animate-fade-up`}>
      {open ? (
        <div className="flex max-h-[90vh] flex-col bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-6 py-4">
            <div>
              <h2 id="modal-title" className="font-serif text-xl font-semibold">{title}</h2>
              {description ? <p id="modal-desc" className="mt-1 text-sm text-navy-700">{description}</p> : null}
            </div>
            {dismissible ? <button type="button" onClick={onClose} aria-label="Close dialog" className="-mr-2 rounded-lg p-2 text-navy-600 hover:bg-navy-100"><Icon name="x" /></button> : null}
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-navy-100 bg-navy-50/60 px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
