import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  iconSize?: number;
  wrapperClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  className = '',
  wrapperClassName = '',
  iconSize = 16,
  ...props
}) => (
  <div className={`ops-search-field ${wrapperClassName}`.trim()}>
    <MagnifyingGlass
      size={iconSize}
      weight="regular"
      className="shrink-0 text-ops-muted"
      aria-hidden
    />
    <input
      type="search"
      className={`ops-search-field-input ${className}`.trim()}
      {...props}
    />
  </div>
);
