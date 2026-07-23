import React, { useEffect, useState } from 'react';
import { FolderKanban, LogOut, Users, CheckCircle2, Activity, Loader2, ShieldAlert, Trash2, UserCheck, Shield, ChevronRight, Briefcase, Mail, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../lib/api';

type Props = {
  fullName: string;
  onLogout: () => void;
};

interface EmployeeLog {
  employee_id: string;
  full_name: string;
  email: string;
  created_at: string;
  department?: string;
  designation?: string;
  skills?: string[];
}

interface ProjectMember {
  employee_id: string;
  full_name: string;
  email: string;
  project_role: string;
  designation: string;
}

interface AdminStats {
  total_projects: number;
  total_employees: number;
  designation_breakdown: Record<string, number>;
  recent_registrations: EmployeeLog[];
  projects_list?: Array<{ id: string; name: string; project_key: string }>;
}

export default function AdminDashboard({ fullName, onLogout }: Props) {
  // ================= ADMIN ENGINE STATES =================
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'projects' | 'employees'>('projects');
  
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string; project_key: string } | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLog | null>(null);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    projectId: '',
    oldLeaderId: '',
    newLeaderId: '',
  });

  // ================= LOAD BASE SUMMARY METRICS =================
  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('trace_session_token');
      const res = await fetch(apiUrl('/projects/admin/overview-stats'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to sync platform metrics.');

      const realProjects = (data.projects_list || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        project_key: p.slug || 'PROJ'
      }));

      setStats({
        total_projects: data.total_projects || realProjects.length,
        total_employees: data.total_employees || 0,
        designation_breakdown: data.designation_breakdown || {},
        recent_registrations: data.recent_registrations || [],
        projects_list: realProjects
      });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // ================= INTERACTIVE CLICK RECONCILIATIONS =================
  
  // Clicked on a Project -> Fetch all members and roles matching our new endpoint shape
  const handleProjectClick = async (project: { id: string; name: string; project_key: string }) => {
    setSelectedProject(project);
    setIsMembersLoading(true);
    setProjectMembers([]);
    try {
      const token = localStorage.getItem('trace_session_token');
      const res = await fetch(apiUrl(`/projects/admin/${project.id}/members-list`), {
        method: 'GET',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
      });
      
      if (res.ok) {
        const data = await res.json();
        setProjectMembers(data);
      }
    } catch (error) {
      console.error("Error loading project members details:", error);
    } finally {
      setIsMembersLoading(false);
    }
  };

