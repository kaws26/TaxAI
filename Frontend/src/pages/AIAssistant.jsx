import { useState } from 'react';
import AppLayout from '../components/AppLayout';

const API_URL = 'https://taxai-77xc.onrender.com';

// Simple markdown parser for tables, bold, headers, lists
const renderMarkdown = (content) => {
  const lines = content.split('\n');
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      i++;
      continue;
    } else if (inTable) {
      // Table ended
      inTable = false;
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
            <table style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.875rem",
              borderCollapse: 'collapse',
              width: '100%',
            }}>
              <tbody>
                {tableRows.map((row, idx) => {
                  const cells = row.split('|').filter(cell => cell.trim());
                  const isHeader = idx === 0 || row.includes('---');
                  if (row.includes('---')) return null;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {cells.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            fontWeight: isHeader ? 600 : 400,
                            backgroundColor: isHeader ? 'rgba(255,255,255,0.05)' : 'transparent',
                          }}
                        >
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    }

    // Headers (##)
    if (line.trim().startsWith('##')) {
      const headerText = line.replace(/#{1,}/g, '').trim();
      elements.push(
        <h3 key={`header-${elements.length}`} style={{
          fontFamily: "'Crimson Pro', serif",
          fontSize: "1.125rem",
          fontWeight: 600,
          color: '#FAFAF7',
          marginTop: '1rem',
          marginBottom: '0.5rem',
        }}>
          {headerText}
        </h3>
      );
      i++;
      continue;
    }

    // Headers (#)
    if (line.trim().startsWith('#') && !line.trim().startsWith('##')) {
      const headerText = line.replace(/#{1,}/g, '').trim();
      elements.push(
        <h2 key={`header-${elements.length}`} style={{
          fontFamily: "'Crimson Pro', serif",
          fontSize: "1.375rem",
          fontWeight: 600,
          color: '#FAFAF7',
          marginTop: '1rem',
          marginBottom: '0.75rem',
        }}>
          {headerText}
        </h2>
      );
      i++;
      continue;
    }

    // Bold text and lists
    if (line.trim()) {
      let text = line.trim();

      // Check if it's a bullet list
      if (text.startsWith('- ') || text.startsWith('* ')) {
        text = text.slice(2);
        elements.push(
          <div key={`list-${elements.length}`} style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.9375rem",
            color: '#FAFAF7',
            marginLeft: '1.5rem',
            marginBottom: '0.5rem',
          }}>
            <span>• </span>
            {text.split(/\*\*(.+?)\*\*/g).map((part, idx) =>
              idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
            )}
          </div>
        );
      } else {
        // Regular paragraph with bold support
        elements.push(
          <p key={`para-${elements.length}`} style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.9375rem",
            color: '#FAFAF7',
            lineHeight: '1.6',
            marginBottom: '0.75rem',
          }}>
            {text.split(/\*\*(.+?)\*\*/g).map((part, idx) =>
              idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
            )}
          </p>
        );
      }
    }

    i++;
  }

  return <div>{elements}</div>;
};

