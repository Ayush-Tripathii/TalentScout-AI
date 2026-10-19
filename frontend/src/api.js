// TalentScout AI — Frontend API Client
// Connects to local FastAPI backend (http://127.0.0.1:8000)

const BASE_URL = '/api';

let cachedCsrfToken = null;

export async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/auth/csrf-token');
    const json = await res.json();
    if (json?.csrf_token) {
      cachedCsrfToken = json.csrf_token;
      return cachedCsrfToken;
    }
  } catch (e) {
    console.warn('Failed to retrieve CSRF token:', e);
  }
  return null;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (cachedCsrfToken && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = cachedCsrfToken;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errDetail = `HTTP ${res.status}`;
      try {
        const rawText = await res.text();
        try {
          const errJson = JSON.parse(rawText);
          errDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
          errDetail = rawText || `HTTP ${res.status}`;
        }
      } catch {
        // Stream read error fallback
      }
      throw new Error(errDetail);
    }

    // Check if JSON response
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await res.json();
      if (json && typeof json === 'object') {
        if ('data' in json) {
          if (Array.isArray(json.data)) {
            // Attach top-level response properties to the array so both array methods and response fields work
            try {
              Object.assign(json.data, {
                status: json.status,
                count: json.count,
                stats: json.stats,
                ranked_count: json.ranked_count ?? json.count ?? json.data.length,
                data: json.data,
              });
            } catch (e) {
              // Ignore non-extensible array
            }
            return json.data;
          }
          if (typeof json.data === 'object' && json.data !== null) {
            // If data is an object, ensure .data and status exist on it for components expecting res.data
            if (!('data' in json.data)) {
              json.data.data = json.data;
            }
            if (!('status' in json.data) && json.status) {
              json.data.status = json.status;
            }
            if (!('message' in json.data) && json.message) {
              json.data.message = json.message;
            }
            return json.data;
          }
        }
      }
      return json;
    }
    return res;

  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  // Stats
  getStats: () => request('/stats'),

  // Jobs
  getJobs: () => request('/jobs'),
  createJob: (jobData) => request('/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData),
  }),
  parseJD: (jdText) => request('/jobs/parse-jd', {
    method: 'POST',
    body: JSON.stringify({ jd_text: jdText }),
  }),

  // Sourcing & Queries
  getQueries: (jobId, contactVisible = false) => request(`/sourcing/queries/${jobId}?contact_visible=${contactVisible}`),
  executeSearch: (jobId, platform, queryText, limit = 10) => request('/sourcing/execute', {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      platform: platform,
      query_text: queryText,
      limit: Number(limit),
    }),
  }),
  getCandidates: (jobId, minScore = null) => {
    const qs = (minScore !== null && minScore !== undefined) ? `?min_score=${encodeURIComponent(minScore)}` : '';
    return request(`/sourcing/candidates/${jobId}${qs}`);
  },


  // Pipeline & Ranking
  getPipeline: (jobId, minScore = null) => {
    const qs = (minScore !== null && minScore !== undefined) ? `?min_score=${encodeURIComponent(minScore)}` : '';
    return request(`/pipeline/${jobId}${qs}`);
  },
  evaluateAllRanking: (jobId) => request(`/ranking/evaluate-all/${jobId}`, {
    method: 'POST',
  }),
  updateCandidateStage: (jobId, candidateId, newStage) => request(`/pipeline/${jobId}/stage`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, new_stage: newStage }),
  }),
  updateCandidateNotes: (candidateId, notes) => request(`/candidates/${candidateId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  }),

  // Resumes
  getResumes: () => request('/resumes'),
  scanWatchFolder: () => request('/resumes/scan-watch-folder', {
    method: 'POST',
  }),
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/resumes/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to upload resume');
    }
    return await res.json();
  },

  // Deduplication
  getDedupSuggestions: () => request('/dedup/suggestions'),
  resolveDedup: (primaryId, secondaryId, action = 'confirm', linkId = null) => request('/dedup/resolve', {
    method: 'POST',
    body: JSON.stringify({ 
      primary_id: primaryId, 
      secondary_id: secondaryId,
      action: action,
      link_id: linkId
    }),
  }),

  // Exports
  getExportExcelUrl: (jobId) => `${BASE_URL}/export/${jobId}/excel`,
  getExportCsvUrl: (jobId) => `${BASE_URL}/export/${jobId}/csv`,

  // Settings & Engine Keys
  getSettingsKeys: () => request('/settings/keys'),
  saveSettingsKeys: (keys) => request('/settings/keys', {
    method: 'POST',
    body: JSON.stringify(keys),
  }),
  testSettingsKey: (provider, key) => request('/settings/keys/test', {
    method: 'POST',
    body: JSON.stringify({ provider, key }),
  }),

  // Phase 5: Contact Acquisition & Enrichment
  pasteCaptureContact: (data) => request('/contacts/paste-capture', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getContactQueue: (jobId) => request(`/contacts/queue/${jobId}`),
  getEnrichmentStatus: () => request('/enrichment/status'),
  revealContact: (candidateId, provider = 'hunter') => request('/enrichment/reveal', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, provider }),
  }),

  // Phase 6: Outreach, Job Postings & Consent Forms
  generateOutreach: (candidateId, jobId, recruiterName, companyName, baseFormUrl) => request('/outreach/generate', {
    method: 'POST',
    body: JSON.stringify({
      candidate_id: candidateId,
      job_id: jobId,
      recruiter_name: recruiterName,
      company_name: companyName,
      base_form_url: baseFormUrl,
    }),
  }),
  recordOutreach: (data) => request('/outreach/record', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getOutreachHistory: (candidateId) => request(`/outreach/history/${candidateId}`),
  getJobPostings: (jobId, companyName, applicationUrl) => {
    const params = new URLSearchParams();
    if (companyName) params.append('company_name', companyName);
    if (applicationUrl) params.append('application_url', applicationUrl);
    return request(`/job-posts/${jobId}?${params.toString()}`);
  },
  getCareersPageUrl: (jobId, companyName) => {
    const params = new URLSearchParams();
    if (companyName) params.append('company_name', companyName);
    return `${BASE_URL}/job-posts/${jobId}/careers-page?${params.toString()}`;
  },
  submitInterestForm: (formData) => request('/forms/submit', {
    method: 'POST',
    body: JSON.stringify(formData),
  }),
  getFormResponses: (jobId) => {
    const q = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
    return request(`/forms/responses${q}`);
  },
  syncGoogleSheets: (sheetUrl, jobId) => request('/forms/sync-sheets', {
    method: 'POST',
    body: JSON.stringify({ sheet_url: sheetUrl, job_id: jobId }),
  }),

  // Phase 7: Compliance, Operations & Audit
  getRetentionStatus: (days = 180) => request(`/compliance/retention-status?days=${days}`),
  purgeExpiredRecords: (performedBy = 'Admin') => request(`/compliance/retention-purge?performed_by=${encodeURIComponent(performedBy)}`, {
    method: 'POST',
  }),
  setCandidateDNC: (candidateId, dnc = true, reason = '', performedBy = 'Recruiter') => request(`/compliance/candidates/${candidateId}/dnc`, {
    method: 'POST',
    body: JSON.stringify({ do_not_contact: dnc, reason, performed_by: performedBy }),
  }),
  eraseCandidate: (candidateId, reason = 'DPDP Act Right to Erasure', performedBy = 'Recruiter') => request(`/compliance/candidates/${candidateId}/erase?reason=${encodeURIComponent(reason)}&performed_by=${encodeURIComponent(performedBy)}`, {
    method: 'DELETE',
  }),
  getOperationsMetrics: () => request('/operations/metrics'),
  getAuditLogs: (action = null, entityType = null, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    if (action) params.append('action', action);
    if (entityType) params.append('entity_type', entityType);
    params.append('limit', limit);
    params.append('offset', offset);
    return request(`/audit/logs?${params.toString()}`);
  },
  getSystemConfig: () => request('/settings/config'),
  updateSystemConfig: (configUpdates) => request('/settings/config', {
    method: 'POST',
    body: JSON.stringify(configUpdates),
  }),

  // Phase 8: Automated Background Sourcing & Alerts
  getSchedules: () => request('/scheduler/jobs'),
  getJobSchedule: (jobId) => request(`/scheduler/jobs/${jobId}`),
  configureSchedule: (jobId, config) => request(`/scheduler/jobs/${jobId}/configure`, {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  toggleSchedule: (jobId, isEnabled) => request(`/scheduler/jobs/${jobId}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ is_enabled: isEnabled }),
  }),
  triggerScheduleRun: (jobId) => request(`/scheduler/jobs/${jobId}/trigger`, {
    method: 'POST',
  }),
  getAlertNotifications: (jobId = null, unreadOnly = false, limit = 50) => {
    const params = new URLSearchParams();
    if (jobId) params.append('job_id', jobId);
    if (unreadOnly) params.append('unread_only', 'true');
    params.append('limit', limit);
    return request(`/alerts/notifications?${params.toString()}`);
  },
  markNotificationRead: (notificationId) => request(`/alerts/notifications/${notificationId}/read`, {
    method: 'POST',
  }),
  markAllNotificationsRead: () => request('/alerts/notifications/mark-all-read', {
    method: 'POST',
  }),
  testWebhook: (webhookUrl) => request('/alerts/test-webhook', {
    method: 'POST',
    body: JSON.stringify({ webhook_url: webhookUrl }),
  }),

  // CMS & Admin Portal
  getCmsContent: () => request('/cms/content'),
  adminLogin: (email, password) => request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  getAdminOverview: (token) => request('/admin/overview', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),
  updateCmsContent: (cmsData, token) => request('/cms/content', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(cmsData),
  }),
  toggleUserStatus: (userId, isActive, token) => request('/admin/users/toggle-status', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ user_id: userId, is_active: isActive }),
  }),
  createAdminUser: (userData, token) => request('/admin/users', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(userData),
  }),
  updateAdminUser: (userId, userData, token) => request(`/admin/users/${userId}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(userData),
  }),
  regenerateUserKey: (userId, token) => request(`/admin/users/${userId}/regenerate-key`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),
  deleteAdminUser: (userId, token) => request(`/admin/users/${userId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),
  getAdminCandidates: (query = '', token) => request(`/admin/candidates?query=${encodeURIComponent(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),
  deleteAdminCandidate: (candidateId, token) => request(`/admin/candidates/${candidateId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),
  purgeAllAdminCandidates: (token) => request('/admin/candidates/purge-all', {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }),

  // Advanced Security, Threat Defense & Email OTP Verification
  getCsrfToken: () => request('/auth/csrf-token'),
  sendOtp: (otpData) => request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify(otpData),
  }),
  verifyOtp: (verifyData) => request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(verifyData),
  }),
  validateApiKey: (apiKey, provider = 'generic') => request('/auth/validate-api-key', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey, provider }),
  }),
};
