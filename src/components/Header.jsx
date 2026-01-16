import React from 'react';

function Header() {
  return (
    <header className="bg-gradient-to-r from-va-blue to-green-900 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <img 
              src="/images/Vet-Rate-org-logo.png" 
              alt="Vet-Rate.org Logo" 
              className="h-14 w-auto"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Vet-Rate.org</h1>
              <p className="text-green-100 text-sm md:text-base">
                VA Disability Rating Schedule | 38 CFR Part 4
              </p>
            </div>
          </div>

          <nav className="flex gap-6 md:gap-8">
            <a
              href="https://www.va.gov/disability/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200"
              title="VA Disability Benefits"
            >
              Disability Benefits
            </a>
            <a
              href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200"
              title="eCFR 38 Part 4"
            >
              Rating Schedule
            </a>
            <a
              href="https://www.va.gov/contact-us/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200"
              title="Contact VA"
            >
              Contact VA
            </a>
            <a
              href="https://buymeacoffee.com/vetrate"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-va-gold hover:bg-yellow-400 text-va-blue px-3 py-1 rounded-lg font-semibold transition duration-200"
              title="Support Vet-Rate.org"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              <span className="hidden md:inline">Support</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
