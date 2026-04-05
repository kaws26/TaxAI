import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../utils/api';

export default function Filing() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state for new job
  const [formData, setFormData] = useState({
    profile_type: 'individual',
    regime: 'auto',
    financial_year: '2025-26', // Default to current FY
    full_name: user?.name || '',
    pan: user?.pancard_number || '',
    deduction_80c: '',
    deduction_80d: '',
    advance_tax: '',
  });

  // Fetch options (profile types, regimes, etc)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tax-assistant/options`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        const data = await response.json();
        setOptions(data);
        // Set default financial year
        if (data.default_financial_year) {
          setFormData((prev) => ({
            ...prev,
            financial_year: data.default_financial_year,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      }
    };
    fetchOptions();
  }, []);

  // Fetch jobs list
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/tax-assistant/jobs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      const data = await response.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    try {
      const payload = {
        profile_type: formData.profile_type,
        regime: formData.regime,
        financial_year: formData.financial_year,
        full_name: formData.full_name,
        pan: formData.pan,
      };

      if (formData.deduction_80c) payload.deduction_80c = parseFloat(formData.deduction_80c);
      if (formData.deduction_80d) payload.deduction_80d = parseFloat(formData.deduction_80d);
      if (formData.advance_tax) payload.advance_tax = parseFloat(formData.advance_tax);

      const response = await fetch(`${API_BASE_URL}/api/tax-assistant/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setSelectedJob(data.job);
        setView('detail');
        setShowNewForm(false);
        fetchJobs();
      } else {
        alert(data.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Error creating job');
    }
  };

  const handleJobSelect = (job) => {
    setSelectedJob(job);
    setView('detail');
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      created: { bg: '#f5f3ed', text: '#8a867f' },
      documents_uploaded: { bg: '#bfdbfe', text: '#1e40af' },
      processing: { bg: '#fcd34d', text: '#92400e' },
      processed: { bg: '#bbf7d0', text: '#065f46' },
      review: { bg: '#fcd34d', text: '#92400e' },
      approved: { bg: '#2d5a3a', text: '#fff' },
      exported: { bg: '#2d5a3a', text: '#fff' },
      filed: { bg: '#2d5a3a', text: '#fff' },
    };

    const style = statusStyles[status] || statusStyles.created;

    return (
      <span
        className="inline-block px-3 py-1"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          backgroundColor: style.bg,
          color: style.text,
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <AppLayout pageTitle="Filing" breadcrumb={['Home', 'Filing']}>
      {view === 'list' ? (
        <>
          {/* Header with New Filing Button */}
          <div className="flex justify-between items-center mb-8">
            <h2
              style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: "2rem",
                fontWeight: 600,
                color: "#1a1816",
              }}
            >
              My Tax Filings
            </h2>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="px-6 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              New Filing
            </button>
          </div>

          {/* New Filing Form */}
          {showNewForm && (
            <div className="bg-white border border-[#e0ddd6] p-8 mb-8">
              <h3
                className="mb-6"
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#1a1816",
                }}
              >
                Create New Filing
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Profile Type
                  </label>
                  <select
                    value={formData.profile_type}
                    onChange={(e) => setFormData({ ...formData, profile_type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none relative z-10"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                      appearance: "auto",
                    }}
                  >
                    {options?.profile_types?.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Tax Regime
                  </label>
                  <select
                    value={formData.regime}
                    onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none relative z-10"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                      appearance: "auto",
                    }}
                  >
                    {options?.regimes?.map((regime) => (
                      <option key={regime} value={regime}>
                        {regime.charAt(0).toUpperCase() + regime.slice(1)} Regime
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Financial Year
                  </label>
                  <select
                    value={formData.financial_year}
                    onChange={(e) => setFormData({ ...formData, financial_year: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none relative z-10"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                      appearance: "auto",
                    }}
                  >
                    <option value="">Select Financial Year...</option>
                    {(options?.financial_years || ['2025-26', '2024-25', '2023-24']).map((fy) => (
                      <option key={fy} value={fy}>
                        FY {fy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    PAN
                  </label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none uppercase"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                    }}
                    maxLength={10}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Section 80C Deduction (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.deduction_80c}
                    onChange={(e) => setFormData({ ...formData, deduction_80c: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Section 80D Deduction (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.deduction_80d}
                    onChange={(e) => setFormData({ ...formData, deduction_80d: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#1a1816",
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Advance Tax Paid (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.advance_tax}
                    onChange={(e) => setFormData({ ...formData, advance_tax: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateJob}
                  className="flex-1 py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Create Filing
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="flex-1 py-4 border-2 border-[#e0ddd6] text-[#1a1816] hover:bg-[#f5f3ed] transition-colors"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Jobs List */}
          {loading ? (
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "1rem",
                color: "#8a867f",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              Loading filings...
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white border border-[#e0ddd6] p-12 text-center">
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "1rem",
                  color: "#8a867f",
                  marginBottom: "1rem",
                }}
              >
                No tax filings yet. Create your first filing to get started.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#e0ddd6] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f3ed] border-b border-[#e0ddd6]">
                    {['Financial Year', 'Profile Type', 'Regime', 'Status', 'Created', 'Actions'].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-6 py-4 text-left"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "#1a1816",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.job_id} className="border-b border-[#e0ddd6] hover:bg-[#fafaf7] transition-colors">
                      <td
                        className="px-6 py-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          color: "#1a1816",
                        }}
                      >
                        {job.financial_year}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          color: "#1a1816",
                        }}
                      >
                        {job.profile_type}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          color: "#1a1816",
                        }}
                      >
                        {job.regime}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                      <td
                        className="px-6 py-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          color: "#8a867f",
                        }}
                      >
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleJobSelect(job)}
                          className="px-4 py-2 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <JobDetail job={selectedJob} onBack={() => setView('list')} onJobUpdate={fetchJobs} />
      )}
    </AppLayout>
  );
}

// Job Detail Component
function JobDetail({ job, onBack, onJobUpdate }) {
  const [currentJob, setCurrentJob] = useState(job || {});
  const [documents, setDocuments] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [reviewState, setReviewState] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [processResponse, setProcessResponse] = useState(null);

  // Debug log
  useEffect(() => {
    console.log('JobDetail received job:', job);
    setCurrentJob(job || {});
  }, [job]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');

        // Fetch options
        const optResponse = await fetch(`${API_BASE_URL}/api/tax-assistant/options`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!optResponse.ok) throw new Error('Failed to fetch options');
        const optData = await optResponse.json();
        setOptions(optData);

        // Use the passed job's job_id (backend uses job_id, not id)
        const jobId = job.job_id || job.id;
        if (!jobId) {
          console.error('No job ID found in:', job);
          setCurrentJob(job);
          return;
        }

        // Documents are already included in the job object
        setDocuments(Array.isArray(job.documents) ? job.documents : []);

        // Fetch review state if status is review or approved
        if (job.status === 'review' || job.status === 'approved') {
          const revResponse = await fetch(
            `${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/review`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const revData = await revResponse.json();
          setReviewState(revData);
        }

        setCurrentJob(job);
      } catch (error) {
        console.error('Failed to fetch job details:', error);
        setCurrentJob(job);
      }
    };

    fetchData();
  }, [job, job.job_id, job.id]);

  const handleDocumentUpload = async (documentsList) => {
    try {
      setLoading(true);

      // Use job_id (backend uses job_id, not id)
      const jobId = currentJob.job_id || currentJob.id;

      if (!jobId) {
        throw new Error(`Invalid job - no ID found: ${JSON.stringify(currentJob)}`);
      }

      // Upload each document type sequentially
      for (const docItem of documentsList) {
        const docFormData = new FormData();

        // Append document_types and files for each file (counts must match)
        docItem.files.forEach((file) => {
          docFormData.append('document_types', docItem.documentType);
          docFormData.append('files', file);
        });

        const uploadUrl = `${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/documents`;
        console.log('Uploading to:', uploadUrl, 'Document type:', docItem.documentType);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: docFormData,
        });

        const data = await response.json();
        if (response.ok) {
          // Append new documents instead of overwriting
          const newDocs = Array.isArray(data.documents) ? data.documents : [];
          setDocuments(prevDocs => {
            // Merge with existing, avoiding duplicates by id
            const existingIds = new Set(prevDocs.map(d => d.id));
            const uniqueNewDocs = newDocs.filter(d => !existingIds.has(d.id));
            return [...prevDocs, ...uniqueNewDocs];
          });

          // Update currentJob if job data is in response
          if (data.job) {
            setCurrentJob(data.job);
          }
        } else {
          console.error('Upload error for', docItem.documentType, ':', data);

          // Handle token expiration
          if (response.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/auth';
            return;
          }

          throw new Error(data.message || `Failed to upload ${docItem.documentType}`);
        }
      }

      setShowDocumentForm(false);
      alert('All documents uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading documents: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    try {
      setProcessLoading(true);
      const jobId = currentJob.job_id || currentJob.id;
      const response = await fetch(`${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentJob(data.job);
        setProcessResponse(data); // Store response for display

        // Refetch review/tax result data if status is computed, review, or approved
        if (data.job?.status === 'computed' || data.job?.status === 'review' || data.job?.status === 'approved') {
          try {
            const revResponse = await fetch(
              `${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/review`,
              {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
              }
            );
            if (revResponse.ok) {
              const revData = await revResponse.json();
              // Extract review_state if it's nested, otherwise use the whole response
              setReviewState(revData.review_state || revData);
            }
          } catch (error) {
            console.error('Failed to fetch review data:', error);
          }

        
        }

        // Refresh the jobs list so status updates immediately in the list view
        onJobUpdate();

        alert('Documents processed successfully');
      } else {
        alert('Processing failed');
      }
    } catch (error) {
      console.error('Process error:', error);
      alert('Error processing documents');
    } finally {
      setProcessLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setApproveLoading(true);
      const jobId = currentJob.job_id || currentJob.id;
      const response = await fetch(`${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          reviewed_by_user: true,
          notes: 'User confirmed draft values',
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setCurrentJob(data.job);
        onJobUpdate();
        alert('Filing approved successfully');
      } else {
        alert(data.message || 'Approval failed');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('Error approving filing');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const jobId = currentJob.job_id || currentJob.id;
      const response = await fetch(`${API_BASE_URL}/api/tax-assistant/jobs/${jobId}/export/itr-pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ITR_${jobId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      created: { bg: '#f5f3ed', text: '#8a867f' },
      documents_uploaded: { bg: '#bfdbfe', text: '#1e40af' },
      processing: { bg: '#fcd34d', text: '#92400e' },
      processed: { bg: '#bbf7d0', text: '#065f46' },
      review: { bg: '#fcd34d', text: '#92400e' },
      approved: { bg: '#2d5a3a', text: '#fff' },
      exported: { bg: '#2d5a3a', text: '#fff' },
      filed: { bg: '#2d5a3a', text: '#fff' },
    };

    const style = statusStyles[status] || statusStyles.created;

    return (
      <span
        className="inline-block px-3 py-1"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          backgroundColor: style.bg,
          color: style.text,
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <button
            onClick={onBack}
            className="mb-4 text-[#c9a961] hover:text-[#d4b76f] transition-colors"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            ← Back to Filings
          </button>
          <h2
            style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "2rem",
              fontWeight: 600,
              color: "#1a1816",
            }}
          >
            FY {currentJob.financial_year} • {currentJob.profile_type}
          </h2>
        </div>
        <div className="text-right">{getStatusBadge(currentJob.status)}</div>
      </div>

      {/* Document Upload Section (if documents not uploaded) */}
      {(currentJob.status === 'created' ||
        currentJob.status === 'documents_uploaded' ||
        currentJob.status === 'processing' ||
        currentJob.status === 'parsed' ||
        !currentJob.tax_result) && (
        <div className="bg-white border border-[#e0ddd6] p-8 mb-6">
          <h3
            className="mb-4"
            style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#1a1816",
            }}
          >
            Upload Documents
          </h3>

          {documents.length > 0 && (
            <div className="mb-6">
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9375rem",
                  color: "#8a867f",
                  marginBottom: "1rem",
                }}
              >
                Uploaded Documents:
              </p>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-[#f5f3ed] border border-[#e0ddd6]"
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          fontWeight: 500,
                          color: "#1a1816",
                        }}
                      >
                        {doc.filename || doc.document_type}
                      </p>
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.8125rem",
                          color: "#8a867f",
                        }}
                      >
                        {doc.document_type}
                      </p>
                    </div>
                    <span
                      className="px-2 py-1"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor:
                          doc.parse_status === 'success' ? '#bbf7d0' : '#fecaca',
                        color: doc.parse_status === 'success' ? '#065f46' : '#7c2d12',
                        textTransform: "uppercase",
                      }}
                    >
                      {doc.parse_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showDocumentForm ? (
            <button
              onClick={() => setShowDocumentForm(true)}
              className="px-6 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Upload Files
            </button>
          ) : (
            <DocumentUploadForm
              options={options}
              onSubmit={handleDocumentUpload}
              onCancel={() => setShowDocumentForm(false)}
              loading={loading}
            />
          )}

          {documents.length > 0 && !showDocumentForm && (
            <button
              onClick={handleProcess}
              disabled={processLoading}
              className="mt-6 px-6 py-3 bg-[#c9a961] text-[#1a1816] hover:bg-[#d4b76f] transition-colors disabled:opacity-50"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {processLoading ? 'Processing...' : 'Process Documents'}
            </button>
          )}
        </div>
      )}


      {/* Results Display (after processing) */}
      {(currentJob.tax_result || currentJob.status === 'review' || currentJob.status === 'parsed' || currentJob.status === 'computed' || currentJob.status === 'approved') && (
        <ResultsDisplay
          job={currentJob}
          reviewState={reviewState}
          onApprove={handleApprove}
          onExport={handleExport}
          approveLoading={approveLoading}
          exportLoading={exportLoading}
          processResponse={processResponse}
        />
      )}
    </div>
  );
}