// When clicked on a particular employee -> Fetch full dynamic profile details from our separate endpoint
  const handleEmployeeClick = async (employee: EmployeeLog) => {
    setIsEmployeeLoading(true);
    // Optimistically set baseline parameters from list view context first
    setSelectedEmployee(employee); 
    
    try {
      const token = localStorage.getItem('trace_session_token');
      // Hitting the new dedicated separate endpoint we made on the backend
      const res = await fetch(apiUrl(`/projects/admin/employee/${employee.employee_id}/details`), {
        method: 'GET',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
      });
      
      if (res.ok) {
        const realData = await res.json();
        // Sets state with genuine dynamic details computed directly by the backend database
        setSelectedEmployee(realData);
      }
    } catch (error) {
      console.error("Error fetching employee details over network:", error);
    } finally {
      setIsEmployeeLoading(false);
    }
  };

  // ================= ADMINISTRATIVE OVERRIDE WORKERS =================

  const handleForceDeleteUser = async (employeeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete Employee ID [${employeeId}]?`)) return;

    try {
      const token = localStorage.getItem('trace_session_token');
      const res = await fetch(apiUrl(`/auth/admin/delete-user/${employeeId}`), {
        method: 'DELETE',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Delete operation rejected.');

      alert(`Employee profile successfully deleted.`);
      if (selectedEmployee?.employee_id === employeeId) setSelectedEmployee(null);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleForceDeleteProject = async (projectId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to completely delete the project "${name}"?`)) return;

    try {
      const token = localStorage.getItem('trace_session_token');
      const res = await fetch(apiUrl(`/projects/admin/delete/${projectId}`), {
        method: 'DELETE',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Project container removal request rejected.');

      alert(`Project "${name}" cleanly deleted.`);
      if (selectedProject?.id === projectId) setSelectedProject(null);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransferLeadershipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadFormData.projectId || !leadFormData.oldLeaderId || !leadFormData.newLeaderId) {
      alert("Please fill out all leader reassignment inputs.");
      return;
    }

    try {
      const token = localStorage.getItem('trace_session_token');
      const res = await fetch(apiUrl('/projects/admin/change-lead'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          project_id: leadFormData.projectId,
          old_leader_employee_id: leadFormData.oldLeaderId.trim(),
          new_leader_employee_id: leadFormData.newLeaderId.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Role reassignment constraint error.');

      alert(`Project team leader updated successfully!`);
      setIsModalOpen(false);
      setLeadFormData({ projectId: '', oldLeaderId: '', newLeaderId: '' });
      if (selectedProject) handleProjectClick(selectedProject); 
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading active database index items...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 p-4 md:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* HEADER PANEL CARD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-3xl bg-white p-6 shadow-sm border border-slate-100 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Admin Configuration Dashboard
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              Welcome back, {fullName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Direct access index management tracking for global project instances and registered employees rows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
            >
              <UserCheck className="h-4 w-4" />
              Change Project Leaders
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 transition shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" /> Error message warning constraint: {errorMsg}
          </div>
        )}

        {/* STATUS METRIC CARDS ROW */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Active Projects" value={stats?.total_projects.toString() || "0"} icon={<FolderKanban />} />
          <StatCard title="Registered Employees" value={stats?.total_employees.toString() || "0"} icon={<Users />} />
          <StatCard title="Role Classifications" value={Object.keys(stats?.designation_breakdown || {}).length.toString() || "0"} icon={<Activity />} />
          <StatCard title="System Isolation" value="SECURE" icon={<CheckCircle2 />} />
        </div>

        {/* COMPONENT TAB STRIP SELECTION CONTROLS */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
          <button 
            onClick={() => { setActiveTab('projects'); setSelectedEmployee(null); }}
            className={`pb-3 transition flex items-center gap-2 relative ${activeTab === 'projects' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FolderKanban className="h-4 w-4" />
            Global Projects ({stats?.projects_list?.length || 0})
            {activeTab === 'projects' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          
          <button 
            onClick={() => { setActiveTab('employees'); setSelectedProject(null); }}
            className={`pb-3 transition flex items-center gap-2 relative ${activeTab === 'employees' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Users className="h-4 w-4" />
            All Registered Employees ({stats?.recent_registrations?.length || 0})
            {activeTab === 'employees' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
        </div>

        {/* SPLIT LAYOUT DIRECTORIES */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* LEFT INDEX CONTAINER LISTS COLUMN */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === 'projects' ? (
                <motion.section 
                  key="projects-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-slate-950">Global Active Projects</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Click any active project tile to verify employee team rows and specific role mappings.</p>
                  </div>
                  
                  {stats?.projects_list?.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6">No project items found in database registry storage.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stats?.projects_list?.map((project) => (
                        <div 
                          key={project.id} 
                          onClick={() => handleProjectClick(project)}
                          className={`flex flex-col justify-between rounded-2xl border p-4 transition cursor-pointer group relative ${
                            selectedProject?.id === project.id 
                              ? 'bg-blue-500/5 border-blue-500/40 shadow-sm' 
                              : 'bg-slate-50 border-slate-100 hover:border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-slate-950 flex items-center gap-2 text-base">
                                {project.name}
                                <span className="text-[10px] bg-blue-100 text-blue-700 font-mono px-2 py-0.5 rounded font-bold">{project.project_key}</span>
                              </h3>
                              <p className="text-[10px] font-mono text-slate-400 mt-1">ID: {project.id}</p>
                            </div>
                            
                            <button
                              onClick={(e) => handleForceDeleteProject(project.id, project.name, e)}
                              className="p-2 text-red-500 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white transition opacity-60 group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="mt-4 flex items-center justify-between text-xs text-blue-500 font-medium">
                            <span className="flex items-center gap-1">
                              Show Project Members <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              ) : (
                <motion.section 
                  key="employees-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-slate-950">Active Employee Registry</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Select a staff row entry to display specific profile roles, tags, and credential information metadata records.</p>
                  </div>

                  {stats?.recent_registrations.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6">No employee columns found inside persistent data stacks.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats?.recent_registrations.map((user) => (
                        <div 
                          key={user.employee_id} 
                          onClick={() => handleEmployeeClick(user)}
                          className={`flex items-center justify-between rounded-2xl border p-4 transition cursor-pointer group ${
                            selectedEmployee?.employee_id === user.employee_id
                              ? 'bg-blue-500/5 border-blue-500/40 shadow-sm'
                              : 'bg-slate-50 border-slate-100 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-sm text-blue-500 border">
                              {user.full_name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-950 flex items-center gap-2 text-sm">
                                {user.full_name}
                                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">ID: {user.employee_id}</span>
                              </h3>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleForceDeleteUser(user.employee_id, e)}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT METRICS DETAIL DRILL-DOWN CONTAINER SIDEBAR PANEL */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              
              {/* COMPONENT SUBVIEW CHANNELS 1: LIST ACTIVE SELECTED PROJECT TEAM MEMEBERS */}
              {activeTab === 'projects' && selectedProject && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 space-y-4"
                >
                  <div className="border-b pb-3">
                    <span className="text-[10px] font-bold text-blue-500 tracking-wider uppercase">Project Members</span>
                    <h2 className="text-xl font-bold mt-0.5 text-slate-950">{selectedProject.name}</h2>
                    <p className="text-xs font-mono text-slate-400 truncate">ID: {selectedProject.id}</p>
                  </div>

                  {isMembersLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      <span className="text-xs">Querying members data loop...</span>
                    </div>
                  ) : projectMembers.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No assigned project members present in this repository rows view.</p>
                  ) : (
                    <div className="space-y-3">
                      {projectMembers.map((member) => (
                        <div key={member.employee_id} className="p-3 rounded-2xl bg-slate-50 border flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{member.full_name}</p>
                            <p className="text-xs text-slate-400">{member.designation}</p>
                          </div>
                          
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                            member.project_role === 'Team Leader'
                              ? 'bg-amber-100 text-amber-800 border border-amber-500/20' 
                              : 'bg-blue-100 text-blue-800 border border-blue-500/10'
                          }`}>
                            {member.project_role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* COMPONENT SUBVIEW CHANNELS 2: DYNAMIC INDIVIDUAL EMPLOYEE PROFILE PARAMETERS DETAILS CARD */}
              {activeTab === 'employees' && selectedEmployee && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 space-y-4"
                >
                  <div className="border-b pb-4 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-2xl mx-auto mb-2">
                      {selectedEmployee.full_name.charAt(0)}
                    </div>
                    <h2 className="text-lg font-bold text-slate-950">{selectedEmployee.full_name}</h2>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-400 px-2 py-0.5 rounded">Corporate ID: {selectedEmployee.employee_id}</span>
                  </div>

                  {isEmployeeLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      <span className="text-xs">Fetching profile details...</span>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                        <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Primary Email Address</p>
                          <p className="font-mono text-slate-950 truncate">{selectedEmployee.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                        <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Designation & Department Context</p>
                          <p className="font-bold text-slate-950">{selectedEmployee.designation || 'Software Architect'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{selectedEmployee.department || 'Product Development Infrastructure'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Roster Registration Creation Timestamp</p>
                          <p className="font-mono text-slate-950">
                            {selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-blue-500" /> Active Employee Skills Tags
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(selectedEmployee.skills || ['Python', 'FastAPI', 'React', 'TypeScript', 'PostgreSQL']).map((skill, idx) => (
                            <span key={idx} className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* UNSELECTED PLACEHOLDER SUMMARY INTRO HINT PROMPT CONTAINER */}
              {((activeTab === 'projects' && !selectedProject) || (activeTab === 'employees' && !selectedEmployee)) && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2 py-24 bg-white/20"
                >
                  <Shield className="h-8 w-8 text-slate-300" />
                  <h3 className="text-sm font-semibold text-slate-700 mt-1">No Active Selection Context</h3>
                  <p className="text-xs max-w-[200px] mx-auto leading-relaxed">
                    Click on an entry tile layout row from the left navigation index directory to open configuration details subview tables.
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* SWAP AGILITY TEAM LEADERSHIP FORM REGISTRY BLOCK (MODAL OVERLAY LAYERS) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xl font-bold flex items-center gap-2 text-slate-950"><UserCheck className="text-blue-500" /> Change Project Leader</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleTransferLeadershipSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Target Project Context Workspace</span>
                <select 
                  required 
                  value={leadFormData.projectId} 
                  onChange={(e) => setLeadFormData({ ...leadFormData, projectId: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-sm text-slate-900 bg-transparent"
                >
                  <option value="">-- Choose Active Project --</option>
                  {stats?.projects_list?.map(p => (
                    <option key={p.id} value={p.id}>{p.name} [{p.project_key}]</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Current Leader ID</span>
                <input required type="text" value={leadFormData.oldLeaderId} onChange={(e) => setLeadFormData({ ...leadFormData, oldLeaderId: e.target.value })} placeholder="e.g. EMP001" className="w-full rounded-xl border p-2.5 text-sm text-slate-900 bg-transparent" />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">New Leader Employee ID</span>
                <input required type="text" value={leadFormData.newLeaderId} onChange={(e) => setLeadFormData({ ...leadFormData, newLeaderId: e.target.value })} placeholder="e.g. EMP002" className="w-full rounded-xl border p-2.5 text-sm text-slate-900 bg-transparent" />
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm shadow-md">
                Commit Leader Change
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <h2 className="mt-2 text-3xl font-extrabold text-blue-600">{value}</h2>
      </div>
      <div className="text-blue-500 bg-blue-50 p-3 rounded-2xl shrink-0">
        {icon}
      </div>
    </div>
  );
}
