/**
 * Example Component: About Us Section
 * Demonstrates using dynamic copy with auto-updating stats
 */

import React from 'react';
import { useAboutUsContent, useDynamicCopy } from '../hooks/useDynamicCopy';

export const AboutUsExample = () => {
  const aboutUs = useAboutUsContent();
  const { stats } = useDynamicCopy();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* The Codebase Section */}
      <section>
        <h2 className="text-3xl font-bold mb-4">{aboutUs.theCodebase.heading}</h2>
        <div className="space-y-4">
          {aboutUs.theCodebase.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Why It's Free */}
      <section className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
        <h3 className="text-2xl font-bold mb-3">{aboutUs.whyFree.heading}</h3>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {aboutUs.whyFree.content}
        </p>
      </section>

      {/* The Real Cost */}
      <section className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
        <h3 className="text-2xl font-bold mb-3">{aboutUs.theRealCost.heading}</h3>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {aboutUs.theRealCost.content}
        </p>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatCard label="Hours Invested" value={stats.total_hours} />
        <StatCard label="Lines of Code" value={stats.loc_count} />
        <StatCard label="Validated Conditions" value={stats.validation_count} />
        <StatCard label="Market Value" value={stats.market_value} />
      </section>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{value}</div>
    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</div>
  </div>
);

/**
 * Example Component: Buy Me a Coffee Modal
 */

export const BuyMeACoffeeExample = () => {
  const { copy, stats } = useDynamicCopy();
  const coffee = copy.buyMeACoffee;
  
  // Randomly select a caption (or rotate through them)
  const randomCaption = coffee.captions[Math.floor(Math.random() * coffee.captions.length)];

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
      <h3 className="text-2xl font-bold mb-4">{coffee.longForm.header}</h3>
      
      {/* Body with line breaks preserved */}
      <div className="space-y-3 mb-6">
        {coffee.longForm.body.split('\n\n').map((paragraph, index) => (
          <p key={index} className="text-gray-700 dark:text-gray-300">
            {paragraph}
          </p>
        ))}
      </div>

      {/* CTA Button */}
      <a
        href="https://www.buymeacoffee.com/your-handle"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg text-center transition-colors"
      >
        {coffee.longForm.cta}
      </a>

      {/* Random caption as footer */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4 italic">
        {randomCaption}
      </p>
    </div>
  );
};

/**
 * Example Component: Loading Screen with Dynamic Messages
 */

export const LoadingScreenExample = () => {
  const { copy } = useDynamicCopy();
  const [messageIndex, setMessageIndex] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % copy.uiMessages.loadingScreens.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [copy.uiMessages.loadingScreens.length]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-center">
        {/* Spinner */}
        <div className="mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
        
        {/* Dynamic message */}
        <p className="text-white text-lg animate-pulse">
          {copy.uiMessages.loadingScreens[messageIndex]}
        </p>
      </div>
    </div>
  );
};

/**
 * Example Component: Footer with Dynamic Stats
 */

export const FooterExample = () => {
  const { copy, stats } = useDynamicCopy();
  const footerText = copy.uiMessages.footerMicroCopy[0]; // Use first one or rotate

  return (
    <footer className="bg-gray-800 text-white py-4 px-6 text-center">
      <p className="text-sm">{footerText}</p>
      <p className="text-xs text-gray-400 mt-2">
        Last updated: {stats.last_updated} • Version {stats.version}
      </p>
    </footer>
  );
};

/**
 * Example: Using replace() for custom text
 */

export const CustomTextExample = () => {
  const { replace } = useDynamicCopy();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">
        {replace("Welcome to Vet-Rate")}
      </h2>
      <p className="mt-2">
        {replace("This tool represents {{total_hours}} hours of work, with {{validation_count}} validated conditions.")}
      </p>
      <p className="mt-2 text-sm text-gray-600">
        {replace("Built in {{days_dev}} days with {{productivity_multiplier}}x AI acceleration.")}
      </p>
    </div>
  );
};

export default AboutUsExample;
