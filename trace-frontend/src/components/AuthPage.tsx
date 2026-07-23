import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Lock,
  ShieldCheck,
  User,
  Users,
  Sparkles,
  Mail,
  Phone,
  Briefcase,
  FolderPlus,
  KeyRound,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { apiUrl } from '../lib/api';

type Role = 'admin' | 'user';

type AuthPageProps = {
  role: Role;
  onBack: () => void;
  onAuthSuccess: (session: {
    role: Role;
    username?: string;
    employeeId?: string;
    fullName: string;
    email?: string;
    projectId?: string;
    token?: string;
  }) => void;
};

export default function AuthPage({ role, onBack, onAuthSuccess }: AuthPageProps) {
  // ================= SYSTEM SUB-MODE STATES =================
  const [adminMode, setAdminMode] = useState<'login' | 'signup'>('login');
  const [userMode, setUserMode] = useState<'gateway' | 'register' | 'create-project'>('gateway');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ================= STATE BINDINGS =================
  const [gatewayData, setGatewayData] = useState({ employeeId: '', projectKey: '' });
  const [projectCreateData, setProjectCreateData] = useState({ projectName: '', employeeId: '' });
  const [adminLoginData, setAdminLoginData] = useState({ username: '', password: '' });
  const [adminSignupData, setAdminSignupData] = useState({ username: '', password: '', fullName: '' });
  const [employeeRegisterData, setEmployeeRegisterData] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    department: 'Engineering',
    designation: 'Developer',
    skills: '',
  });

  // ================= ACTION HANDLERS =================
  const handleGatewaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const formattedKey = gatewayData.projectKey.trim().toUpperCase();
      const cleanEmployeeId = gatewayData.employeeId.trim();

      const res = await fetch(apiUrl('/projects/verify-access'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          employee_id: cleanEmployeeId,
          project_key: formattedKey
        })
      });

      const data = await res.json();
      
      // Fixed: Ensure errors are only processed and thrown when res.ok is explicitly false
      if (!res.ok) {
        const validationErrorText = typeof data.detail === 'object' 
          ? JSON.stringify(data.detail, null, 2) 
          : data.detail;
        throw new Error(validationErrorText || 'Gateway validation parameters rejected.');
      }

      localStorage.setItem('trace_session_token', data.access_token);

      onAuthSuccess({
        role: 'user',
        employeeId: cleanEmployeeId,
        fullName: data.user_meta?.full_name || 'Project Member',
        projectId: data.user_meta?.project_id,
        token: data.access_token
      });

    } catch (err: any) {
      setErrorMsg(err.message);
      console.error("Gateway access validation exception:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/auth/user/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeRegisterData.employeeId.trim(),
          full_name: employeeRegisterData.fullName.trim(),
          email: employeeRegisterData.email.trim(),
          phone_number: employeeRegisterData.phoneNumber.trim(),
          department: employeeRegisterData.department,
          designation: employeeRegisterData.designation,
          skills: employeeRegisterData.skills.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to record entry.');

      setSuccessMsg(`Employee account [${data.employee_id}] successfully listed! You can now verify into gateways.`);
      setUserMode('gateway');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/auth/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminLoginData.username.trim(),
          password: adminLoginData.password,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Administrative access rejected.');

      localStorage.setItem('trace_session_token', data.access_token);

      onAuthSuccess({
        role: 'admin',
        username: adminLoginData.username.trim(),
        fullName: 'System Administrator',
        token: data.access_token
      });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/auth/admin/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminSignupData.username.trim(),
          password: adminSignupData.password,
          full_name: adminSignupData.fullName.trim(),
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Administrative signup rejected.');

      setSuccessMsg(`Admin account [${data.username || adminSignupData.username.trim()}] created. Log in to continue.`);
      setAdminMode('login');
      setAdminLoginData({ username: adminSignupData.username.trim(), password: '' });
      setAdminSignupData({ username: '', password: '', fullName: '' });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setGeneratedKey(null);
    setIsLoading(true);

    try {
      const automaticSlug = projectCreateData.projectName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')   
        .replace(/(^-|-$)/g, '');      

      const res = await fetch(apiUrl('/projects/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_name: projectCreateData.projectName.trim(),
          slug: automaticSlug,                             
          employee_id: projectCreateData.employeeId.trim() 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not compile project rows.');

      setGeneratedKey(data.project_key); 
      setSuccessMsg(`Workspace created successfully!`);
      
      setGatewayData({
        employeeId: projectCreateData.employeeId.trim(),
        projectKey: data.project_key
      });

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6">
        
        {/* Top Header Row Layout */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold capitalize">{role} Control Gate</h1>
            <p className="text-xs text-slate-500">Trace workspace security checkpoint</p>
          </div>
          <button 
            onClick={onBack} 
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl transition"
          >
            ← Back
          </button>
        </div>

        {/* Status Alerts Notification System */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto"
            >
              ⚠️ Code Exception: {errorMsg}
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-medium">
                🚀 Execution Block: {successMsg}
              </div>
              
              {/* Aligned semantic code badge */}
              {generatedKey && (
                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">System Extracted Key</span>
                    <span className="text-xs text-slate-600 block font-medium">Use this code to pass gateway validation:</span>
                  </div>
                  <div className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-mono text-base font-extrabold text-slate-900 tracking-widest shadow-sm">
                    {generatedKey}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Properly Structured 3-Tab Group Navigation for Users */}
        {role === 'user' && (
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 text-xs font-semibold">
            <button
              onClick={() => { setUserMode('gateway'); setErrorMsg(null); setSuccessMsg(null); setGeneratedKey(null); }}
              className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${userMode === 'gateway' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <KeyRound className="w-3.5 h-3.5 text-zinc-400" /> 
              Gateway
            </button>
            <button
              onClick={() => { setUserMode('register'); setErrorMsg(null); setSuccessMsg(null); setGeneratedKey(null);
              }}
              className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${userMode === 'register' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Users className="w-3.5 h-3.5 text-zinc-400" /> 
              Register Staff
            </button>
            <button
              onClick={() => { setUserMode('create-project'); setErrorMsg(null); setSuccessMsg(null); setGeneratedKey(null); }}
              className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${userMode === 'create-project' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-zinc-400" /> 
              New Project
            </button>
          </div>
        )}

        {/* Administration Governance Layout Check */}
        {role === 'admin' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => { setAdminMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`py-2 rounded-xl transition ${adminMode === 'login' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Admin Login
              </button>
              <button
                onClick={() => { setAdminMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`py-2 rounded-xl transition ${adminMode === 'signup' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Admin Signup
              </button>
            </div>

            {adminMode === 'login' ? (
              <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Username</label>
                  <input
                    type="text"
                    required
                    value={adminLoginData.username}
                    onChange={(e) => setAdminLoginData({ ...adminLoginData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Password</label>
                  <input
                    type="password"
                    required
                    value={adminLoginData.password}
                    onChange={(e) => setAdminLoginData({ ...adminLoginData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:opacity-90 transition text-sm shadow-sm">
                  {isLoading ? 'Verifying admin session...' : 'Unlock Admin Console'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminSignupSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminSignupData.fullName}
                    onChange={(e) => setAdminSignupData({ ...adminSignupData, fullName: e.target.value })}
                    placeholder="System Administrator"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Username</label>
                  <input
                    type="text"
                    required
                    value={adminSignupData.username}
                    onChange={(e) => setAdminSignupData({ ...adminSignupData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Password</label>
                  <input
                    type="password"
                    required
                    value={adminSignupData.password}
                    onChange={(e) => setAdminSignupData({ ...adminSignupData, password: e.target.value })}
                    placeholder="Create a secure password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:opacity-90 transition text-sm shadow-sm">
                  {isLoading ? 'Creating admin account...' : 'Create Admin Account'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Form Container Sections */}
        {role === 'user' && (
          <div className="space-y-4">
            
            {/* TAB PANEL 1: PROJECT GATEWAY ACCESS VERIFICATION */}
            {userMode === 'gateway' && (
              <form onSubmit={handleGatewaySubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Employee ID Code</label>
                  <input
                    type="text"
                    required
                    value={gatewayData.employeeId}
                    onChange={(e) => setGatewayData({ ...gatewayData, employeeId: e.target.value })}
                    placeholder="e.g., EMP01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 uppercase transition text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Project Key Prefix</label>
                  <input
                    type="text"
                    required
                    value={gatewayData.projectKey}
                    onChange={(e) => setGatewayData({ ...gatewayData, projectKey: e.target.value })}
                    placeholder="e.g., TEJ, TRACE"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 uppercase transition tracking-wider text-slate-900"
                  />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.99] transition shadow mt-2">
                  {isLoading ? 'Decrypting Security Handshake...' : 'Unlock Project Space →'}
                </button>
              </form>
            )}

            {/* TAB PANEL 2: STAFF DIRECTORY USER LISTING ONBOARDING */}
            {userMode === 'register' && (
              <form onSubmit={handleEmployeeRegisterSubmit} className="space-y-3 max-h-96 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Employee ID</label>
                    <input required value={employeeRegisterData.employeeId} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, employeeId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-400 uppercase transition text-slate-900" placeholder="EMP01" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Full Name</label>
                    <input required value={employeeRegisterData.fullName} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, fullName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-400 transition text-slate-900" placeholder="Tej Singh" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Corporate Email</label>
                  <input type="email" required value={employeeRegisterData.email} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-400 transition text-slate-900" placeholder="tej@company.com" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Phone Number</label>
                  <input type="tel" value={employeeRegisterData.phoneNumber} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, phoneNumber: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-400 transition text-slate-900" placeholder="+91 91234 56789" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Department</label>
                    <select value={employeeRegisterData.department} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, department: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm outline-none text-slate-600 font-medium">
                      <option value="Engineering">Engineering Track</option>
                      <option value="Product Delivery">Product Delivery</option>
                      <option value="Quality Assurance">Quality Assurance</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Designation</label>
                    <select value={employeeRegisterData.designation} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, designation: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm outline-none text-slate-600 font-medium">
                      <option value="Developer">Developer</option>
                      <option value="Tester">Tester</option>
                      <option value="Designer">UI/UX Designer</option>
                      <option value="DevOps Engineer">DevOps Engineer</option>
                      <option value="Product Manager">Product Manager</option>
                      <option value="Intern">Intern</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Skills Inventory Tags</label>
                  <input value={employeeRegisterData.skills} onChange={(e) => setEmployeeRegisterData({ ...employeeRegisterData, skills: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-400 transition text-slate-900" placeholder="Python, FastAPI, React (Split with commas)" />
                </div>

                <button type="submit" onClick={() => {console.log("Registerbtn-APIcall chk",employeeRegisterData)}} disabled={isLoading} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition mt-3 text-sm shadow">
                  {isLoading ? 'Onboarding...' : 'Onboard Profile Directory'}
                </button>
              </form>
            )}

            {/* TAB PANEL 3: DRAFT AND INITIALIZE BRAND NEW PROJECTS */}
            {userMode === 'create-project' && (
              <form onSubmit={handleProjectCreateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Project Corporate Name</label>
                  <input
                    type="text"
                    required
                    value={projectCreateData.projectName}
                    onChange={(e) => setProjectCreateData({ ...projectCreateData, projectName: e.target.value })}
                    placeholder="e.g., Trace Platform, Team Tej Workspace"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition text-slate-900"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-0.5">Team Leader Employee ID</label>
                  <input
                    type="text"
                    required
                    value={projectCreateData.employeeId}
                    onChange={(e) => setProjectCreateData({ ...projectCreateData, employeeId: e.target.value })}
                    placeholder="e.g., EMP01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 uppercase transition text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block pl-0.5 font-medium leading-relaxed">
                    The backend automatically processes this text parameter to construct short recognizable keys and seeds the 9 custom workflow columns.
                  </span>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-700 text-white py-2.5 rounded-xl font-bold text-sm tracking-wide transition shadow mt-2 flex items-center justify-center gap-2" >
                  <Layers className="w-4 h-4" />
                  {isLoading ? 'Seeding Agile Status Lanes...' : 'Initialize New Project Space'}
                </button>
              </form>
            )}

          </div>
        )}
      </div>
    </div>
  );
}