// Document Upload Form Component
function DocumentUploadForm({ options, onSubmit, onCancel, loading }) {
  const [documentSets, setDocumentSets] = useState([
    { id: 1, documentType: '', files: [] }
  ]);
  const [nextId, setNextId] = useState(2);

  const handleDocumentTypeChange = (id, value) => {
    setDocumentSets(docSets =>
      docSets.map(doc => (doc.id === id ? { ...doc, documentType: value } : doc))
    );
  };

  const handleFileSelect = (id, newFiles) => {
    setDocumentSets(docSets =>
      docSets.map(doc => (doc.id === id ? { ...doc, files: Array.from(newFiles) } : doc))
    );
  };

  const addDocumentSet = () => {
    setDocumentSets([
      ...documentSets,
      { id: nextId, documentType: '', files: [] }
    ]);
    setNextId(nextId + 1);
  };

  const removeDocumentSet = (id) => {
    if (documentSets.length > 1) {
      setDocumentSets(docSets => docSets.filter(doc => doc.id !== id));
    }
  };

  const handleSubmit = () => {
    const validSets = documentSets.filter(set => set.documentType && set.files.length > 0);

    if (validSets.length === 0) {
      alert('Please select at least one document type and file');
      return;
    }

    // Pass valid sets directly - they already have the correct structure
    // { documentType, files: [...] }
    onSubmit(validSets);
  };

  return (
    <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6 rounded space-y-4">
      {documentSets.map((docSet, index) => (
        <div key={docSet.id} className="bg-white p-4 border border-[#e0ddd6]">
          <div className="flex justify-between items-center mb-4">
            <h5
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#1a1816",
              }}
            >
              Document {index + 1}
            </h5>
            {documentSets.length > 1 && (
              <button
                onClick={() => removeDocumentSet(docSet.id)}
                className="text-[#d4534f] hover:text-[#a84340] text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Remove
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#1a1816",
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Document Type
              </label>
              <select
                value={docSet.documentType}
                onChange={(e) => handleDocumentTypeChange(docSet.id, e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "1rem",
                }}
              >
                <option value="">Select document type...</option>
                {(
                  Object.keys(options?.supported_documents || {}) ||
                  ['form16', 'ais', 'bank_statement', 'capital_gains_statement', 'deduction_proof']
                ).map((type) => (
                  <option key={type} value={type}>
                    {type
                      .split('_')
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#1a1816",
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Select Files
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileSelect(docSet.id, e.target.files)}
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9375rem",
                }}
              />
              {docSet.files.length > 0 && (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.8125rem",
                    color: "#2d5a3a",
                    marginTop: "0.5rem",
                  }}
                >
                  {docSet.files.length} file(s) selected
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addDocumentSet}
        className="w-full py-2 border-2 border-dashed border-[#c9a961] text-[#c9a961] hover:bg-[#f5f3ed] transition-colors"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
          fontWeight: 600,
        }}
      >
        + Add Another Document
      </button>

      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {loading ? 'Uploading...' : 'Upload All Documents'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-3 border-2 border-[#e0ddd6] text-[#1a1816] hover:bg-white transition-colors"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Results Display Component
function ResultsDisplay({ job, reviewState, onApprove, onExport, approveLoading, exportLoading, processResponse }) {
  const [expandedSection, setExpandedSection] = useState('income');

  const result = job.tax_result;

  // If processResponse exists and job status is computed, show the process response data
  if (processResponse && (job.status === 'computed' || job.status === 'review') && !result) {
    const processData = processResponse.draft_return?.itr_fields || processResponse.tax_result || {};
    return (
      <div className="space-y-6">
        {/* Process Response Results */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3
            className="mb-6"
            style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#1a1816",
            }}
          >
            Tax Computation Results
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Gross Income', value: processData.gross_total_income },
              { label: 'Total Deductions', value: processData.total_deductions },
              { label: 'Taxable Income', value: processData.taxable_income },
              { label: 'Tax Liability', value: processData.total_tax_liability },
              { label: 'Total Paid', value: processData.total_taxes_paid || processData.balance_tax_payable },
              { label: 'Refund Due', value: processData.refund_due },
            ].map((item) => (
              <div key={item.label}>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.8125rem",
                    color: "#8a867f",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    color: "#1a1816",
                  }}
                >
                  ₹{item.value?.toLocaleString('en-IN') || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Income Breakdown */}
        {processResponse.draft_return?.income_schedule && (
          <div className="bg-white border border-[#e0ddd6] p-8">
            <h3
              style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1a1816",
                marginBottom: "1.5rem",
              }}
            >
              Income Breakdown
            </h3>
            <div className="space-y-3">
              {Object.entries(processResponse.draft_return.income_schedule).map(([source, amount]) =>
                amount && amount > 0 ? (
                  <div key={source} className="flex justify-between py-2 border-b border-[#e0ddd6]">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9375rem", color: "#5a5550", textTransform: "capitalize" }}>
                      {source.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9375rem", fontWeight: 600, color: "#1a1816" }}>
                      ₹{amount?.toLocaleString('en-IN') || '—'}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* Documents Processed */}
        {processResponse.documents_processed && processResponse.documents_processed.length > 0 && (
          <div className="bg-white border border-[#e0ddd6] p-8">
            <h3
              style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1a1816",
                marginBottom: "1.5rem",
              }}
            >
              Documents Processed
            </h3>
            <div className="space-y-3">
              {processResponse.documents_processed.map((doc, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-[#f5f3ed] border border-[#e0ddd6]">
                  <div>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#1a1816",
                        marginBottom: "0.25rem",
                        textTransform: "capitalize",
                      }}
                    >
                      {doc.document_type?.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8125rem", color: "#8a867f" }}>
                      {doc.source_name}
                    </p>
                  </div>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#bbf7d0", color: "#065f46", padding: "0.25rem 0.5rem", borderRadius: "0.25rem" }}>
                    Processed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimization Recommendations */}
        {processResponse.optimization_recommendations && processResponse.optimization_recommendations.length > 0 && (
          <div className="bg-[#f0fdf4] border-l-4 border-[#22c55e] p-6">
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#166534",
                marginBottom: "1rem",
              }}
            >
              💡 Recommendations
            </p>
            {processResponse.optimization_recommendations.map((rec, idx) => (
              <p
                key={idx}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  color: "#166534",
                  marginBottom: "0.5rem",
                }}
              >
                • {rec.message}
              </p>
            ))}
          </div>
        )}

        {/* Approval Message */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.9375rem",
              color: "#8a867f",
              marginBottom: "1.5rem",
            }}
          >
            Tax computation complete. Ready for review and approval.
          </p>

          {/* Action Button */}
          <button
            onClick={onApprove}
            disabled={approveLoading || (reviewState && !reviewState.ready_for_approval)}
            className="w-full py-4 bg-[#2d5a3a] text-white hover:bg-[#3a6b47] transition-colors disabled:opacity-50"
            title={
              reviewState && !reviewState.ready_for_approval
                ? 'Please acknowledge all review tasks'
                : ''
            }
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {approveLoading ? 'Approving...' : 'Approve & Sign'}
          </button>
        </div>
      </div>
    );
  }

  // Show processing state if status is parsed but tax_result not ready yet
  if (!result && (job.status === 'parsed' || job.status === 'processing')) {
    return (
      <div className="bg-white border border-[#e0ddd6] p-8">
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.9375rem",
            color: "#8a867f",
          }}
        >
          Tax computation in progress. Please wait...
        </p>
      </div>
    );
  }

  // Show action buttons even if no tax_result yet (for computed/approved status)
  if (!result && (job.status === 'computed' || job.status === 'approved')) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#e0ddd6] p-8">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.9375rem",
              color: "#8a867f",
              marginBottom: "1.5rem",
            }}
          >
            {job.status === 'computed'
              ? 'Tax computation complete. Ready for review and approval.'
              : 'Filing approved. Download your ITR PDF below.'}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {(job.status === 'review' || job.status === 'computed') && (
              <button
                onClick={onApprove}
                disabled={approveLoading || (reviewState && !reviewState.ready_for_approval)}
                className="flex-1 py-4 bg-[#2d5a3a] text-white hover:bg-[#3a6b47] transition-colors disabled:opacity-50"
                title={
                  reviewState && !reviewState.ready_for_approval
                    ? 'Please acknowledge all review tasks'
                    : ''
                }
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {approveLoading ? 'Approving...' : 'Approve & Sign'}
              </button>
            )}

            {(job.status === 'approved' || job.status === 'exported' || job.status === 'filed') && (
              <button
                onClick={onExport}
                disabled={exportLoading}
                className="flex-1 py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {exportLoading ? 'Downloading...' : 'Download PDF'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Tax Computation Summary */}
      <div className="bg-white border border-[#e0ddd6] p-8">
        <h3
          className="mb-6"
          style={{
            fontFamily: "'Crimson Pro', serif",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#1a1816",
          }}
        >
          Tax Computation
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { label: 'Gross Income', value: result.gross_total_income },
            { label: 'Total Deductions', value: result.total_deductions },
            { label: 'Taxable Income', value: result.taxable_income },
            { label: 'Tax Liability', value: result.total_tax_liability },
            { label: 'TDS Paid', value: result.total_taxes_paid },
            { label: 'Refund Due', value: result.refund_due },
          ].map((item) => (
            <div key={item.label}>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.8125rem",
                  color: "#8a867f",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#1a1816",
                }}
              >
                ₹{item.value?.toLocaleString('en-IN') || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Income Breakdown */}
      {result.income_breakdown && (
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3
            className="mb-6"
            style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#1a1816",
            }}
          >
            Income Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(result.income_breakdown).map(([source, amount]) => (
              <div key={source} className="flex justify-between py-2 border-b border-[#e0ddd6]">
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
                    color: "#5a5550",
                  }}
                >
                  {source}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#1a1816",
                  }}
                >
                  ₹{amount?.toLocaleString('en-IN') || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Recommendation */}
      {job.optimization_recommendations && (
        <div className="bg-[#f0fdf4] border-l-4 border-[#22c55e] p-6">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#166534",
              marginBottom: "0.5rem",
            }}
          >
            💡 Regime Recommendation
          </p>
          {job.optimization_recommendations.map((rec, idx) => (
            <p
              key={idx}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                color: "#166534",
                marginBottom: "0.5rem",
              }}
            >
              {rec.message}
              {rec.estimated_tax_saved && (
                <span style={{ fontWeight: 600 }}>
                  {' '}
                  Save ₹{rec.estimated_tax_saved.toLocaleString('en-IN')}
                </span>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Review Blockers */}
      {reviewState?.review_blockers && reviewState.review_blockers.length > 0 && (
        <div className="space-y-3">
          {reviewState.review_blockers.map((blocker, idx) => (
            <div key={idx} className="bg-[#fef3c7] border-l-4 border-[#fbbf24] p-4">
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#92400e",
                  marginBottom: "0.25rem",
                }}
              >
                {blocker.field}
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.8125rem",
                  color: "#78350f",
                }}
              >
                {blocker.message}
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.75rem",
                  color: "#b45309",
                  marginTop: "0.5rem",
                }}
              >
                Confidence: {(blocker.confidence * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Review Tasks */}
      {reviewState?.review_tasks && (
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3
            className="mb-6"
            style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#1a1816",
            }}
          >
            Review Checklist
          </h3>
          <div className="space-y-3">
            {reviewState.review_tasks.map((task, idx) => (
              <label key={idx} className="flex items-start gap-3 p-3 border border-[#e0ddd6]">
                <input type="checkbox" defaultChecked className="mt-1" />
                <div>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "#1a1816",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {task.field}
                  </p>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.8125rem",
                      color: "#5a5550",
                    }}
                  >
                    {task.message}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Approval Section - shown when status is computed or review */}
      {(job.status === 'computed' || job.status === 'review') && (
        <div className="bg-white border border-[#e0ddd6] p-8 mt-6">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.9375rem",
              color: "#8a867f",
              marginBottom: "1.5rem",
            }}
          >
            Tax computation complete. Ready for review and approval.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
        {(job.status === 'review' || job.status === 'computed') && (
          <button
            onClick={onApprove}
            disabled={approveLoading || (reviewState && !reviewState.ready_for_approval)}
            className="flex-1 py-4 bg-[#2d5a3a] text-white hover:bg-[#3a6b47] transition-colors disabled:opacity-50"
            title={
              reviewState && !reviewState.ready_for_approval
                ? 'Please acknowledge all review tasks'
                : ''
            }
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {approveLoading ? 'Approving...' : 'Approve & Sign'}
          </button>
        )}

        {(job.status === 'approved' || job.status === 'exported' || job.status === 'filed') && (
          <button
            onClick={onExport}
            disabled={exportLoading}
            className="flex-1 py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {exportLoading ? 'Downloading...' : 'Download PDF'}
          </button>
        )}
      </div>
    </div>
  );
}
