import React from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';

type Role = 'admin' | 'user';

type Props = {
  onSelectRole: (role: Role) => void;
};

export default function RoleSelection({ onSelectRole }: Props) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6">
      <div className="w-full max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
          Trace Platform
        </p>

       <h1 className="mt-3 text-4xl font-bold text-slate-950">
          Project Tracking Platform
        </h1>

        <p className="mt-3 text-slate-500">
          Select your role to continue.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            onClick={() => onSelectRole('admin')}
            className="rounded-3xl border border-blue-100 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <ShieldCheck />
            </div>

            <h2 className="text-2xl font-bold text-slate-950">Admin</h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Signup, login, register users, delete users, view all projects,
              all tasks, and platform statistics.
            </p>
          </button>

          <button
            onClick={() => onSelectRole('user')}
            className="rounded-3xl border border-blue-100 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white">
              <UserRound />
            </div>

            <h2 className="text-2xl font-bold text-slate-950">User</h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Continue as Team Leader or Team Member. Create projects, join
              projects, manage members, and track assigned tasks.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}