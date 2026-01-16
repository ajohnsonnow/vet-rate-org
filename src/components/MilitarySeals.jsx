import React from 'react';

function MilitarySeals() {
  const branches = [
    { name: 'U.S. Army', abbr: 'USA' },
    { name: 'U.S. Navy', abbr: 'USN' },
    { name: 'U.S. Air Force', abbr: 'USAF' },
    { name: 'U.S. Marine Corps', abbr: 'USMC' },
    { name: 'U.S. Space Force', abbr: 'USSF' },
    { name: 'U.S. Coast Guard', abbr: 'USCG' },
    { name: 'National Guard', abbr: 'NG' },
    { name: 'Reserves', abbr: 'RES' },
  ];

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 py-6">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-white text-sm font-semibold mb-4 tracking-wide">
          PROUDLY SERVING ALL BRANCHES
        </h3>
        <div className="flex flex-wrap justify-center items-center gap-6">
          {branches.map((branch) => (
            <div
              key={branch.abbr}
              className="group relative flex flex-col items-center"
              title={branch.name}
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all transform group-hover:scale-110">
                <span className="text-va-blue font-bold text-xs">{branch.abbr}</span>
              </div>
              <span className="mt-1 text-white text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
                {branch.abbr}
              </span>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-400 text-xs mt-4">
          Honoring the service of all veterans, active duty, National Guard, and Reserve members
        </p>
      </div>
    </div>
  );
}

export default MilitarySeals;
