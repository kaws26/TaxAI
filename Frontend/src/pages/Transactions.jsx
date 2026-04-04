import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

const API_URL = 'https://taxai-77xc.onrender.com';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_URL}/api/tax-assistant/transactions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch transactions');

        const data = await response.json();
        setTransactions(Array.isArray(data) ? data : data.transactions || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/tax-assistant/transactions/${txnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete transaction');

      setTransactions(transactions.filter((txn) => txn.id !== txnId));
      setCurrentPage(1); // Reset to first page
    } catch (err) {
      alert(`Error deleting transaction: ${err.message}`);
    }
  };

  // Filter transactions based on criteria
  const filteredTransactions = transactions.filter((txn) => {
    const txnDate = new Date(txn.date);
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    // Date range filter
    if (startDateObj && txnDate < startDateObj) return false;
    if (endDateObj && txnDate > endDateObj) return false;

    // Type filter
    if (filterType && txn.txn_type !== filterType) return false;

    // Category filter
    if (filterCategory && txn.category !== filterCategory) return false;

    // Search filter (merchant or description)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !(txn.merchant?.toLowerCase().includes(search) ||
          txn.description?.toLowerCase().includes(search) ||
          txn.category?.toLowerCase().includes(search))
      ) {
        return false;
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterCategory, searchTerm, startDate, endDate]);

  // Get unique categories for filter
  const uniqueCategories = [...new Set(transactions.map((txn) => txn.category).filter(Boolean))].sort();

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN');
    } catch {
      return dateStr;
    }
  };

  // Calculate summary metrics
  const totalIncome = filteredTransactions
    .filter((txn) => txn.txn_type === 'income')
    .reduce((sum, txn) => sum + (txn.amount || 0), 0);

  const totalExpenses = filteredTransactions
    .filter((txn) => txn.txn_type === 'expense')
    .reduce((sum, txn) => sum + (txn.amount || 0), 0);

  const netFlow = totalIncome - totalExpenses;

  if (loading) {
    return (
      <AppLayout pageTitle="Transactions" breadcrumb={['Home', 'Transactions']}>
        <div className="flex items-center justify-center py-16">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#8a867f' }}>
            Loading transactions...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout pageTitle="Transactions" breadcrumb={['Home', 'Transactions']}>
        <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#d4534f' }}>
            Error loading transactions: {error}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Transactions" breadcrumb={['Home', 'Transactions']}>
      {/* Filters */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.25rem', fontWeight: 600, color: '#1a1816', marginBottom: '1rem' }}>
          🔍 Filters
        </h2>
        <div className="bg-white border border-[#e0ddd6] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#5a5550', display: 'block', marginBottom: '0.5rem' }}>
                Search
              </label>
              <input
                type="text"
                placeholder="Merchant, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e0ddd6',
                  borderRadius: '0.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Type Filter */}
            <div>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#5a5550', display: 'block', marginBottom: '0.5rem' }}>
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e0ddd6',
                  borderRadius: '0.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#5a5550', display: 'block', marginBottom: '0.5rem' }}>
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e0ddd6',
                  borderRadius: '0.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">All Categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#5a5550', display: 'block', marginBottom: '0.5rem' }}>
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e0ddd6',
                  borderRadius: '0.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* End Date */}
            <div>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: '#5a5550', display: 'block', marginBottom: '0.5rem' }}>
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e0ddd6',
                  borderRadius: '0.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {(searchTerm || filterType || filterCategory || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('');
                setFilterCategory('');
                setStartDate('');
                setEndDate('');
              }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#8a867f',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#6f6c65'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#8a867f'}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.5rem', fontWeight: 600, color: '#1a1816', marginBottom: '1.5rem' }}>
          📊 Transaction Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: '#8a867f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Total Income
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 700, color: '#2d5a3a' }}>
              {formatCurrency(totalIncome)}
            </div>
          </div>

          <div className="bg-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: '#8a867f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Total Expenses
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 700, color: '#d4534f' }}>
              {formatCurrency(totalExpenses)}
            </div>
          </div>

          <div className="bg-white border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors">
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: '#8a867f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Net Flow
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 700, color: netFlow > 0 ? '#2d5a3a' : '#d4534f' }}>
              {formatCurrency(netFlow)}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="mb-8">
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.5rem', fontWeight: 600, color: '#1a1816', marginBottom: '1rem' }}>
          📋 All Transactions
        </h2>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#8a867f', marginBottom: '1rem' }}>
          Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length} transactions
        </p>

        {paginatedTransactions.length > 0 ? (
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
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Description</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Source</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#5a5550' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: '1px solid #e0ddd6' }}>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#1a1816' }}>
                        {formatDate(txn.date)}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#1a1816' }}>
                        {txn.merchant || 'N/A'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'inline-block', backgroundColor: '#f5f3ed', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#5a5550' }}>
                          {txn.category || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 600, color: '#1a1816' }}>
                        {formatCurrency(txn.amount)}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: txn.txn_type === 'income' ? '#2d5a3a' : '#d4534f', textTransform: 'capitalize' }}>
                        {txn.txn_type}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#5a5550', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.description || '-'}
                      </td>
                      <td style={{ padding: '1rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#5a5550' }}>
                        {txn.document_type || '-'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteTransaction(txn.id)}
                          style={{
                            backgroundColor: '#d4534f',
                            color: 'white',
                            border: 'none',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#c9423e'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#d4534f'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-[#f5f3ed] border-t border-[#e0ddd6] flex items-center justify-between">
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#5a5550' }}>
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #e0ddd6',
                      backgroundColor: currentPage === 1 ? '#f5f3ed' : 'white',
                      color: '#1a1816',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      borderRadius: '0.25rem',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      opacity: currentPage === 1 ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage > 1) e.target.style.borderColor = '#c9a961';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#e0ddd6';
                    }}
                  >
                    ← Previous
                  </button>

                  {/* Page number buttons */}
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        if (idx > 0 && arr[idx - 1] !== page - 1) {
                          return [
                            <span key={`ellipsis-${page}`} style={{ padding: '0 0.25rem', color: '#8a867f' }}>
                              ...
                            </span>,
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              style={{
                                padding: '0.5rem 0.75rem',
                                border: page === currentPage ? '2px solid #c9a961' : '1px solid #e0ddd6',
                                backgroundColor: page === currentPage ? '#f5f3ed' : 'white',
                                color: '#1a1816',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.875rem',
                                fontWeight: page === currentPage ? 600 : 500,
                                minWidth: '2.5rem',
                              }}
                            >
                              {page}
                            </button>,
                          ];
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: page === currentPage ? '2px solid #c9a961' : '1px solid #e0ddd6',
                              backgroundColor: page === currentPage ? '#f5f3ed' : 'white',
                              color: '#1a1816',
                              cursor: 'pointer',
                              borderRadius: '0.25rem',
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.875rem',
                              fontWeight: page === currentPage ? 600 : 500,
                              minWidth: '2.5rem',
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #e0ddd6',
                      backgroundColor: currentPage === totalPages ? '#f5f3ed' : 'white',
                      color: '#1a1816',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      borderRadius: '0.25rem',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      opacity: currentPage === totalPages ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage < totalPages) e.target.style.borderColor = '#c9a961';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#e0ddd6';
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#f5f3ed] border border-[#e0ddd6] p-6">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', color: '#8a867f' }}>
              {filteredTransactions.length === 0 && (searchTerm || filterType || filterCategory || startDate || endDate)
                ? 'No transactions match your filters'
                : 'No transactions available'}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
