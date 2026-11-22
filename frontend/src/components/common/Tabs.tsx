import { createContext, useContext, useState, ReactNode } from 'react';
import { cn } from '../../utils/helpers';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export function Tabs({ children, value, onValueChange, defaultValue, className }: {
  children: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const controlled = value !== undefined;

  const contextValue = {
    value: controlled ? value : internalValue,
    onValueChange: controlled ? onValueChange! : setInternalValue,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex', className)}>{children}</div>;
}

export function TabTrigger({ value, children, className, disabled }: { value: string; children: ReactNode; className?: string; disabled?: boolean }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && context.onValueChange(value)}
      className={cn(
        'flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        isActive
          ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabContent must be used within Tabs');

  if (context.value !== value) return null;

  return <div className={cn('mt-4', className)}>{children}</div>;
}