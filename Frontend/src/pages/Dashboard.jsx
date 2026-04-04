import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

const API_URL = 'https://taxai-77xc.onrender.com';

// Donut Chart Component
const DonutChart = ({ data, colors, width = 200, height = 200 }) => {
  if (!data || data.length === 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 20;
  const innerRadius = radius * 0.6;

  const total = data.reduce((sum, item) => sum + (item.amount || 0), 0);
  let currentAngle = -Math.PI / 2;
  const slices = [];

  data.forEach((item, i) => {
    const sliceAngle = (item.amount / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const ix1 = cx + innerRadius * Math.cos(startAngle);
    const iy1 = cy + innerRadius * Math.sin(startAngle);
    const ix2 = cx + innerRadius * Math.cos(endAngle);
    const iy2 = cy + innerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const path = `
      M ${ix1} ${iy1}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;

    slices.push({
      path,
      color: colors[i % colors.length],
      label: item.category,
      percentage: item.percentage,
    });

    currentAngle = endAngle;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {slices.map((slice, i) => (
        <g key={i}>
          <path d={slice.path} fill={slice.color} stroke="white" strokeWidth="2" opacity="0.9" />
        </g>
      ))}
    </svg>
  );
};

// Line Chart Component
const LineChart = ({ data, width = 400, height = 250 }) => {
  if (!data || data.length === 0) return null;

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const allValues = data.flatMap(d => [d.income || 0, d.expense || 0]);
  const maxValue = Math.max(...allValues);
  if (maxValue === 0) return null;

  const points = {
    income: [],
    expense: [],
  };

  data.forEach((item, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const yIncome = padding + chartHeight - ((item.income || 0) / maxValue) * chartHeight;
    const yExpense = padding + chartHeight - ((item.expense || 0) / maxValue) * chartHeight;

    points.income.push([x, yIncome]);
    points.expense.push([x, yExpense]);
  });

  const pathIncome = points.income.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const pathExpense = points.expense.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = padding + chartHeight - ratio * chartHeight;
        return (
          <g key={`grid-${i}`}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e0ddd6" strokeWidth="1" strokeDasharray="4" />
          </g>
        );
      })}

      {/* Area shading for income */}
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2d5a3a" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2d5a3a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathIncome} L ${points.income[points.income.length - 1][0]} ${padding + chartHeight} L ${points.income[0][0]} ${padding + chartHeight} Z`}
        fill="url(#areaGradient)"
      />

      {/* Lines */}
      <path d={pathIncome} stroke="#2d5a3a" strokeWidth="3" fill="none" />
      <path d={pathExpense} stroke="#d4534f" strokeWidth="3" fill="none" />

      {/* Axis labels */}
      {data.map((item, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
        return (
          <g key={`label-${i}`}>
            <text x={x} y={height - 10} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#8a867f' }}>
              {item.month.split('-')[1]}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <line x1={width - 140} y1={15} x2={width - 120} y2={15} stroke="#2d5a3a" strokeWidth="3" />
      <text x={width - 110} y={19} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#2d5a3a', fontWeight: 600 }}>
        Income
      </text>

      <line x1={width - 140} y1={35} x2={width - 120} y2={35} stroke="#d4534f" strokeWidth="3" />
      <text x={width - 110} y={39} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#d4534f', fontWeight: 600 }}>
        Expense
      </text>
    </svg>
  );
};

// Horizontal Bar Chart Component
const HorizontalBarChart = ({ data, width = 400, height = 300 }) => {
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map(item => item.count || 0));
  const barHeight = height / data.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.slice(0, 8).map((item, i) => {
        const percent = maxCount ? ((item.count || 0) / maxCount) * (width - 150) : 0;
        const y = (i + 0.5) * barHeight;

        return (
          <g key={i}>
            <text x={10} y={y + 5} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#1a1816', fontWeight: 500 }}>
              {item.category}
            </text>
            <rect x={140} y={y - barHeight / 3} width={percent} height={barHeight * 0.6} fill="#c9a961" opacity="0.9" rx="3" />
            <text x={150 + percent + 5} y={y + 5} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#5a5550', fontWeight: 600 }}>
              {item.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Gauge Chart Component
const GaugeChart = ({ value, max, label, color, width = 180, height = 180 }) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 25;
  const percent = Math.min(value / max, 1);
  const angle = percent * Math.PI - Math.PI / 2;

  const gaugeStartAngle = -Math.PI / 2;
  const gaugeEndAngle = Math.PI / 2;

  const x1 = cx + radius * Math.cos(gaugeStartAngle);
  const y1 = cy + radius * Math.sin(gaugeStartAngle);
  const x2 = cx + radius * Math.cos(gaugeEndAngle);
  const y2 = cy + radius * Math.sin(gaugeEndAngle);

  const needleX = cx + radius * Math.cos(angle);
  const needleY = cy + radius * Math.sin(angle);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background gauge */}
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
        stroke="#e0ddd6"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />

      {/* Filled gauge */}
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${needleX} ${needleY}`}
        stroke={color}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />

      {/* Center circle */}
      <circle cx={cx} cy={cy} r="8" fill={color} />

      {/* Center text */}
      <text x={cx} y={cy + 20} textAnchor="middle" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', fontWeight: 700, color }}>
        {Math.round(percent * 100)}%
      </text>
    </svg>
  );
};

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
  const assistantContext = dashboardData?.assistant_context || {};
  const transactions = dashboardData?.transactions || {};

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatCurrencyDecimal = (value) => {
    if (!value) return '₹0';
    return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const incomeSplitData = charts.income_split || [];
  const expenseSplitData = charts.expense_split || [];
  const monthlyData = charts.monthly_cashflow || [];
  const transactionCategories = transactions.categories || [];
  const recentTransactions = transactions.recent_transactions || [];
  const complianceFlags = highlights.compliance_flags || [];

  const netSavings = (summary.gross_total_income || 0) - (summary.total_expenses || 0) - (summary.total_tax_liability || 0);
  const profitability = summary.total_income ? Math.round((summary.net_cashflow / summary.total_income) * 100) : 0;
  const taxProgress = summary.total_tax_liability && summary.balance_tax_payable ?
    Math.round(((summary.total_tax_liability - summary.balance_tax_payable) / summary.total_tax_liability) * 100) : 0;

  // KPI Cards Data
  const kpiSections = {
    financialOverview: [
      { label: 'Total Income', value: formatCurrency(summary.total_income), icon: '💰', color: '#2d5a3a' },
      { label: 'Total Expenses', value: formatCurrency(summary.total_expenses), icon: '📊', color: '#d4534f' },
      { label: 'Net Cashflow', value: formatCurrency(summary.net_cashflow), icon: '⊕', color: '#c9a961' },
    ],
    taxSnapshot: [
      { label: 'Tax Liability', value: formatCurrency(summary.total_tax_liability), icon: '⚖', color: '#c9a961' },
      { label: 'Balance Payable', value: formatCurrency(summary.balance_tax_payable), icon: '💳', color: '#d4534f' },
      { label: 'Est. Savings', value: formatCurrency(summary.estimated_savings), icon: '✓', color: '#2d5a3a' },
    ],
    businessHealth: [
      { label: 'Transactions', value: transactions.total_transactions || 0, icon: '📈', color: '#1a1816' },
      { label: 'GST Payable', value: formatCurrency(assistantContext.net_gst_payable), icon: '₹', color: '#c9a961' },
      { label: 'ITR Form', value: summary.suggested_itr_form || 'N/A', icon: '📋', color: '#1a1816' },
    ],
  };

  return (
    <AppLayout pageTitle="Dashboard" breadcrumb={['Home', 'Dashboard']}>
      <div style={{ backgroundColor: '#faf9f6', minHeight: '100vh', margin: '-1.5rem -1.5rem 0 -1.5rem', padding: '1.5rem' }}>
        {/* UNIFIED OVERVIEW - All 9 KPIs in 6-column grid */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700, color: "#5a5550", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            📊 Key Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...kpiSections.financialOverview, ...kpiSections.taxSnapshot, ...kpiSections.businessHealth].map((metric, i) => (
              <div
                key={i}
                className="bg-white border border-[#e0ddd6] rounded-lg p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {metric.label}
                  </span>
                  <span style={{ fontSize: '0.95rem' }}>{metric.icon}</span>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "2rem", fontWeight: 700, letterSpacing: '-0.02em', color: metric.color, lineHeight: 1 }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* 🚨 Compliance Alerts */}
      {complianceFlags.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700, color: "#5a5550", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            🚨 Alerts
          </h3>
          <div className="space-y-2">
            {complianceFlags.map((flag, i) => (
              <div
                key={i}
                className="border-l-4 p-4 bg-white rounded-lg"
                style={{
                  borderLeftColor: flag.severity === 'high' ? '#d4534f' : flag.severity === 'medium' ? '#c9a961' : '#8a867f',
                }}
              >
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#8a867f", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: '0.25rem' }}>
                  {flag.severity}
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#1a1816", lineHeight: "1.5" }}>
                  {flag.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📊 Income & Expense Breakdown - DONUT CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Income Distribution - Donut */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            📊 Income Distribution
          </h3>
          {incomeSplitData.length > 0 ? (
            <div className="flex flex-col items-center">
              <DonutChart
                data={incomeSplitData}
                colors={['#2d5a3a', '#4a7c52', '#6b9a73', '#8bb794', '#a5d4b5', '#c0f0d6']}
                width={200}
                height={200}
              />
              <div className="mt-6 w-full space-y-2">
                {incomeSplitData.map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: ['#2d5a3a', '#4a7c52', '#6b9a73', '#8bb794', '#a5d4b5', '#c0f0d6'][i % 6],
                          borderRadius: '2px',
                        }}
                      />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#1a1816" }}>
                        {item.category}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: "#8a867f" }}>
                        {item.percentage}%
                      </span>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "0.95rem", fontWeight: 600, color: "#2d5a3a", minWidth: '80px', textAlign: 'right' }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No income data available
            </p>
          )}
        </div>

        
      </div>

      {/* Monthly Cashflow & Transaction Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Cashflow - LINE CHART */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            📈 Monthly Cashflow
          </h3>
          {monthlyData.length > 0 ? (
            <div className="flex justify-center overflow-x-auto">
              <LineChart data={monthlyData} width={350} height={220} />
            </div>
          ) : (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No monthly data available
            </p>
          )}
        </div>

        {/* Transaction Volume by Category - HORIZONTAL BAR CHART */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            📊 Transaction Volume
          </h3>
          {transactionCategories.length > 0 ? (
            <div className="flex justify-center overflow-x-auto">
              <HorizontalBarChart data={transactionCategories} width={350} height={280} />
            </div>
          ) : (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No transaction data available
            </p>
          )}
        </div>
      </div>

      {/* Income vs Expense & Tax Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Income vs Expense Comparison */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            💰 Income vs Expense
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Total Income', value: summary.total_income, color: '#2d5a3a', icon: '📈' },
              { label: 'Total Expenses', value: summary.total_expenses, color: '#d4534f', icon: '📉' },
              { label: 'Net Cashflow', value: summary.net_cashflow, color: '#c9a961', icon: '✓' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#f5f3ed] border border-[#e0ddd6] rounded">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#1a1816" }}>
                    {item.label}
                  </span>
                </div>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 700, color: item.color }}>
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
            <div className="pt-4 border-t border-[#e0ddd6]">
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8125rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: '0.5rem' }}>
                Profitability Ratio
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 700, color: profitability > 0 ? "#2d5a3a" : "#d4534f" }}>
                {profitability}%
              </div>
            </div>
          </div>
        </div>

        {/* Tax Breakdown - GAUGE CHART */}
        <div className="bg-white border border-[#e0ddd6] p-8">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            🧾 Tax Payment Status
          </h3>
          <div className="flex flex-col items-center justify-center">
            <GaugeChart
              value={summary.total_tax_liability - summary.balance_tax_payable}
              max={summary.total_tax_liability || 1}
              color="#c9a961"
              width={180}
              height={180}
            />
            <div className="mt-6 w-full space-y-3 text-center">
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Tax Liability
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem", fontWeight: 700, color: "#c9a961" }}>
                  {formatCurrency(summary.total_tax_liability)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 600, color: "#8a867f" }}>
                    Balance
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 600, color: "#d4534f" }}>
                    {formatCurrency(summary.balance_tax_payable)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 600, color: "#8a867f" }}>
                    Savings
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 600, color: "#2d5a3a" }}>
                    {formatCurrency(summary.estimated_savings)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Where Your Money Goes - Signature Component with DONUT CHART */}
      <div className="bg-white border border-[#e0ddd6] p-8 mb-8">
        <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          💸 Where Your Money Goes
        </h3>
        {summary.total_income ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Donut Chart */}
            <div className="flex justify-center lg:col-span-1">
              <DonutChart
                data={[
                  { category: 'Expenses', amount: summary.total_expenses || 0, percentage: Math.round((summary.total_expenses / summary.total_income) * 100) },
                  { category: 'Taxes & GST', amount: (summary.total_tax_liability || 0) + (assistantContext.net_gst_payable || 0), percentage: Math.round((((summary.total_tax_liability || 0) + (assistantContext.net_gst_payable || 0)) / summary.total_income) * 100) },
                  { category: 'Remaining', amount: summary.net_cashflow || 0, percentage: Math.round((summary.net_cashflow / summary.total_income) * 100) },
                ]}
                colors={['#d4534f', '#c9a961', '#2d5a3a']}
                width={200}
                height={200}
              />
            </div>

            {/* Legend & Values */}
            <div className="lg:col-span-2 space-y-4">
              {[
                { label: 'Expenses', value: summary.total_expenses, color: '#d4534f', percent: Math.round((summary.total_expenses / summary.total_income) * 100) },
                { label: 'Taxes & GST', value: (summary.total_tax_liability || 0) + (assistantContext.net_gst_payable || 0), color: '#c9a961', percent: Math.round((((summary.total_tax_liability || 0) + (assistantContext.net_gst_payable || 0)) / summary.total_income) * 100) },
                { label: 'Remaining / Savings', value: summary.net_cashflow, color: '#2d5a3a', percent: Math.round((summary.net_cashflow / summary.total_income) * 100) },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#f5f3ed] border border-[#e0ddd6] rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "#1a1816" }}>
                      {item.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 700, color: item.color }}>
                      {formatCurrency(item.value)}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#8a867f" }}>
                      {item.percent}% of income
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
            No income data available
          </p>
        )}
      </div>

      {/* 🤖 AI Insights */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          🤖 AI Insights
        </h2>
        <div className="space-y-3">
          {insights.length > 0 ? (
            insights.map((insight, i) => (
              <div key={i} className="bg-white border border-[#e0ddd6] p-6 flex items-start gap-4 hover:border-[#c9a961] transition-colors">
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "#c9a961", lineHeight: "1" }}>
                  ✦
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: "#1a1816", lineHeight: "1.6" }}>
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

      {/* Recent Transactions Feed */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          📋 Recent Transactions
        </h2>
        {recentTransactions.length > 0 ? (
          <div className="bg-white border border-[#e0ddd6] overflow-hidden">
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f3ed', borderBottom: '1px solid #e0ddd6' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Date</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Merchant</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Category</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Amount</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.slice(0, 10).map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: '1px solid #e0ddd6' }}>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#1a1816' }}>
                        {new Date(txn.date).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#1a1816' }}>
                        {txn.merchant}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'inline-block', backgroundColor: '#f5f3ed', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#5a5550', fontWeight: 600 }}>
                          {txn.category}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 600, color: '#1a1816' }}>
                        {formatCurrency(txn.amount)}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: txn.txn_type === 'income' ? '#2d5a3a' : '#d4534f', textTransform: 'capitalize' }}>
                        {txn.txn_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No recent transactions
            </p>
          </div>
        )}
      </div>

      {/* Transaction Categories Breakdown */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
          📊 Category Breakdown
        </h2>
        {transactionCategories.length > 0 ? (
          <div className="bg-white border border-[#e0ddd6] overflow-hidden">
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f3ed', borderBottom: '1px solid #e0ddd6' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Category</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Count</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Income</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Expense</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionCategories.map((cat) => (
                    <tr key={cat.category} style={{ borderBottom: '1px solid #e0ddd6' }}>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#1a1816', fontWeight: 600 }}>
                        {cat.category}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#5a5550' }}>
                        {cat.count}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', fontWeight: 600, color: '#2d5a3a' }}>
                        {formatCurrency(cat.income || 0)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', fontWeight: 600, color: '#d4534f' }}>
                        {formatCurrency(cat.expense || 0)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', fontWeight: 600, color: cat.net_amount > 0 ? '#2d5a3a' : '#d4534f' }}>
                        {formatCurrency(cat.net_amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              No category data available
            </p>
          </div>
        )}
      </div>

      {/* Filing Information & Data Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#e0ddd6] p-6">
          <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.25rem", fontWeight: 600, color: "#1a1816", marginBottom: '1.5rem' }}>
            📋 Filing Information
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Job ID', value: job.job_id?.substring(0, 12) + '...' },
              { label: 'Financial Year', value: job.financial_year },
              { label: 'Status', value: job.status, color: job.status === 'exported' ? '#2d5a3a' : job.status === 'approved' ? '#c9a961' : '#8a867f' },
              { label: 'Updated', value: job.updated_at ? new Date(job.updated_at).toLocaleDateString('en-IN') : 'N/A' },
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
            📊 Data Summary
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
                {highlights.missing_data_count || 0} missing data point{(highlights.missing_data_count || 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
