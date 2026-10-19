import React, { useState, useEffect } from 'react';
import { api } from './api';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CandidateDrawer from './components/CandidateDrawer';
import NewJobModal from './components/NewJobModal';
import ApiKeysModal from './components/ApiKeysModal';
import Toast from './components/Toast';

import DashboardView from './views/DashboardView';
import SourcingView from './views/SourcingView';
import PipelineView from './views/PipelineView';
import ContactQueueView from './views/ContactQueueView';
import ResumeParserView from './views/ResumeParserView';
import DedupView from './views/DedupView';
import OutreachView from './views/OutreachView';
import ComplianceOperationsView from './views/ComplianceOperationsView';
import AutomatedSourcingView from './views/AutomatedSourcingView';
import LandingPage from './views/LandingPage';
import AdminPanel from './views/AdminPanel';
import AuthModal from './components/AuthModal';
import QuickCaptureModal from './components/QuickCaptureModal';
import OutreachModal from './components/OutreachModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('talentscout_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const handleLoginSuccess = (user, target = 'workspace') => {
    setCurrentUser(user);
    if (target === 'admin' || user?.role === 'admin') {
      setIsAdminMode(true);
    } else {
      setIsAdminMode(false);
    }
    loadInitialData();
  };

  const handleLogout = () => {
    localStorage.removeItem('talentscout_auth_user');
    localStorage.removeItem('talentscout_admin_token');
    setCurrentUser(null);
    setIsAdminMode(false);
    showToast('Signed out of TalentScout workspace.', 'info');
  };

  // Modals & Drawers
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureCandidate, setQuickCaptureCandidate] = useState(null);
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [outreachCandidate, setOutreachCandidate] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedRanking, setSelectedRanking] = useState(null);

  const handleOpenQuickCapture = (candidate = null) => {
    setQuickCaptureCandidate(candidate);
    setIsQuickCaptureOpen(true);
  };

  const handleOpenOutreach = (candidate = null) => {
    setOutreachCandidate(candidate || selectedCandidate);
    setIsOutreachModalOpen(true);
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsRefreshing(true);
    try {
      const [statsData, jobsData] = await Promise.all([
        api.getStats().catch((err) => { console.error('Stats error:', err); return null; }),
        api.getJobs().catch((err) => { console.error('Jobs error:', err); return []; }),
      ]);
      const safeJobs = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);
      const safeStats = statsData?.data || statsData;
      setStats(safeStats);
      setJobs(safeJobs);
      if (safeJobs.length > 0 && !selectedJobId) {
        setSelectedJobId(safeJobs[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleJobCreated = (newJob) => {
    setJobs(prev => [newJob, ...prev]);
    setSelectedJobId(newJob.id);
    setActiveTab('sourcing');
    showToast(`Requirement "${newJob.title}" created!`, 'success');
    loadInitialData();
  };

  const handleStageChange = async (candidateId, newStage) => {
    if (!selectedJobId) return;
    try {
      await api.updateCandidateStage(selectedJobId, candidateId, newStage);
      // Update selectedCandidate if currently open
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: newStage, stage: newStage }));
      }
      showToast(`Candidate stage moved to ${newStage}`, 'success');
    } catch (err) {
      showToast('Failed to update candidate stage: ' + err.message, 'error');
    }
  };

  const handleOpenCandidateDrawer = (candidate, ranking = null) => {
    setSelectedCandidate(candidate);
    setSelectedRanking(ranking);
  };

  const currentJob = Array.isArray(jobs) && jobs.length > 0 
    ? (jobs.find(j => j.id === selectedJobId) || jobs[0]) 
    : null;

  // Administrator & CMS Portal View
  if (isAdminMode) {
    return (
      <>
        <AdminPanel 
          onBackToWorkspace={() => setIsAdminMode(false)}
          onBackToLanding={() => {
            setIsAdminMode(false);
            handleLogout();
          }}
          onLogout={handleLogout}
          showToast={showToast}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // Unauthenticated Visitors: High-Converting Animated Landing Page
  if (!currentUser) {
    return (
      <>
        <LandingPage 
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setIsAuthModalOpen(true);
          }}
          onOpenAdmin={() => {
            setAuthMode('admin');
            setIsAuthModalOpen(true);
          }}
          onLoginSuccess={handleLoginSuccess}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          initialMode={authMode}
          showToast={showToast}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
      />

      {/* Main Right Workspace */}
      <div className="main-content">
        <Topbar 
          jobs={jobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
          onOpenKeysModal={() => setIsKeysModalOpen(true)}
          onOpenQuickCapture={() => handleOpenQuickCapture(null)}
          onRefresh={loadInitialData}
          isRefreshing={isRefreshing}
          onNavigate={setActiveTab}
          onSelectCandidate={handleOpenCandidateDrawer}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenAdmin={() => setIsAdminMode(true)}
        />

        {/* View Switcher */}
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'sourcing' && (
          <SourcingView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            onStageChange={handleStageChange}
            onNavigate={setActiveTab}
            onOpenKeysModal={() => setIsKeysModalOpen(true)}
            showToast={showToast}
          />
        )}

        {activeTab === 'automated' && (
          <AutomatedSourcingView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            showToast={showToast}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            onStageChange={handleStageChange}
            showToast={showToast}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactQueueView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            onOpenKeysModal={() => setIsKeysModalOpen(true)}
            showToast={showToast}
          />
        )}

        {activeTab === 'outreach' && (
          <OutreachView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            onOpenOutreachModal={handleOpenOutreach}
            showToast={showToast}
          />
        )}

        {activeTab === 'resumes' && (
          <ResumeParserView
            currentJob={currentJob}
            onSelectCandidate={handleOpenCandidateDrawer}
            showToast={showToast}
          />
        )}

        {activeTab === 'dedup' && (
          <DedupView showToast={showToast} />
        )}

        {activeTab === 'compliance' && (
          <ComplianceOperationsView showToast={showToast} />
        )}
      </div>

      {/* Candidate Detail Drawer */}
      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          ranking={selectedRanking}
          onClose={() => {
            setSelectedCandidate(null);
            setSelectedRanking(null);
          }}
          onUpdateStage={handleStageChange}
          onOpenQuickCapture={(cand) => handleOpenQuickCapture(cand || selectedCandidate)}
          onOpenOutreachModal={handleOpenOutreach}
          onUpdateNotes={(candidateId, notes) => {
            if (selectedCandidate && selectedCandidate.id === candidateId) {
              setSelectedCandidate(prev => ({ ...prev, recruiter_notes: notes }));
            }
            showToast('Recruiter notes saved successfully!', 'success');
          }}
        />
      )}

      {/* New Job Requirement Modal */}
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
        onJobCreated={handleJobCreated}
        showToast={showToast}
      />

      {/* Real-Time Sourcing Engine & API Keys Modal */}
      <ApiKeysModal
        isOpen={isKeysModalOpen}
        onClose={() => setIsKeysModalOpen(false)}
        showToast={showToast}
      />

      {/* Global & Candidate Quick Capture Modal */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        candidate={quickCaptureCandidate}
        currentJob={currentJob}
        onCaptureSuccess={() => {
          showToast('Candidate contact points saved successfully!', 'success');
          loadInitialData();
        }}
        showToast={showToast}
      />

      {/* Multi-Channel Outreach Pitch Modal */}
      <OutreachModal
        isOpen={isOutreachModalOpen}
        onClose={() => setIsOutreachModalOpen(false)}
        candidate={outreachCandidate}
        job={currentJob}
        showToast={showToast}
      />

      {/* Floating Modern Notification Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
