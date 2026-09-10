import React, { useState, useEffect } from 'react';
import { User, StudentGroup } from '../../types';
import { executeGasAction } from '../../services/api';
import {
  Users,
  FolderPlus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  CheckSquare,
  Square,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

interface StudentGroupsManagementProps {
  onRefreshParent?: () => void;
}

export const StudentGroupsManagement: React.FC<StudentGroupsManagementProps> = ({ onRefreshParent }) => {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIdInput, setGroupIdInput] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentFilter, setStudentFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // View Members Modal
  const [viewingGroup, setViewingGroup] = useState<StudentGroup | null>(null);

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, studentsRes] = await Promise.all([
        executeGasAction('getGroups', {}),
        executeGasAction('getStudents', {}),
      ]);

      if (groupsRes.success && groupsRes.data?.groups) {
        setGroups(groupsRes.data.groups);
      } else if (groupsRes.success && (groupsRes as any).groups) {
        setGroups((groupsRes as any).groups);
      }

      if (studentsRes.success && studentsRes.data?.students) {
        setStudents(studentsRes.data.students);
      } else if (studentsRes.success && (studentsRes as any).students) {
        setStudents((studentsRes as any).students);
      }
    } catch (err) {
      console.error('Error loading groups or students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupIdInput(`GRP-${Math.floor(100 + Math.random() * 900)}`);
    setDescription('');
    setSelectedStudentIds([]);
    setStudentFilter('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (group: StudentGroup) => {
    setEditingGroupId(group.GroupId);
    setGroupName(group.Name);
    setGroupIdInput(group.GroupId);
    setDescription(group.Description || '');
    setSelectedStudentIds([...group.StudentIds]);
    setStudentFilter('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleToggleStudent = (sId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSelectAllFilteredStudents = (filteredList: User[]) => {
    const filteredIds = filteredList.map((s) => s.UserId);
    const allSelected = filteredIds.every((id) => selectedStudentIds.includes(id));

    if (allSelected) {
      // Deselect filtered
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      const union = Array.from(new Set([...selectedStudentIds, ...filteredIds]));
      setSelectedStudentIds(union);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setFormError('Group Name is required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      if (editingGroupId) {
        // Update group
        const res = await executeGasAction('updateGroup', {
          groupId: editingGroupId,
          name: groupName.trim(),
          description: description.trim(),
          studentIds: selectedStudentIds,
        });

        if (res.success) {
          setFormSuccess(`Group "${groupName.trim()}" updated successfully.`);
          await fetchData();
          if (onRefreshParent) onRefreshParent();
          setTimeout(() => {
            setIsModalOpen(false);
            setFormSuccess(null);
          }, 1200);
        } else {
          setFormError(res.error || 'Failed to update group.');
        }
      } else {
        // Create new group
        const res = await executeGasAction('createGroup', {
          groupId: groupIdInput.trim().toUpperCase(),
          name: groupName.trim(),
          description: description.trim(),
          studentIds: selectedStudentIds,
        });

        if (res.success) {
          setFormSuccess(`Group "${groupName.trim()}" created with ${selectedStudentIds.length} candidate(s).`);
          await fetchData();
          if (onRefreshParent) onRefreshParent();
          setTimeout(() => {
            setIsModalOpen(false);
            setFormSuccess(null);
          }, 1200);
        } else {
          setFormError(res.error || 'Failed to create group.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving group.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the group "${name}" (${groupId})? Assigned exams will fallback to their standard configurations.`)) {
      return;
    }

    setDeletingId(groupId);
    try {
      const res = await executeGasAction('deleteGroup', { groupId });
      if (res.success) {
        setGroups((prev) => prev.filter((g) => g.GroupId !== groupId));
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res.error || 'Failed to delete group.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting group.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGroups = groups.filter(
    (g) =>
      g.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.GroupId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.Description && g.Description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const studentSearchFiltered = students.filter(
    (s) =>
      s.UserId.toLowerCase().includes(studentFilter.toLowerCase()) ||
      s.Name.toLowerCase().includes(studentFilter.toLowerCase())
  );

  const getStudentName = (sId: string) => {
    const found = students.find((s) => s.UserId.toUpperCase() === sId.toUpperCase());
    return found ? found.Name : sId;
  };

  return (
    <div id="student-groups-management" className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Student Cohort & Batch Groups</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize candidates into custom batches, laboratory sections, or remedial cohorts to assign targeted assessments.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              id="refresh-groups-btn"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Refresh Groups"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              id="create-group-btn"
              onClick={openCreateModal}
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors shadow-xs"
            >
              <FolderPlus className="w-4 h-4 mr-1.5" />
              Create Group
            </button>
          </div>
        </div>

        {/* Quick Info Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 border border-slate-200/60 rounded-md p-3">
            <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px]">Total Groups</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{groups.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 rounded-md p-3">
            <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px]">Enrolled Candidates</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{students.length} Total</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 rounded-md p-3">
            <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px]">Targeted Exam Mode</span>
            <span className="text-xs font-medium text-emerald-700 mt-1 block flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Active in Exam Creator
            </span>
          </div>
        </div>
      </div>

      {/* Main Groups Table Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-groups-input"
              type="text"
              placeholder="Search groups by name, ID, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium self-center">
            Showing <span className="font-semibold text-slate-800">{filteredGroups.length}</span> of {groups.length} groups
          </div>
        </div>

        {/* Groups List */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <span className="text-xs font-medium">Loading groups roster...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No student groups found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No group matched "${searchQuery}". Try clearing your search.`
                : 'Create your first candidate cohort to assign specific exams.'}
            </p>
            {!searchQuery && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                Create Group Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Group Identification</th>
                  <th className="py-3 px-4">Description / Scope</th>
                  <th className="py-3 px-4">Assigned Candidates</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => {
                  const studentCount = group.StudentIds?.length || 0;
                  return (
                    <tr key={group.GroupId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                            {group.Name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 text-xs block">{group.Name}</span>
                            <span className="font-mono text-[10px] text-slate-500 block">{group.GroupId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {group.Description || <span className="text-slate-400 italic">No description provided</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            studentCount > 0
                              ? 'bg-blue-50 text-blue-800 border border-blue-200/60'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          }`}>
                            <Users className="w-3 h-3 mr-1" />
                            {studentCount} candidate{studentCount !== 1 ? 's' : ''}
                          </span>
                          {studentCount > 0 && (
                            <button
                              onClick={() => setViewingGroup(group)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline inline-flex items-center"
                            >
                              View list
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => openEditModal(group)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                            title="Edit Group"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.GroupId, group.Name)}
                            disabled={deletingId === group.GroupId}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Delete Group"
                          >
                            {deletingId === group.GroupId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingGroupId ? 'Edit Student Group' : 'Create New Student Group'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingGroupId ? `Updating ${editingGroupId}` : 'Define cohort properties and choose candidates.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Batch A - Morning Section"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Group ID / Code
                    </label>
                    <input
                      type="text"
                      disabled={!!editingGroupId}
                      value={groupIdInput}
                      onChange={(e) => setGroupIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. GRP-B1"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 font-mono focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-75"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Description & Purpose (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Undergraduate students enrolled in Tuesday laboratory sessions"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Candidate Selection Section */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-slate-800 font-semibold flex items-center">
                      <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      Select Group Members ({selectedStudentIds.length} chosen)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllFilteredStudents(studentSearchFiltered)}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                      >
                        {studentSearchFiltered.every((s) => selectedStudentIds.includes(s.UserId))
                          ? 'Deselect Filtered'
                          : 'Select Filtered'}
                      </button>
                    </div>
                  </div>

                  {/* Filter candidates */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter student list by name or ID..."
                      value={studentFilter}
                      onChange={(e) => setStudentFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:border-blue-600"
                    />
                  </div>

                  {/* Students Picker Box */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md bg-white divide-y divide-slate-100">
                    {students.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 italic text-[11px]">
                        No student accounts found in database. Add students in the "Student Accounts" tab first.
                      </div>
                    ) : studentSearchFiltered.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 italic text-[11px]">
                        No candidates match "{studentFilter}".
                      </div>
                    ) : (
                      studentSearchFiltered.map((student) => {
                        const isSelected = selectedStudentIds.includes(student.UserId);
                        return (
                          <label
                            key={student.UserId}
                            className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudent(student.UserId)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                              />
                              <div>
                                <span className="font-semibold block text-xs">{student.Name}</span>
                                <span className="font-mono text-[10px] text-slate-500 block">{student.UserId}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors shadow-xs disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Saving Group...
                    </>
                  ) : editingGroupId ? (
                    'Save Group Changes'
                  ) : (
                    'Create Group'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Group Members Modal */}
      {viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{viewingGroup.Name}</h3>
                <p className="text-[11px] text-slate-500 font-mono">{viewingGroup.GroupId} • {viewingGroup.StudentIds.length} candidate(s)</p>
              </div>
              <button
                onClick={() => setViewingGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 text-xs divide-y divide-slate-100">
              {viewingGroup.StudentIds.length === 0 ? (
                <div className="p-6 text-center text-slate-500 italic text-xs">
                  No students are assigned to this group yet. Click "Edit" to assign candidates.
                </div>
              ) : (
                viewingGroup.StudentIds.map((sId, idx) => (
                  <div key={sId} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-slate-400 font-mono text-[10px] w-4">{idx + 1}.</span>
                      <div>
                        <span className="font-semibold text-slate-900 text-xs block">{getStudentName(sId)}</span>
                        <span className="font-mono text-[10px] text-slate-500">{sId}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Enrolled
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingGroup(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
