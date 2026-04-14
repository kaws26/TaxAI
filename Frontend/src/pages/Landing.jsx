import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Set scrolled to true when user scrolls past 80% of viewport height
      const heroThreshold = window.innerHeight * 0.8;
      setScrolled(window.scrollY > heroThreshold);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#faf8f5]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
          scrolled ? 'bg-[#16100A] border-b border-[#c9a961]/20' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.75rem",
                fontWeight: 600,
                color: "#f5f5f0",
              }}
            >
              Tax<span style={{ color: "#c9a961" }}>Hacker</span>
            </h1>
          </div>

          {/* Nav Links */}
          <ul className="hidden md:flex items-center gap-6">
            {['Features', 'How It Works', 'Pricing', 'About'].map((link) => (
              <li key={link}>
                <a
                  href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-[#f5f5f0] hover:text-[#c9a961] transition-colors"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <button
            onClick={() => navigate('/auth')}
            className="px-5 py-2 bg-[#c9a961] text-[#1a1816] hover:bg-[#d4b76f] transition-colors"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.025em",
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen bg-[#1a1816] overflow-hidden flex items-center">
        {/* Ledger Grid Background */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, #c9a961 0, #c9a961 1px, transparent 1px, transparent 100%), repeating-linear-gradient(90deg, #c9a961 0, #c9a961 1px, transparent 1px, transparent 100%)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Watermark Rupee Symbol */}
        <div
          className="absolute right-[-5%] top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none select-none"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "72rem",
            lineHeight: "1",
            color: "#c9a961",
          }}
        >
          ₹
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-16 w-full">
          <div className="max-w-3xl">
            <h1
              className="mb-12"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              <div
                style={{
                  fontSize: "4rem",
                  lineHeight: "1.1",
                  fontWeight: 300,
                  color: "#f5f5f0",
                  marginBottom: "0.4rem",
                }}
              >
                Your personal
              </div>
              <div
                style={{
                  fontSize: "4rem",
                  lineHeight: "1.1",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#c9a961",
                  marginBottom: "0.4rem",
                }}
              >
                Chartered Accountant
              </div>
              <div
                style={{
                  fontSize: "4rem",
                  lineHeight: "1.1",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                in your pocket
              </div>
            </h1>

            <p
              className="mb-10"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "1rem",
                lineHeight: "1.6",
                color: "#b8b5af",
                maxWidth: "40rem",
              }}
            >
              TaxHacker is your AI-powered financial operating system. Automatically track expenses, extract data from receipts, optimize taxes, and get personalized financial advice — all in one place.
            </p>

            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-3 bg-[#c9a961] text-[#1a1816] transition-all hover:bg-[#d4b76f]"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.9375rem",
                fontWeight: 600,
                letterSpacing: "0.025em",
              }}
            >
              Start Managing Your Finances
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0f0e0d]/50 backdrop-blur-sm border-t border-[#3a3632] py-6">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "2rem",
                    fontWeight: 600,
                    color: "#c9a961",
                  }}
                >
                  ₹2.4Cr+
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#8a867f",
                    marginTop: "0.4rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Taxes Optimized
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "2rem",
                    fontWeight: 600,
                    color: "#c9a961",
                  }}
                >
                  12,000+
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#8a867f",
                    marginTop: "0.4rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Returns Filed
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "2rem",
                    fontWeight: 600,
                    color: "#c9a961",
                  }}
                >
                  4.8★
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#8a867f",
                    marginTop: "0.4rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  User Rating
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "2rem",
                    fontWeight: 600,
                    color: "#c9a961",
                  }}
                >
                  12 min
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#8a867f",
                    marginTop: "0.4rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Avg. Filing Time
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#c9a961",
                marginBottom: "0.75rem",
              }}
            >
              § How It Works
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.75rem",
                fontWeight: 500,
                color: "#1a1816",
                lineHeight: "1.2",
              }}
            >
              From raw data to financial intelligence
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-10">
              <div className="flex gap-5">
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "3.25rem",
                    fontWeight: 300,
                    color: "#c9a961",
                    lineHeight: "1",
                  }}
                >
                  01
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Crimson Pro', serif",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#1a1816",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Upload Your Documents
                  </h3>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      color: "#5a5550",
                    }}
                  >
                    Simply upload your Form 16, AIS, or bank statements. Our AI parses every field automatically - no data entry headaches.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "3.25rem",
                    fontWeight: 300,
                    color: "#c9a961",
                    lineHeight: "1",
                  }}
                >
                  02
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Crimson Pro', serif",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#1a1816",
                      marginBottom: "0.5rem",
                    }}
                  >
                    AI Processes Everything
                  </h3>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      color: "#5a5550",
                    }}
                  >
                    Our AI extracts income, deductions, and tax credits. It compares regimes and finds every possible saving opportunity.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "3.25rem",
                    fontWeight: 300,
                    color: "#c9a961",
                    lineHeight: "1",
                  }}
                >
                  03
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Crimson Pro', serif",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#1a1816",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Review & File
                  </h3>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      color: "#5a5550",
                    }}
                  >
                    Review your draft ITR, approve it, and file directly with Aadhaar OTP. Get your refund status in real-time.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Chat Mockup */}
            <div className="bg-white border border-[#e0ddd6] overflow-hidden shadow-lg">
              <div className="bg-[#1a1816] px-6 py-4 border-b border-[#3a3632]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#c9a961] rounded-full flex items-center justify-center font-semibold text-[#1a1816]">
                    AI
                  </div>
                  <div>
                    <div className="text-white font-semibold">TaxHacker AI</div>
                    <div className="text-[#8a867f] text-sm">Your Financial Assistant</div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 h-96 overflow-y-auto">
                <div className="flex justify-start">
                  <div className="bg-[#f5f3ed] px-4 py-3 rounded-2xl rounded-tl-none max-w-xs">
                    <p className="text-[#1a1816]">I've analyzed your Form 16. You have ₹8.5L in gross salary.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="bg-[#c9a961] px-4 py-3 rounded-2xl rounded-tr-none max-w-xs">
                    <p className="text-[#1a1816]">Can I save more tax?</p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-[#f5f3ed] px-4 py-3 rounded-2xl rounded-tl-none max-w-xs">
                    <p className="text-[#1a1816]">Yes! You can save ₹18,200 by switching to the new tax regime. Would you like me to optimize it?</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="bg-[#c9a961] px-4 py-3 rounded-2xl rounded-tr-none max-w-xs">
                    <p className="text-[#1a1816]">Yes, please!</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#e0ddd6] p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about your taxes..."
                    className="flex-1 px-4 py-2 border border-[#e0ddd6] rounded-lg focus:outline-none focus:border-[#c9a961]"
                  />
                  <button className="px-6 py-2 bg-[#c9a961] text-[#1a1816] rounded-lg font-semibold hover:bg-[#d4b76f]">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2
            className="mb-6"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.75rem",
              color: "#1a1816",
            }}
          >
            More than taxes. This is your financial brain.
          </h2>

          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "1rem",
              color: "#5a5550",
              maxWidth: "48rem",
              margin: "0 auto",
            }}
          >
            TaxHacker doesn't just file your taxes — it understands your financial life. From tracking every rupee to optimizing your savings, everything is automated using AI.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#c9a961",
                marginBottom: "0.75rem",
              }}
            >
              ¶ Features
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.75rem",
                fontWeight: 500,
                color: "#1a1816",
                lineHeight: "1.2",
              }}
            >
              Everything a modern filer needs
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "§",
                title: "Smart Document Ingestion",
                description:
                  "Upload receipts, invoices, and bills. Our AI extracts amounts, dates, merchants, and categorizes everything automatically.",
              },
              {
                icon: "⚖",
                title: "Old vs New Regime Calculator",
                description:
                  "Instant side-by-side comparison of tax liability under both regimes. We'll tell you which saves more and why.",
              },
              {
                icon: "₹",
                title: "AI Expense Tracking",
                description:
                  "Track every transaction automatically. Get insights on spending patterns and personalized recommendations.",
              },
              {
                icon: "✓",
                title: "Tax Optimization Engine",
                description:
                  "AI-powered recommendations to minimize your tax liability. Save thousands with smart deduction planning.",
              },
              {
                icon: "⊕",
                title: "Personalized Financial Advisor",
                description:
                  "Get context-aware advice based on your income, expenses, and financial behavior. Like having a CA on call 24/7.",
              },
              {
                icon: "◆",
                title: "ITR Draft Generation",
                description:
                  "Auto-generated draft ITR ready for filing. Review, approve, and file directly with Aadhaar OTP.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="border border-[#e0ddd6] p-6 hover:border-[#c9a961] transition-colors"
              >
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "2.5rem",
                    color: "#c9a961",
                    marginBottom: "0.75rem",
                  }}
                >
                  {feature.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "#1a1816",
                    marginBottom: "0.5rem",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.9375rem",
                    lineHeight: "1.6",
                    color: "#5a5550",
                  }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regime Comparison */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#c9a961",
                marginBottom: "0.75rem",
              }}
            >
              ⚖ Tax Comparison
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.75rem",
                fontWeight: 500,
                color: "#1a1816",
                lineHeight: "1.2",
              }}
            >
              Old vs New Regime Analysis
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Old Regime */}
            <div className="bg-white border-2 border-[#c9a961] p-6 relative">
              <div className="absolute top-0 right-0 bg-[#c9a961] text-[#1a1816] px-3 py-1 text-xs font-semibold">
                Recommended
              </div>
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#1a1816",
                  marginBottom: "1rem",
                  marginTop: "0.75rem",
                }}
              >
                Old Tax Regime
              </h3>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Gross Salary</span>
                  <span className="font-semibold text-[#1a1816] text-sm">₹8,50,000</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Deductions (80C, 80D)</span>
                  <span className="font-semibold text-[#2d5a3a] text-sm">-₹1,80,000</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Taxable Income</span>
                  <span className="font-semibold text-[#1a1816] text-sm">₹6,70,000</span>
                </div>
              </div>

              <div className="bg-[#f5f3ed] p-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#1a1816] text-sm">Total Tax Liability</span>
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#1a1816",
                    }}
                  >
                    ₹62,400
                  </span>
                </div>
              </div>
            </div>

            {/* New Regime */}
            <div className="bg-white border border-[#e0ddd6] p-6 opacity-75">
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#1a1816",
                  marginBottom: "1rem",
                }}
              >
                New Tax Regime
              </h3>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Gross Salary</span>
                  <span className="font-semibold text-[#1a1816] text-sm">₹8,50,000</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Deductions</span>
                  <span className="font-semibold text-[#8a867f] text-sm">Not Allowed</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#e0ddd6]">
                  <span className="text-[#5a5550] text-sm">Taxable Income</span>
                  <span className="font-semibold text-[#1a1816] text-sm">₹8,50,000</span>
                </div>
              </div>

              <div className="bg-[#f5f3ed] p-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#1a1816] text-sm">Total Tax Liability</span>
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#1a1816",
                    }}
                  >
                    ₹80,600
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Savings Callout */}
          <div className="bg-[#2d5a3a] text-white p-6 text-center">
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.25rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Save ₹18,200 with Old Regime
            </div>
            <p className="text-sm opacity-90">Based on your current income and deductions</p>
          </div>
        </div>
      </section>

      {/* Deduction Tracker */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#c9a961",
                marginBottom: "0.75rem",
              }}
            >
              § Deduction Tracking
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.75rem",
                fontWeight: 500,
                color: "#1a1816",
                lineHeight: "1.2",
              }}
            >
              Maximize your deductions effortlessly
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Progress Bars */}
            <div className="lg:col-span-2 space-y-6">
              {[
                { section: "80C", subtitle: "ELSS, PPF, Life Insurance", used: 150000, limit: 150000 },
                { section: "80D", subtitle: "Health Insurance", used: 25000, limit: 50000 },
                { section: "80G", subtitle: "Donations", used: 10000, limit: 50000 },
                { section: "HRA", subtitle: "House Rent Allowance", used: 96000, limit: 120000 },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <div>
                      <div
                        style={{
                          fontFamily: "'Crimson Pro', serif",
                          fontSize: "1.1rem",
                          fontWeight: 600,
                          color: "#1a1816",
                        }}
                      >
                        Section {item.section}
                      </div>
                      <div className="text-xs text-[#8a867f]">{item.subtitle}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#1a1816] text-sm">
                        ₹{item.used.toLocaleString()}
                      </div>
                      <div className="text-xs text-[#8a867f]">
                        of ₹{item.limit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-[#e0ddd6] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#c9a961] h-full transition-all"
                      style={{ width: `${(item.used / item.limit) * 100}%` }}
                    />
                  </div>
                  {item.used < item.limit && (
                    <div className="text-xs text-[#5a5550] mt-1.5">
                      ₹{(item.limit - item.used).toLocaleString()} remaining
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* KPI Panel */}
            <div className="bg-[#1a1816] text-white p-6 h-fit">
              <h3
                style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  marginBottom: "1.5rem",
                }}
              >
                Your Tax Summary
              </h3>

              <div className="space-y-5">
                <div>
                  <div className="text-[#8a867f] text-xs mb-0.5">Total Deductions</div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.6rem",
                      fontWeight: 600,
                      color: "#c9a961",
                    }}
                  >
                    ₹2,81,000
                  </div>
                </div>

                <div>
                  <div className="text-[#8a867f] text-xs mb-0.5">Additional Savings Possible</div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.6rem",
                      fontWeight: 600,
                      color: "#c9a961",
                    }}
                  >
                    ₹39,000
                  </div>
                </div>

                <div>
                  <div className="text-[#8a867f] text-xs mb-0.5">Tax Savings</div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.6rem",
                      fontWeight: 600,
                      color: "#c9a961",
                    }}
                  >
                    ₹87,120
                  </div>
                </div>
              </div>

              <button className="w-full mt-6 px-6 py-2 bg-[#c9a961] text-[#1a1816] font-semibold text-sm hover:bg-[#d4b76f] transition-colors">
                Optimize Further
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-[#1a1816]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#c9a961",
                marginBottom: "0.75rem",
              }}
            >
              ✦ Testimonials
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.75rem",
                fontWeight: 500,
                color: "#f5f5f0",
                lineHeight: "1.2",
              }}
            >
              Trusted by thousands of taxpayers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "TaxHacker saved me ₹24,000 this year. The AI found deductions I didn't even know existed. Absolutely worth it!",
                name: "Priya Sharma",
                role: "Software Engineer",
                location: "Bangalore",
                initials: "PS",
              },
              {
                quote:
                  "As a freelancer with multiple income sources, filing taxes was a nightmare. TaxHacker made it incredibly simple.",
                name: "Arjun Mehta",
                role: "Freelance Designer",
                location: "Mumbai",
                initials: "AM",
              },
              {
                quote:
                  "The regime comparison feature showed me I was overpaying for years. Switched and saved big. Thank you!",
                name: "Sneha Reddy",
                role: "Marketing Manager",
                location: "Hyderabad",
                initials: "SR",
              },
            ].map((testimonial, i) => (
              <div key={i} className="bg-[#2a2624] border border-[#3a3632] p-6">
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                    color: "#b8b5af",
                    marginBottom: "1.5rem",
                  }}
                >
                  "{testimonial.quote}"
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#c9a961] rounded-full flex items-center justify-center font-bold text-[#1a1816] text-sm">
                    {testimonial.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{testimonial.name}</div>
                    <div className="text-xs text-[#8a867f]">
                      {testimonial.role} · {testimonial.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.75rem",
              fontWeight: 500,
              color: "#1a1816",
              lineHeight: "1.2",
              marginBottom: "1rem",
            }}
          >
            Ready to take control of your finances?
          </h2>

          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "1rem",
              color: "#5a5550",
              marginBottom: "2rem",
            }}
          >
            Join thousands of smart taxpayers who are saving money and time with TaxHacker.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/auth')} className="px-6 py-2.5 bg-[#c9a961] text-[#1a1816] font-semibold text-sm hover:bg-[#d4b76f] transition-colors">
              Get Started Free
            </button>
            <button onClick={() => navigate('/auth')} className="px-6 py-2.5 bg-transparent border border-[#1a1816] text-[#1a1816] font-semibold text-sm hover:bg-[#1a1816] hover:text-white transition-colors">
              Schedule a Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1816] text-white py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.75rem",
                  fontWeight: 600,
                  color: "#c9a961",
                  marginBottom: "0.75rem",
                }}
              >
                TaxHacker
              </h3>
              <p className="text-[#8a867f] text-xs leading-relaxed">
                Your AI-powered financial operating system for smarter tax filing and wealth management.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-3 text-[#f5f5f0] text-sm">Product</h4>
              <ul className="space-y-1.5 text-[#8a867f] text-xs">
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-3 text-[#f5f5f0] text-sm">Resources</h4>
              <ul className="space-y-1.5 text-[#8a867f] text-xs">
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Tax Calculator
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Tax Guide
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-3 text-[#f5f5f0] text-sm">Company</h4>
              <ul className="space-y-1.5 text-[#8a867f] text-xs">
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#c9a961] transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#3a3632] pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <p className="text-[#8a867f] text-xs">
                © 2026 TaxHacker. All rights reserved.
              </p>
              <p className="text-[#8a867f] text-xs text-center md:text-right">
                This service is not affiliated with the Income Tax Department of India.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
