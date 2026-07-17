import React, { useEffect, useState } from 'react';

interface EmployeeProjectSummary {
  project_id: string;
  project_name: string;
  project_key: string;
  slug: string;
  user_role_in_project: string;
  user_designation: string;
}

export default function ProfilePage({
  workspace,
  token,
  employeeProjects,
}: {
  workspace: { workspaceName: string; workspaceKey: string; employeeId: string };
  token?: string;
  employeeProjects: EmployeeProjectSummary[];
}) {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!workspace.employeeId) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`http://localhost:8000/employees/${encodeURIComponent(workspace.employeeId)}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          // backend might not have an employee endpoint; fall back to workspace props
          setProfile(null);
        } else {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err: any) {
        setError('Unable to load full profile from the API. Showing local data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workspace.employeeId, token]);

  const displayName = profile?.full_name ?? workspace.workspaceName ?? 'Unknown';
  const email = profile?.email ?? profile?.contact?.email ?? '';
  const designation = profile?.designation ?? 'Not specified';

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-slate-950">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Employee details and project memberships</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            {workspace.employeeId ? workspace.employeeId.charAt(0).toUpperCase() : 'U'}
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-sm text-slate-500">Employee ID: {workspace.employeeId || 'N/A'}</p>
            <p className="text-sm text-slate-500">Designation: {designation}</p>
            {email ? <p className="text-sm text-slate-500">Email: {email}</p> : null}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading additional profile details...</p>
        ) : error ? (
          <p className="mt-4 text-sm text-rose-600">{error}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Projects</h3>
        <p className="mt-1 text-sm text-slate-500">Projects this employee is a member of</p>

        <div className="mt-4 grid gap-4">
          {employeeProjects.length ? (
            employeeProjects.map((p) => (
              <div key={p.project_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{p.project_name}</p>
                    <p className="text-xs text-slate-500">Key: {p.project_key || p.slug}</p>
                    <p className="text-xs text-slate-500">Role: {p.user_role_in_project}</p>
                    <p className="text-xs text-slate-500">Designation: {p.user_designation}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="mt-2 text-sm text-slate-500">No projects found for this employee.</p>
          )}
        </div>
      </section>
    </div>
  );
}
