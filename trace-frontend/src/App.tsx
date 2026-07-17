import React, { useState } from 'react';
import RoleSelection from './components/RoleSelection';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import Dashboard from './components/Dashboard';

type Role = 'admin' | 'user';

type AuthSession = {
  role: Role;
  username?: string;
  employeeId?: string;
  fullName: string;
  email?: string;
  projectId?: string;
  token?: string;
};

export default function App() {
  // ================= STATE MANAGEMENT =================
  const [selectedRole, setSelectedRole] = useState<Role | null>(() => {
    const savedRole = localStorage.getItem('selectedRole');
    return savedRole ? (savedRole as Role) : null;
  });

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    const savedSession = localStorage.getItem('authSession');
    return savedSession ? JSON.parse(savedSession) : null;
  });

  // ================= ROUTER EVENT HANDLERS =================
  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    localStorage.setItem('selectedRole', role);
  };

  const handleAuthSuccess = (session: AuthSession) => {
    setAuthSession(session);
    localStorage.setItem('authSession', JSON.stringify(session));
    if (session.token) {
      localStorage.setItem('trace_session_token', session.token);
    }
  };

  const handleLogout = () => {
    setSelectedRole(null);
    setAuthSession(null);
    localStorage.clear(); // Safely flushes tokens, project contexts, and credentials
  };

  // ================= APPLICATION ROUTING TREE =================

  // STEP 1: Initial Role Selection Screen
  if (!selectedRole) {
    return <RoleSelection onSelectRole={handleRoleSelect} />;
  }

  // STEP 2: Verification, Account Signups, or Password-less Gateway Portals
  if (!authSession) {
    return (
      <AuthPage
        role={selectedRole}
        onBack={() => {
          setSelectedRole(null);
          localStorage.removeItem('selectedRole');
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  // STEP 3: System Administrator Room Override Routing
  if (authSession.role === 'admin') {
    return (
      <AdminDashboard
        fullName={authSession.fullName || authSession.username || 'System Admin'}
        onLogout={handleLogout}
      />
    );
  }

  // STEP 4: Standard Agile Workspace Lane Framework
  return (
    <Dashboard
      workspace={{
        workspaceName: authSession.fullName,
        workspaceKey: authSession.projectId || '',
        employeeId: authSession.employeeId || '',
      }}
      token={authSession.token}
      onLogout={handleLogout}
    />
  );
}