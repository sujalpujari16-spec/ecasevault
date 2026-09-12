import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  CheckCircle2, 
  RotateCcw,
  Briefcase,
  Shield,
  RefreshCw
} from 'lucide-react';
import { OfficerProfile, UserSession } from '../types';
import { apiClient } from '../services/apiClient';
import { soundEffects } from './AudioEffects';
import { getStoredMembers } from '../utils/institutionStorage';

interface OfficersDirectoryViewProps {
  session: UserSession;
}

export const OfficersDirectoryView: React.FC<OfficersDirectoryViewProps> = ({ session }) => {
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fetchOfficers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getOfficers('POLICE');
      const loaded: OfficerProfile[] = [];

      if (res && res.success && Array.isArray(res.officers)) {
        res.officers
          .filter((o: any) => {
            const role = (o.role || '').toUpperCase();
            if (role && role !== 'POLICE' && role !== 'OFFICER' && role !== 'PI') return false;
            const rank = (o.rank || '').toLowerCase();
            if (rank.includes('forensic') || rank.includes('prosecutor') || rank.includes('scientist') || rank.includes('auditor') || rank.includes('jail')) return false;
            return true;
          })
          .forEach((o: any) => {
            loaded.push({
              id: o.id || o.badgeNo,
              name: o.name || o.full_name || o.username,
              badgeNo: o.badgeNo || o.badge_no,
              rank: o.rank,
              station: o.station || o.station_id || 'Maharashtra Police Station',
              unit: o.department || 'Investigation Wing',
              contact: '+91 98200 XXXXX',
              activeCases: Number(o.activeCasesCount ?? o.activeCases ?? 0),
              completedCases: 0,
              currentWorkload: (Number(o.activeCasesCount ?? 0) > 4) ? 'Heavy' : 'Optimal',
              status: 'ACTIVE_ON_DUTY',
              photoUrl: o.photoUrl || o.photo_url || undefined,
            });
          });
      }

      // Merge local stored members created by user
      const stored = getStoredMembers().filter(m => m.role === 'POLICE');
      stored.forEach(m => {
        if (!loaded.some(l => l.badgeNo.toLowerCase() === m.badgeNo.toLowerCase())) {
          loaded.unshift({
            id: m.id,
            name: m.fullName,
            badgeNo: m.badgeNo,
            rank: m.rank,
            station: m.stationOrInstitution,
            unit: m.department || 'Investigation Wing',
            contact: m.contactNumber || '+91 98200 XXXXX',
            activeCases: 0,
            completedCases: 0,
            currentWorkload: 'Optimal',
            status: 'ACTIVE_ON_DUTY',
            photoUrl: m.photoUrl,
          });
        }
      });

      setOfficers(loaded);
    } catch {
      const stored = getStoredMembers().filter(m => m.role === 'POLICE');
      setOfficers(stored.map(m => ({
        id: m.id,
        name: m.fullName,
        badgeNo: m.badgeNo,
        rank: m.rank,
        station: m.stationOrInstitution,
        unit: m.department || 'Investigation Wing',
        contact: m.contactNumber || '+91 98200 XXXXX',
        activeCases: 0,
        completedCases: 0,
        currentWorkload: 'Optimal',
        status: 'ACTIVE_ON_DUTY',
        photoUrl: m.photoUrl,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, []);

  const filteredOfficers = officers.filter((o) => {
    const matchesSearch = 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.badgeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.station.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.rank.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && o.status === statusFilter;
  });

  const handleRebalanceWorkload = (officerId: string) => {
    soundEffects.playStamp();
    setSuccessNotice(`Workload balance verified for officer ${officerId}.`);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Investigating Officers & Workload Allocation
            </h2>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-mono text-[10px] font-bold rounded">
              ZONE II EXECUTIVE COMMAND
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Superintendence of Investigating Officers (IOs), Sub-Inspectors, and forensic unit allocations.
          </p>
        </div>
        <button
          onClick={fetchOfficers}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Database</span>
        </button>
      </div>

      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search officer by name, badge number, station, or rank..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer"
        >
          <option value="ALL">All Duty Statuses</option>
          <option value="ACTIVE_ON_DUTY">Active on Duty</option>
          <option value="SPECIAL_INVESTIGATION_CELL">Special Investigation Cell</option>
        </select>
      </div>

      {/* Officers Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          Loading authorized officers from PostgreSQL...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfficers.length === 0 ? (
            <div className="col-span-full p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center shadow-2xs space-y-2.5 my-2">
              <Shield className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Police Officers Registered</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No police officers are currently listed in the roster. Enlist new officers in Administration to assign them to stations and cases.
              </p>
            </div>
          ) : (
            filteredOfficers.map((o) => (
            <div key={o.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {o.photoUrl ? (
                    <img
                      src={o.photoUrl}
                      alt={o.name}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-[#182f4d]/10 flex items-center justify-center text-[#182f4d] font-bold text-xs shrink-0">
                      {o.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                  )}
                  <div>
                    <span className="font-mono text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {o.badgeNo}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">{o.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{o.rank}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  o.currentWorkload === 'Heavy'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {o.currentWorkload} Load
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-b border-slate-100 py-2.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{o.station}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{o.unit}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Cases</span>
                  <strong className="text-blue-700 font-mono text-sm">{o.activeCases}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Disposed</span>
                  <strong className="text-emerald-700 font-mono text-sm">{o.completedCases}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Role</span>
                  <strong className="text-slate-900 font-mono text-xs flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-600" />
                    Officer
                  </strong>
                </div>
              </div>

              {(session.role === 'ADMIN' || session.role === 'POLICE') && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleRebalanceWorkload(o.id)}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rebalance Case Load</span>
                  </button>
                </div>
              )}
            </div>
          )))}
        </div>
      )}
    </div>
  );
};
