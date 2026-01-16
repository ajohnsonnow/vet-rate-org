import React from 'react';

function AffiliateRecommendations() {
  const recommendations = [
    {
      category: 'Document Organization',
      items: [
        {
          name: 'High-Speed Document Scanner',
          description: 'Digitize your medical records quickly and efficiently',
          amazonLink: 'https://www.amazon.com/s?k=document+scanner',
          price: '$150-300',
        },
        {
          name: 'File Organizer with Labels',
          description: 'Keep your claim documents organized and accessible',
          amazonLink: 'https://www.amazon.com/s?k=file+organizer',
          price: '$20-40',
        },
      ],
    },
    {
      category: 'Reference Materials',
      items: [
        {
          name: '38 CFR Medical Dictionary',
          description: 'Understand VA medical terminology and ratings',
          amazonLink: 'https://www.amazon.com/s?k=medical+dictionary',
          price: '$25-50',
        },
        {
          name: 'Veterans Benefits Guide',
          description: 'Comprehensive guide to VA benefits and claims',
          amazonLink: 'https://www.amazon.com/s?k=veterans+benefits+guide',
          price: '$15-30',
        },
      ],
    },
  ];

  return (
    <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-va-blue" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
        </svg>
        <h3 className="text-xl font-bold text-gray-800">Recommended Gear for Claims</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        These tools can help you organize and document your VA disability claim more effectively.
        <span className="text-xs text-gray-500 italic ml-1">
          (As an Amazon Associate, I earn from qualifying purchases)
        </span>
      </p>

      <div className="space-y-6">
        {recommendations.map((category) => (
          <div key={category.category}>
            <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
              {category.category}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.items.map((item) => (
                <a
                  key={item.name}
                  href={item.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-va-blue hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-semibold text-gray-900 group-hover:text-va-blue transition-colors">
                      {item.name}
                    </h5>
                    <span className="text-sm font-bold text-green-600">{item.price}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                  <div className="flex items-center text-xs text-va-blue font-semibold group-hover:underline">
                    View on Amazon
                    <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h3.586L9.293 10.293a1 1 0 001.414 1.414L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AffiliateRecommendations;
