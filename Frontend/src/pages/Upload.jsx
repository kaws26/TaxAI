import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

const API_URL = 'https://taxai-77xc.onrender.com';

export default function Upload() {
  const [mode, setMode] = useState('analyze'); // 'analyze' or 'filing'

  // Analyze mode state
  const [analyzeFormData, setAnalyzeFormData] = useState({
    profileType: 'individual',
    regime: 'auto',
    financialYear: '2024-25',
    documentType: '',
    files: [],
  });
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeResponse, setAnalyzeResponse] = useState(null);
  const [analyzeOptions, setAnalyzeOptions] = useState(null);

  // Filing mode state
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [options, setOptions] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [documentSets, setDocumentSets] = useState([
    { id: 1, documentType: '', files: [] }
  ]);
  const [nextId, setNextId] = useState(2);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');

        // Fetch options
        const optResponse = await fetch(`${API_URL}/api/tax-assistant/options`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const optData = await optResponse.json();
        setOptions(optData);
        setAnalyzeOptions(optData);

        // Fetch jobs
        const jobResponse = await fetch(`${API_URL}/api/tax-assistant/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const jobData = await jobResponse.json();
        setJobs(Array.isArray(jobData.jobs) ? jobData.jobs : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, []);

  // Fetch uploaded documents when job is selected
  useEffect(() => {
    if (selectedJob) {
      const fetchDocuments = async () => {
        try {
          const jobId = selectedJob.job_id || selectedJob.id;
          const response = await fetch(
            `${API_URL}/api/tax-assistant/jobs/${jobId}/documents`,
            {
              headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
            }
          );
          if (response.ok) {
            const data = await response.json();
            setUploadedDocuments(Array.isArray(data.documents) ? data.documents : []);
          } else {
            // Fallback: use documents from selectedJob if available
            setUploadedDocuments(Array.isArray(selectedJob.documents) ? selectedJob.documents : []);
          }
        } catch (error) {
          console.error('Failed to fetch documents:', error);
          // Fallback: use documents from selectedJob
          setUploadedDocuments(Array.isArray(selectedJob.documents) ? selectedJob.documents : []);
        }
      };

      fetchDocuments();
    }
  }, [selectedJob]);

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

  const handleFileUpload = async () => {
    if (!selectedJob) {
      alert('Please select a filing first');
      return;
    }

    const validSets = documentSets.filter(set => set.documentType && set.files.length > 0);

    if (validSets.length === 0) {
      alert('Please select at least one document type and file');
      return;
    }

    try {
      setUploading(true);

      // Use job_id (backend uses job_id, not id)
      const jobId = selectedJob.job_id || selectedJob.id;

      // Upload each document type sequentially
      for (const docSet of validSets) {
        const formData = new FormData();

        // Append document_types and files for each file (counts must match)
        docSet.files.forEach((file) => {
          formData.append('document_types', docSet.documentType);
          formData.append('files', file);
        });

        const response = await fetch(
          `${API_URL}/api/tax-assistant/jobs/${jobId}/documents`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
            body: formData,
          }
        );

        const data = await response.json();

        if (response.ok) {
          // Append new documents instead of overwriting
          const newDocs = Array.isArray(data.documents) ? data.documents : [];
          setUploadedDocuments(prevDocs => {
            // Merge with existing, avoiding duplicates by id
            const existingIds = new Set(prevDocs.map(d => d.id));
            const uniqueNewDocs = newDocs.filter(d => !existingIds.has(d.id));
            return [...prevDocs, ...uniqueNewDocs];
          });
        } else {
          // Handle token expiration
          if (response.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/auth';
            return;
          }

          throw new Error(data.message || `Failed to upload ${docSet.documentType}`);
        }
      }

      // Reset form
      setDocumentSets([{ id: 1, documentType: '', files: [] }]);
      setNextId(2);
      alert('All documents uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading files: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeFiles = async () => {
    if (!analyzeFormData.documentType) {
      alert('Please select a document type');
      return;
    }

    if (analyzeFormData.files.length === 0) {
      alert('Please select at least one file');
      return;
    }

    try {
      setAnalyzeLoading(true);
      setAnalyzeResponse(null);

      const formData = new FormData();
      formData.append('profile_type', analyzeFormData.profileType);
      formData.append('regime', analyzeFormData.regime);
      formData.append('financial_year', analyzeFormData.financialYear);

      // Append document_types for each file
      analyzeFormData.files.forEach(() => {
        formData.append('document_types', analyzeFormData.documentType);
      });

      // Append files
      analyzeFormData.files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_URL}/api/tax-assistant/analyze-files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setAnalyzeResponse(data);
        alert('Files analyzed successfully!');
      } else {
        alert(data.message || 'Failed to analyze files');
        setAnalyzeResponse({ message: data.message || 'Error analyzing files' });
      }
    } catch (error) {
      console.error('Analyze error:', error);
      alert('Error analyzing files: ' + error.message);
      setAnalyzeResponse({ message: 'Error: ' + error.message });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const getParseStatusColor = (status) => {
    switch (status) {
      case 'success':
        return { bg: '#bbf7d0', text: '#065f46' };
      case 'partial':
        return { bg: '#fed7aa', text: '#92400e' };
      case 'failed':
        return { bg: '#fecaca', text: '#7c2d12' };
      default:
        return { bg: '#e0ddd6', text: '#8a867f' };
    }
  };

  return (
    <AppLayout pageTitle="Upload & Scan" breadcrumb={['Home', 'Upload & Scan']}>
      {/* Mode Tabs */}
      <div className="flex gap-0 mb-8 border-b border-[#e0ddd6]">
        <button
          onClick={() => setMode('analyze')}
          className={`px-6 py-4 border-b-2 transition-colors ${
            mode === 'analyze'
              ? 'border-[#c9a961] text-[#c9a961]'
              : 'border-transparent text-[#8a867f] hover:text-[#1a1816]'
          }`}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Quick Analyze
        </button>
        <button
          onClick={() => setMode('filing')}
          className={`px-6 py-4 border-b-2 transition-colors ${
            mode === 'filing'
              ? 'border-[#c9a961] text-[#c9a961]'
              : 'border-transparent text-[#8a867f] hover:text-[#1a1816]'
          }`}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Upload to Filing
        </button>
      </div>

      {/* Analyze Mode */}
      {mode === 'analyze' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Analyze Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-[#e0ddd6] p-6 mb-8">
              <h3
                className="mb-6"
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "#1a1816",
                }}
              >
                Analyze Tax Documents
              </h3>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
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
                      value={analyzeFormData.profileType}
                      onChange={(e) =>
                        setAnalyzeFormData({ ...analyzeFormData, profileType: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "1rem",
                      }}
                    >
                      {(analyzeOptions?.profile_types || ['individual', 'small_business', 'large_business']).map(
                        (type) => (
                          <option key={type} value={type}>
                            {type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </option>
                        )
                      )}
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
                      value={analyzeFormData.financialYear}
                      onChange={(e) =>
                        setAnalyzeFormData({ ...analyzeFormData, financialYear: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "1rem",
                      }}
                    >
                      {(analyzeOptions?.financial_years || ['2024-25', '2023-24', '2022-23']).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                      value={analyzeFormData.regime}
                      onChange={(e) =>
                        setAnalyzeFormData({ ...analyzeFormData, regime: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "1rem",
                      }}
                    >
                      {(analyzeOptions?.regimes || ['auto', 'old', 'new']).map((regime) => (
                        <option key={regime} value={regime}>
                          {regime.charAt(0).toUpperCase() + regime.slice(1)}
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
                      Document Type
                    </label>
                    <select
                      value={analyzeFormData.documentType}
                      onChange={(e) =>
                        setAnalyzeFormData({ ...analyzeFormData, documentType: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "1rem",
                      }}
                    >
                      <option value="">Select type...</option>
                      {(
                        Object.keys(analyzeOptions?.supported_documents || {}) ||
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
                    Upload Files (CSV, PDF, JPG)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      setAnalyzeFormData({
                        ...analyzeFormData,
                        files: Array.from(e.target.files || []),
                      })
                    }
                    disabled={analyzeLoading}
                    className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.9375rem",
                    }}
                  />
                  {analyzeFormData.files.length > 0 && (
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.8125rem",
                        color: "#2d5a3a",
                        marginTop: "0.5rem",
                      }}
                    >
                      {analyzeFormData.files.length} file(s) selected
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleAnalyzeFiles}
                disabled={analyzeLoading}
                className="w-full py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {analyzeLoading ? 'Analyzing...' : 'Analyze Files'}
              </button>
            </div>
          </div>

          {/* Right - Response Display */}
          <div>
            <div className="bg-[#1a1816] px-6 py-4 border-b border-[#3a3632]">
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#f5f5f0",
                }}
              >
                Analysis Result
              </h3>
            </div>

            <div className="bg-white border-x border-b border-[#e0ddd6] p-6 min-h-[400px]">
              {analyzeResponse ? (
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
                    color: "#1a1816",
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {typeof analyzeResponse === 'object'
                    ? JSON.stringify(analyzeResponse, null, 2)
                    : analyzeResponse}
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    color: "#8a867f",
                    textAlign: "center",
                    paddingTop: "2rem",
                  }}
                >
                  Analysis results will appear here
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filing Mode */}
      {mode === 'filing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Filing Selection & Upload */}
          <div className="lg:col-span-2">
          {/* Filing Selection */}
          <div className="bg-white border border-[#e0ddd6] p-6 mb-8">
            <h3
              className="mb-4"
              style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1a1816",
              }}
            >
              Select Filing
            </h3>

            {jobs.length === 0 ? (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9375rem",
                  color: "#8a867f",
                }}
              >
                No active filings. Create a filing from the Filing page first.
              </p>
            ) : (
              <select
                value={selectedJob?.id?.toString() || ''}
                onChange={(e) => {
                  const jobId = e.target.value;
                  const job = jobs.find((j) => j.id?.toString() === jobId);
                  setSelectedJob(job || null);
                }}
                className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "1rem",
                }}
              >
                <option value="">Select a filing...</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id?.toString()}>
                    FY {job.financial_year} • {job.profile_type} • {job.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedJob && (
            <>
              {/* Document Upload Section */}
              <div className="bg-white border border-[#e0ddd6] p-6 mb-8">
                <h3
                  className="mb-6"
                  style={{
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "#1a1816",
                  }}
                >
                  Upload Documents
                </h3>

                <p
                  className="mb-6"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1rem",
                    color: "#5a5550",
                  }}
                >
                  Upload your tax documents. You can add multiple document types in one go.
                </p>

                <div className="space-y-4 mb-6">
                  {documentSets.map((docSet, index) => (
                    <div key={docSet.id} className="bg-[#f5f3ed] p-4 border border-[#e0ddd6]">
                      <div className="flex justify-between items-center mb-3">
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
                            <option value="">Select type...</option>
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
                            Files (CSV, PDF, JPG)
                          </label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleFileSelect(docSet.id, e.target.files)}
                            disabled={uploading}
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
                </div>

                <button
                  onClick={addDocumentSet}
                  className="w-full py-2 mb-4 border-2 border-dashed border-[#c9a961] text-[#c9a961] hover:bg-[#f5f3ed] transition-colors"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  + Add Another Document Type
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={handleFileUpload}
                    disabled={uploading}
                    className="flex-1 py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Upload All Documents'}
                  </button>
                  <button
                    onClick={() => {
                      setDocumentSets([{ id: 1, documentType: '', files: [] }]);
                      setNextId(2);
                    }}
                    className="flex-1 py-4 border-2 border-[#e0ddd6] text-[#1a1816] hover:bg-[#f5f3ed] transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Accepted Documents Info */}
              <div className="bg-white border border-[#e0ddd6] p-6">
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#1a1816",
                    marginBottom: "1rem",
                  }}
                >
                  Supported Documents:
                </p>
                <ul className="space-y-2">
                  {options?.supported_documents &&
                    Object.entries(options.supported_documents).map(([type, formats]) => (
                      <li
                        key={type}
                        className="flex items-center gap-2"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.875rem",
                          color: "#5a5550",
                        }}
                      >
                        <span style={{ color: '#c9a961' }}>✓</span>
                        <span style={{ fontWeight: 600 }}>{type.split('_').join(' ')}</span>
                        <span style={{ fontSize: '0.75rem', color: '#8a867f' }}>
                          ({Array.isArray(formats) ? formats.join(', ') : 'Multiple formats'})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Right Side - Uploaded Documents */}
        {selectedJob && (
          <div>
            {/* Uploaded Documents Header */}
            <div className="bg-[#1a1816] px-6 py-4 border-b border-[#3a3632]">
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#f5f5f0",
                }}
              >
                Uploaded Documents
              </h3>
            </div>

            {/* Documents List */}
            <div className="bg-white border-x border-b border-[#e0ddd6] p-6 min-h-[400px]">
              {uploadedDocuments.length === 0 ? (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    color: "#8a867f",
                    textAlign: "center",
                    paddingTop: "2rem",
                  }}
                >
                  No documents uploaded yet
                </p>
              ) : (
                <div className="space-y-3">
                  {uploadedDocuments.map((doc) => {
                    const statusColor = getParseStatusColor(doc.parse_status);
                    return (
                      <div
                        key={doc.id}
                        className="p-4 border border-[#e0ddd6] hover:bg-[#f5f3ed] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.9375rem",
                                fontWeight: 500,
                                color: "#1a1816",
                                marginBottom: "0.25rem",
                              }}
                            >
                              {doc.filename || doc.document_type}
                            </p>
                            <p
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.75rem",
                                color: "#8a867f",
                              }}
                            >
                              {doc.document_type}
                            </p>
                          </div>
                          <span
                            className="px-2 py-1 text-xs font-600 uppercase"
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              backgroundColor: statusColor.bg,
                              color: statusColor.text,
                              letterSpacing: "0.05em",
                            }}
                          >
                            {doc.parse_status}
                          </span>
                        </div>

                        {doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#e0ddd6]">
                            <p
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "#8a867f",
                                textTransform: "uppercase",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Extracted:
                            </p>
                            <ul className="space-y-1">
                              {Object.entries(doc.extracted_fields)
                                .slice(0, 3)
                                .map(([field, value]) => (
                                  <li
                                    key={field}
                                    style={{
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: "0.75rem",
                                      color: "#5a5550",
                                    }}
                                  >
                                    <span style={{ fontWeight: 600 }}>{field}:</span> {value}
                                  </li>
                                ))}
                              {Object.keys(doc.extracted_fields).length > 3 && (
                                <li
                                  style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "0.75rem",
                                    color: "#c9a961",
                                    fontWeight: 600,
                                  }}
                                >
                                  +{Object.keys(doc.extracted_fields).length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedJob && (
          <div>
            <div className="bg-[#1a1816] px-6 py-4 border-b border-[#3a3632]">
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#f5f5f0",
                }}
              >
                Documents
              </h3>
            </div>
            <div className="bg-white border border-[#e0ddd6] p-12 text-center">
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9375rem",
                  color: "#8a867f",
                }}
              >
                Select a filing to upload documents
              </p>
            </div>
          </div>
        )}
      </div>
      )}
    </AppLayout>
  );
}
