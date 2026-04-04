import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

const API_URL = 'http://localhost:8000';

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_URL}/api/tax-assistant/dashboard/financial-data`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard data');

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <AppLayout pageTitle="Dashboard" breadcrumb={['Home', 'Dashboard']}>
        <div className="flex items-center justify-center py-16">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#8a867f' }}>
            Loading dashboard...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout pageTitle="Dashboard" breadcrumb={['Home', 'Dashboard']}>
        <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#d4534f' }}>
            Error loading dashboard: {error}
          </p>
        </div>
      </AppLayout>
    );
  }

  const job = dashboardData?.job || {};
  const summary = dashboardData?.summary || {};
  const charts = dashboardData?.charts || {};
  const insights = dashboardData?.insights || [];
  const highlights = dashboardData?.highlights || {};

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const incomeSplitData = charts.income_split || [];
  const expenseSplitData = charts.expense_split || [];
  const netSavings = (summary.gross_total_income || 0) - (summary.total_expenses || 0) - (summary.total_tax_liability || 0);
  const taxProgress = summary.total_tax_liability && summary.balance_tax_payable ?
    Math.round(((summary.total_tax_liability - summary.balance_tax_payable) / summary.total_tax_liability) * 100) : 0;

  const overviewMetrics = [
  { label: 'Total Income', value: formatCurrency(summary.gross_total_income), icon: '₹' },
  { label: 'Net Cashflow', value: formatCurrency(summary.net_cashflow), icon: '⊕' },
  { label: 'Taxable Income', value: formatCurrency(summary.taxable_income), icon: '§' },
  { label: 'Tax Liability', value: formatCurrency(summary.total_tax_liability), icon: '⚖' },
];

  return (
    <AppLayout pageTitle="Dashboard" breadcrumb={['Home', 'Dashboard']}>
      {/* 📊 Overview KPI Cards */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          📊 Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {overviewMetrics.map((metric, i) => (
            <div key={i} className="bg-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.5rem", fontWeight: 600, color: "#c9a961", marginBottom: "0.5rem" }}>
                {metric.icon}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 600, color: "#1a1816", lineHeight: "1", marginBottom: "0.75rem" }}>
                {metric.value}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Income & Expenses Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Income Split */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Income Breakdown
          </h3>
          {incomeSplitData.length > 0 ? (
            <div className="space-y-6">
              {incomeSplitData.map((data, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#1a1816" }}>
                      {data.category}
                    </span>
                    <div className="flex gap-4">
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#2d5a3a", fontWeight: 600 }}>
                        {formatCurrency(data.amount)}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#8a867f" }}>
                        {data.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#e0ddd6] h-8 overflow-hidden">
                    <div className="bg-[#2d5a3a] h-full transition-all" style={{ width: `${data.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No income data available
            </p>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Expense Summary
          </h3>
          {expenseSplitData.length > 0 ? (
            <div className="space-y-6">
              {expenseSplitData.map((data, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#1a1816" }}>
                      {data.category}
                    </span>
                    <div className="flex gap-4">
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#d4534f", fontWeight: 600 }}>
                        {formatCurrency(data.amount)}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#8a867f" }}>
                        {data.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#e0ddd6] h-8 overflow-hidden">
                    <div className="bg-[#d4534f] h-full transition-all" style={{ width: `${data.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Total Expenses', value: formatCurrency(summary.total_expenses), color: '#d4534f' },
                { label: 'Total Credits', value: formatCurrency(summary.total_credits), color: '#2d5a3a' },
                { label: 'Total Debits', value: formatCurrency(summary.total_debits), color: '#8a867f' },
              ].map((item, i) => (
                <div key={i} className={`flex justify-between py-3 ${i < 2 ? 'border-b border-[#e0ddd6]' : ''}`}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9375rem", color: "#5a5550" }}>
                    {item.label}
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem", fontWeight: 600, color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 🧾 Tax Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Tax Summary */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Tax Summary
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Gross Income', value: formatCurrency(summary.gross_total_income), color: '#1a1816' },
              { label: 'Total Deductions', value: `- ${formatCurrency(summary.total_deductions)}`, color: '#2d5a3a' },
              { label: 'Taxable Income', value: formatCurrency(summary.taxable_income), color: '#1a1816' },
              { label: 'Tax Payable', value: formatCurrency(summary.total_tax_liability), color: '#c9a961' },
            ].map((item, i) => (
              <div key={i} className={`flex justify-between py-3 ${i < 3 ? 'border-b border-[#e0ddd6]' : ''}`}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9375rem", color: "#5a5550" }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem", fontWeight: 600, color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-[#f5f3ed] p-6 border-l-4 border-[#c9a961]">
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: '0.5rem' }}>
              Total Tax Liability
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 700, color: "#1a1816" }}>
              {formatCurrency(summary.total_tax_liability)}
            </div>
          </div>
        </div>

        {/* Tax Benefits */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Tax Benefits
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Refund Due', value: formatCurrency(summary.refund_due), color: '#2d5a3a', icon: '↓' },
              { label: 'Estimated Savings', value: formatCurrency(summary.estimated_savings), color: '#2d5a3a', icon: '✓' },
              { label: 'Balance Payable', value: formatCurrency(summary.balance_tax_payable), color: '#d4534f', icon: '⚠️' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#f5f3ed] border border-[#e0ddd6]">
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: item.color }}>
                    {item.icon}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#5a5550" }}>
                    {item.label}
                  </span>
                </div>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 600, color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-[#e0ddd6] space-y-3">
            <div className="flex justify-between">
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#5a5550" }}>
                Tax Regime
              </span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 600, color: "#c9a961", textTransform: "capitalize" }}>
                {summary.regime || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#5a5550" }}>
                Suggested Form
              </span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 600, color: "#c9a961" }}>
                {summary.suggested_itr_form || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 📈 Advanced KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-[#f5f3ed] to-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: '0.5rem' }}>
            Net Savings
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 700, color: netSavings > 0 ? "#2d5a3a" : "#d4534f" }}>
            {formatCurrency(netSavings)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#f5f3ed] to-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: '0.5rem' }}>
            Cash Flow Status
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 700, color: "#1a1816" }}>
            {formatCurrency(summary.net_cashflow)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#f5f3ed] to-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: '0.5rem' }}>
            Tax Progress
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 700, color: "#c9a961" }}>
            {taxProgress}%
          </div>
        </div>
      </div>

      {/* 🤖 AI Insights */}
      <div className="mb-8">
        <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          🤖 AI Insights
        </h3>
        <div className="space-y-3">
          {insights.length > 0 ? (
            insights.map((insight, i) => (
              <div key={i} className="bg-white border border-[#e0ddd6] p-6 flex items-start gap-4 hover:border-[#c9a961] transition-colors">
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "#c9a961", lineHeight: "1" }}>
                  ✦
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", color: "#1a1816", lineHeight: "1.6" }}>
                  {insight}
                </p>
              </div>
            ))
          ) : (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No insights available yet
            </p>
          )}
        </div>
      </div>

      {/* Filing Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#e0ddd6] p-6">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Filing Information
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Job ID', value: job.job_id?.substring(0, 8) + '...' },
              { label: 'Financial Year', value: job.financial_year },
              { label: 'Status', value: job.status, color: job.status === 'exported' ? '#2d5a3a' : job.status === 'approved' ? '#c9a961' : '#8a867f' },
              { label: 'Updated', value: new Date(job.updated_at).toLocaleDateString('en-IN') },
            ].map((item, i) => (
              <div key={i} className={`flex justify-between py-2 ${i < 3 ? 'border-b border-[#e0ddd6]' : ''}`}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#5a5550' }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: item.color || '#1a1816', fontWeight: item.color ? 600 : 500, textTransform: item.label === 'Status' ? 'capitalize' : 'none' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#e0ddd6] p-6">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            Data Summary
          </h3>
          <div className="space-y-4">
            <div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#8a867f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Assistant Summary
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#1a1816', lineHeight: '1.5' }}>
                {highlights.assistant_summary || 'No summary available'}
              </p>
            </div>
            <div className="pt-4 border-t border-[#e0ddd6]">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#8a867f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Data Completeness
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: highlights.missing_data_count > 0 ? '#d4534f' : '#2d5a3a' }}>
                {highlights.missing_data_count} missing data point{highlights.missing_data_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