export default function AIAssistant() {
  const [activeTab, setActiveTab] = useState('tax');
  const [message, setMessage] = useState('');

  // Tax Assistant state
  const [taxForm, setTaxForm] = useState({
    profile_type: 'individual',
    regime: 'auto',
    financial_year: '2025-26',
    form16_csv: null,
    ais_csv: null,
    bank_statement_csv: null,
  });
  const [taxAnalysis, setTaxAnalysis] = useState(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState(null);

  // Chat state
  const [messages, setMessages] = useState({
    tax: [],
    financial: [
      {
        role: 'ai',
        content: "Hello! I'm your Financial Advisor. I analyze your spending patterns, income trends, and provide personalized recommendations. How can I assist you today?",
      },
    ],
    personal: [],
  });
  const [financialLoading, setFinancialLoading] = useState(false);

  const tabs = [
    { id: 'tax', label: 'Tax Assistant' },
    { id: 'financial', label: 'Financial Advisor' },
    { id: 'personal', label: 'Personal Q&A' },
  ];

  // Handle tax form input
  const handleTaxFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'form16_csv' || name === 'ais_csv' || name === 'bank_statement_csv') {
      setTaxForm({ ...taxForm, [name]: files?.[0] || null });
    } else {
      setTaxForm({ ...taxForm, [name]: value });
    }
  };

  // Submit tax analysis
  const handleAnalyze = async () => {
    // Validate form
    if (!taxForm.profile_type) {
      setTaxError('Please select a profile type');
      return;
    }

    setTaxLoading(true);
    setTaxError(null);

    try {
      // Build the request payload matching the API structure
      const payload = {
        profile_type: taxForm.profile_type,
        regime: taxForm.regime,
        financial_year: taxForm.financial_year,
        tax_profile: {
          deductions: {},
          advance_tax: 0,
        },
        documents: [],
      };

      // If file is provided, read and include it
      if (taxForm.form16_csv) {
        const csv_content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(taxForm.form16_csv);
        });

        payload.documents.push({
          document_type: 'form16',
          source_name: taxForm.form16_csv.name,
          csv_content: csv_content,
        });
      }

      // If AIS file is provided, read and include it
      if (taxForm.ais_csv) {
        const csv_content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(taxForm.ais_csv);
        });

        payload.documents.push({
          document_type: 'ais',
          source_name: taxForm.ais_csv.name,
          csv_content: csv_content,
        });
      }

      // If bank statement file is provided, read and include it
      if (taxForm.bank_statement_csv) {
        const csv_content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(taxForm.bank_statement_csv);
        });

        payload.documents.push({
          document_type: 'bank_statement',
          source_name: taxForm.bank_statement_csv.name,
          csv_content: csv_content,
        });
      }

      const response = await fetch(`${API_URL}/api/tax-assistant/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Backend error response:', data);
        throw new Error(data.message || data.detail || JSON.stringify(data) || 'Analysis failed');
      }

      setTaxAnalysis(data);
      setTaxError(null);
    } catch (error) {
      console.error('Tax analysis error:', error);
      setTaxError(error.message || 'Failed to analyze tax information');
    } finally {
      setTaxLoading(false);
    }
  };

  // Handle chat send
  const handleSend = async (customMessage = null) => {
    const messageToSend = customMessage || message;
    if (!messageToSend.trim()) return;

    // Add user message immediately
    const userMessage = { role: 'user', content: messageToSend };
    setMessages((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], userMessage],
    }));
    if (!customMessage) {
      setMessage('');
    }

    // For personal Q&A, call the API
    if (activeTab === 'personal' && taxAnalysis) {
      try {
        const response = await fetch(`${API_URL}/api/tax-assistant/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            question: userMessage.content,
            analysis: taxAnalysis,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessages((prev) => ({
            ...prev,
            personal: [
              ...prev.personal,
              { role: 'ai', content: data.answer },
            ],
          }));
        } else {
          setMessages((prev) => ({
            ...prev,
            personal: [
              ...prev.personal,
              { role: 'ai', content: 'Error: Unable to process your question.' },
            ],
          }));
        }
      } catch (error) {
        console.error('Chat error:', error);
        setMessages((prev) => ({
          ...prev,
          personal: [
            ...prev.personal,
            { role: 'ai', content: 'Error: Connection failed.' },
          ],
        }));
      }
    } else if (activeTab === 'financial') {
      // Call the financial advisor API
      try {
        setFinancialLoading(true);
        const response = await fetch(`${API_URL}/api/tax-assistant/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            question: messageToSend,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessages((prev) => ({
            ...prev,
            financial: [
              ...prev.financial,
              { role: 'ai', content: data.answer, isFormatted: true },
            ],
          }));
        } else {
          setMessages((prev) => ({
            ...prev,
            financial: [
              ...prev.financial,
              { role: 'ai', content: 'Error: Unable to process your question.' },
            ],
          }));
        }
      } catch (error) {
        console.error('Financial advisor error:', error);
        setMessages((prev) => ({
          ...prev,
          financial: [
            ...prev.financial,
            { role: 'ai', content: 'Error: Connection failed.' },
          ],
        }));
      } finally {
        setFinancialLoading(false);
      }
    }
  };

  return (
    <AppLayout pageTitle="AI Assistant" breadcrumb={['Home', 'AI Assistant']}>
      {/* Tab Switcher */}
      <div className="flex gap-8 border-b border-[#e0ddd6] mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 relative transition-colors ${
              activeTab === tab.id ? 'text-[#c9a961]' : 'text-[#8a867f] hover:text-[#1a1816]'
            }`}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a961]" />
            )}
          </button>
        ))}
      </div>

      {/* TAX ASSISTANT TAB */}
      {activeTab === 'tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
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
              Tax Analysis
            </h3>

            <div className="space-y-5">
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
                  name="profile_type"
                  value={taxForm.profile_type}
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1rem",
                  }}
                >
                  <option value="individual">Individual</option>
                  <option value="small_business">Small Business</option>
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
                  name="regime"
                  value={taxForm.regime}
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1rem",
                  }}
                >
                  <option value="old">Old Regime</option>
                  <option value="new">New Regime</option>
                  <option value="auto">Auto (Recommend)</option>
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
                  name="financial_year"
                  value={taxForm.financial_year}
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1rem",
                  }}
                >
                  <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
                  <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
                  <option value="2023-24">FY 2023-24 (AY 2024-25)</option>
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
                  Form 16 CSV (Optional)
                </label>
                <input
                  type="file"
                  name="form16_csv"
                  accept=".csv"
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
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
                  AIS CSV (Optional)
                </label>
                <input
                  type="file"
                  name="ais_csv"
                  accept=".csv"
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
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
                  Bank Statement CSV (Optional)
                </label>
                <input
                  type="file"
                  name="bank_statement_csv"
                  accept=".csv"
                  onChange={handleTaxFormChange}
                  className="w-full px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
                  }}
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={taxLoading}
                className="w-full py-4 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {taxLoading ? 'Analyzing...' : 'Analyze Tax'}
              </button>

              {taxError && (
                <div
                  className="p-4 bg-[#fef3c7] border border-[#fcd34d]"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    color: "#92400e",
                  }}
                >
                  {taxError}
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {taxAnalysis && (
              <>
                {/* Main Result Card */}
                <div className="bg-white border border-[#e0ddd6] p-8">
                  <h4
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#8a867f",
                      marginBottom: "1rem",
                    }}
                  >
                    Tax Result
                  </h4>

                  <div className="space-y-4">
                    {[
                      { label: 'Gross Income', value: taxAnalysis.tax_result?.gross_total_income },
                      { label: 'Total Deductions', value: taxAnalysis.tax_result?.total_deductions },
                      { label: 'Taxable Income', value: taxAnalysis.tax_result?.taxable_income },
                      { label: 'Tax Liability', value: taxAnalysis.tax_result?.total_tax_liability },
                      { label: 'Taxes Paid', value: taxAnalysis.tax_result?.total_taxes_paid },
                      { label: 'Refund Due', value: taxAnalysis.tax_result?.refund_due },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between pb-3 border-b border-[#e0ddd6] last:border-0">
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.9375rem",
                            color: "#8a867f",
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.9375rem",
                            fontWeight: 600,
                            color: "#1a1816",
                          }}
                        >
                          ₹{item.value?.toLocaleString('en-IN') || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimization Recommendations */}
                {taxAnalysis.optimization_recommendations && taxAnalysis.optimization_recommendations.length > 0 && (
                  <div className="space-y-3">
                    {taxAnalysis.optimization_recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="bg-[#f0fdf4] border-l-4 border-[#22c55e] p-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.875rem",
                          color: "#166534",
                        }}
                      >
                        <div className="font-600 mb-1">{rec.message}</div>
                        {rec.estimated_tax_saved && (
                          <div className="text-sm">Tax saved: ₹{rec.estimated_tax_saved.toLocaleString('en-IN')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Parse Errors */}
                {taxAnalysis.parse_errors && taxAnalysis.parse_errors.length > 0 && (
                  <div className="space-y-3">
                    {taxAnalysis.parse_errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="bg-[#fef3c7] border-l-4 border-[#fbbf24] p-4"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.875rem",
                          color: "#92400e",
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                )}

                {/* Missing Data Checklist */}
                {taxAnalysis.missing_data_checklist && taxAnalysis.missing_data_checklist.length > 0 && (
                  <div className="bg-white border border-[#e0ddd6] p-6">
                    <h4
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#8a867f",
                        marginBottom: "1rem",
                      }}
                    >
                      Missing Data
                    </h4>
                    <div className="space-y-2">
                      {taxAnalysis.missing_data_checklist.map((item, idx) => (
                        <label key={idx} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled
                            className="mt-1 w-4 h-4"
                          />
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: "0.875rem",
                              color: "#1a1816",
                            }}
                          >
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Income Breakdown */}
                {taxAnalysis.tax_result?.income_breakdown && (
                  <div className="bg-white border border-[#e0ddd6] p-8">
                    <h4
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#8a867f",
                        marginBottom: "1rem",
                      }}
                    >
                      Income Breakdown
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(taxAnalysis.tax_result.income_breakdown)
                        .filter(([_, value]) => typeof value === 'number' && value > 0)
                        .map(([source, amount], idx) => (
                          <div key={idx} className="flex justify-between pb-2 border-b border-[#e0ddd6]">
                            <span
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.9375rem",
                                color: "#5a5550",
                                textTransform: "capitalize",
                              }}
                            >
                              {source.split('_').join(' ')}
                            </span>
                            <span
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.9375rem",
                                fontWeight: 600,
                                color: "#1a1816",
                              }}
                            >
                              ₹{amount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Regime Recommendation */}
                {taxAnalysis.tax_result?.regime_recommendation && (
                  <div className="bg-[#f0fdf4] border-l-4 border-[#22c55e] p-6">
                    <h4
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#166534",
                        marginBottom: "1rem",
                      }}
                    >
                      💡 Regime Recommendation
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span style={{ color: "#166534" }}>Selected Regime:</span>
                        <span style={{ fontWeight: 600, color: "#166534", textTransform: "capitalize" }}>
                          {taxAnalysis.tax_result.regime_recommendation.selected_regime} Regime
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "#166534" }}>Old Regime Tax:</span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", color: "#166534" }}>
                          ₹{taxAnalysis.tax_result.regime_recommendation.old_regime_tax?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "#166534" }}>New Regime Tax:</span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", color: "#166534" }}>
                          ₹{taxAnalysis.tax_result.regime_recommendation.new_regime_tax?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {taxAnalysis.tax_result.regime_recommendation.old_regime_tax > taxAnalysis.tax_result.regime_recommendation.new_regime_tax && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            paddingTop: "0.5rem",
                            borderTop: "1px solid rgba(34, 197, 94, 0.3)",
                            fontWeight: 600,
                            color: "#166534",
                          }}
                        >
                          Benefit: ₹
                          {(
                            taxAnalysis.tax_result.regime_recommendation.old_regime_tax -
                            taxAnalysis.tax_result.regime_recommendation.new_regime_tax
                          ).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents Processed Summary */}
                {taxAnalysis.documents_processed && taxAnalysis.documents_processed.length > 0 && (
                  <div className="bg-white border border-[#e0ddd6] p-8">
                    <h4
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#8a867f",
                        marginBottom: "1rem",
                      }}
                    >
                      Documents Processed
                    </h4>
                    <div className="space-y-4">
                      {taxAnalysis.documents_processed.map((doc, idx) => (
                        <div key={idx} className="p-4 bg-[#f5f3ed] border border-[#e0ddd6]">
                          <h5
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: "0.9375rem",
                              fontWeight: 600,
                              color: "#1a1816",
                              marginBottom: "0.75rem",
                              textTransform: "capitalize",
                            }}
                          >
                            {doc.document_type.split('_').join(' ')}
                          </h5>
                          {doc.summary && (
                            <div className="space-y-1">
                              {Object.entries(doc.summary).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between text-sm"
                                  style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "0.8125rem",
                                    color: "#5a5550",
                                  }}
                                >
                                  <span className="capitalize">{key.split('_').join(' ')}:</span>
                                  <span style={{ fontWeight: 500 }}>
                                    {typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filing Position */}
                {taxAnalysis.tax_result?.filing_position && (
                  <div className="bg-white border border-[#e0ddd6] p-6">
                    <h4
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#1a1816",
                        marginBottom: "0.75rem",
                      }}
                    >
                      📋 Filing Position
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span style={{ color: "#5a5550" }}>Suggested Form:</span>
                        <span style={{ fontWeight: 600, color: "#1a1816" }}>
                          {taxAnalysis.tax_result.filing_position.suggested_itr_form}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "#5a5550" }}>Ready for Filing:</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: taxAnalysis.tax_result.filing_position.ready_for_filing ? '#2d5a3a' : '#d4534f',
                          }}
                        >
                          {taxAnalysis.tax_result.filing_position.ready_for_filing ? '✓ Yes' : '✗ No'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* FINANCIAL ADVISOR TAB */}
      {activeTab === 'financial' && (
        <>
          <div className="mb-6 space-y-4">
            <div
              className="bg-[#f5f3ed] border-l-4 border-[#c9a961] p-4"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                color: "#5a5550",
              }}
            >
              Based on your last 3 months of transactions and AY 2025–26 data
            </div>
            <button
              onClick={() => {
                const defaultQuestion = "What are my top transaction categories and what is my likely preferred tax regime?";
                handleSend(defaultQuestion);
              }}
              disabled={financialLoading}
              className="px-6 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {financialLoading ? 'Analyzing...' : '📊 Get Financial Analysis'}
            </button>
          </div>

          <div className="bg-white border border-[#e0ddd6] flex flex-col h-[600px]">
            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.financial.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-3xl ${
                      msg.role === 'user'
                        ? 'bg-[#f5f3ed] border border-[#e0ddd6]'
                        : 'bg-[#1A1208] text-[#FAFAF7]'
                    } px-6 py-4`}
                  >
                    {msg.isFormatted ? (
                      renderMarkdown(msg.content)
                    ) : (
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          lineHeight: "1.6",
                          color: msg.role === 'user' ? '#1a1816' : '#FAFAF7',
                        }}
                      >
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="border-t border-[#e0ddd6] p-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "1rem",
                    color: "#1a1816",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={financialLoading}
                  className="px-8 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors disabled:opacity-50"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {financialLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <>
          <div className="mb-6 space-y-4">
            <div
              className="bg-[#f5f3ed] border-l-4 border-[#c9a961] p-4"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                color: "#5a5550",
              }}
            >
              All transactions extracted from your uploaded documents ({transactionCount} total)
            </div>
          </div>

          {transactionsLoading ? (
            <div
              className="bg-white border border-[#e0ddd6] p-12 text-center"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                color: "#8a867f",
              }}
            >
              Loading transactions...
            </div>
          ) : transactionsError ? (
            <div
              className="bg-[#fef3c7] border border-[#fcd34d] p-4"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                color: "#92400e",
              }}
            >
              {transactionsError}
            </div>
          ) : transactions.length === 0 ? (
            <div
              className="bg-white border border-[#e0ddd6] p-12 text-center"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                color: "#8a867f",
              }}
            >
              No transactions found
            </div>
          ) : (
            <div className="bg-white border border-[#e0ddd6] overflow-x-auto">
              <table style={{
                fontFamily: "'DM Sans', sans-serif",
                width: "100%",
                borderCollapse: "collapse",
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f3ed", borderBottom: "2px solid #e0ddd6" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "#1a1816" }}>Date</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "#1a1816" }}>Merchant</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "#1a1816" }}>Category</th>
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "#1a1816" }}>Amount</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#1a1816" }}>Type</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "#1a1816" }}>Description</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#1a1816" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, idx) => (
                    <tr key={txn.id} style={{ borderBottom: "1px solid #e0ddd6" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#5a5550", fontSize: "0.875rem" }}>
                        {new Date(txn.date).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#1a1816", fontSize: "0.9375rem", fontWeight: 500 }}>
                        {txn.merchant}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#5a5550", fontSize: "0.875rem" }}>
                        <span style={{
                          backgroundColor: "#f5f3ed",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.25rem",
                          display: "inline-block",
                        }}>
                          {txn.category}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#1a1816", fontWeight: 600, fontSize: "0.9375rem" }}>
                        ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{
                        padding: "0.75rem 1rem",
                        textAlign: "center",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: txn.txn_type === 'income' ? '#2d5a3a' : '#d4534f',
                        textTransform: "capitalize",
                      }}>
                        {txn.txn_type}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#8a867f", fontSize: "0.8125rem", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {txn.description}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEditTransaction(txn)}
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0.5rem 0.75rem",
                              backgroundColor: "#c9a961",
                              color: "#1a1816",
                              border: "none",
                              cursor: "pointer",
                              borderRadius: "0.25rem",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(txn.id)}
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0.5rem 0.75rem",
                              backgroundColor: "#d4534f",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              borderRadius: "0.25rem",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* PERSONAL Q&A TAB */}
      {activeTab === 'personal' && (
        <>
          {!taxAnalysis ? (
            <div
              className="bg-[#f5f3ed] border border-[#e0ddd6] p-8 text-center"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                color: "#5a5550",
              }}
            >
              <p className="mb-4">Please run a tax analysis first to ask personalized questions.</p>
              <button
                onClick={() => setActiveTab('tax')}
                className="px-6 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Go to Tax Analysis
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#e0ddd6] flex flex-col h-[600px]">
              {/* Messages Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {messages.personal.length === 0 && (
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.9375rem",
                      color: "#8a867f",
                      textAlign: "center",
                      marginTop: "2rem",
                    }}
                  >
                    Ask me anything about your tax analysis
                  </div>
                )}
                {messages.personal.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-2xl ${
                        msg.role === 'user'
                          ? 'bg-[#f5f3ed] border border-[#e0ddd6]'
                          : 'bg-[#1A1208] text-[#FAFAF7]'
                      } px-6 py-4`}
                    >
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "0.9375rem",
                          lineHeight: "1.6",
                          color: msg.role === 'user' ? '#1a1816' : '#FAFAF7',
                        }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="border-t border-[#e0ddd6] p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend();
                    }}
                    placeholder="Ask a question..."
                    className="flex-1 px-4 py-3 border-2 border-[#e0ddd6] bg-white focus:border-[#c9a961] focus:outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem",
                      color: "#1a1816",
                    }}
                  />
                  <button
                    onClick={handleSend}
                    className="px-8 py-3 bg-[#1A1208] text-[#FAFAF7] hover:bg-[#2a2218] transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
