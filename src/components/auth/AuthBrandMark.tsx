import React from 'react';
import { SquaresFour } from '@phosphor-icons/react';

interface AuthBrandMarkProps {
  title: string;
  subtitle?: string;
}

/** OpsRelay logo block shared by login and registration screens. */
export const AuthBrandMark: React.FC<AuthBrandMarkProps> = ({ title, subtitle }) => (
  <div className="mb-6 flex flex-col items-center text-center">
    <p className="mb-2 text-lg font-semibold tracking-tight text-ops-text">OpsRelay</p>
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
      <SquaresFour size={20} weight="bold" aria-hidden />
    </div>
    <h1 className="text-xl font-semibold text-ops-text">{title}</h1>
    {subtitle && <p className="mt-1 text-sm text-ops-subtext">{subtitle}</p>}
  </div>
);
