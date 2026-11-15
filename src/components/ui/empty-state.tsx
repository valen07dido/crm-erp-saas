import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-1 flex-col items-center justify-center py-10 text-center ${className ?? ''}`}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">{description}</p>}
      {action && (
        <Link href={action.href} className="mt-4 text-xs font-semibold text-primary hover:underline">
          {action.label} →
        </Link>
      )}
    </div>
  );
}
