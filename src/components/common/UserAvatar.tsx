import React from 'react';
import { getInitials } from '../../utils/avatar';

interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, size = 'md', className = '' }) => (
  <span
    title={name}
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 ring-1 ring-slate-200 ${SIZES[size]} ${className}`}
    aria-hidden
  >
    {getInitials(name)}
  </span>
);
