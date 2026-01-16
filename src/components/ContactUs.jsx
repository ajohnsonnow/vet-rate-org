import React, { useState } from 'react';

const ContactUs = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create mailto link with form data
    const mailtoLink = `mailto:anthony.johnson.now@gmail.com?subject=${encodeURIComponent(formData.subject || 'Contact from Vet-Rate.org')}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    )}`;
    
    window.location.href = mailtoLink;
    setSubmitted(true);
    
    // Reset form after 2 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 className="text-2xl font-bold text-gray-900">Contact Us</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <section className="mb-6">
            <p className="text-gray-700 mb-4">
              Have questions, feedback, or suggestions? We'd love to hear from you! Whether you've found an error, 
              want to suggest a feature, or just want to say thanks, feel free to reach out.
            </p>
          </section>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <svg className="mx-auto mb-4 w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-xl font-bold text-green-800 mb-2">Your email client will open shortly!</h3>
              <p className="text-green-700">Thank you for reaching out. We'll get back to you as soon as possible.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john.doe@example.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Question about rating criteria"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  value={formData.message}
                  onChange={handleChange}
                  rows="6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Tell us what's on your mind..."
                ></textarea>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will open your default email client. If you prefer, you can 
                  email us directly at{' '}
                  <a href="mailto:anthony.johnson.now@gmail.com" className="underline">
                    anthony.johnson.now@gmail.com
                  </a>
                </p>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Send Message
              </button>
            </form>
          )}

          <section className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Other Ways to Connect</h3>
            <ul className="space-y-2 text-gray-700">
              <li>
                <strong>GitHub:</strong>{' '}
                <a 
                  href="https://github.com/ajohnsonnow/vet-rate-org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  github.com/ajohnsonnow/vet-rate-org
                </a>
              </li>
              <li>
                <strong>Report an Issue:</strong> Found a bug? Open an issue on our{' '}
                <a 
                  href="https://github.com/ajohnsonnow/vet-rate-org/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Issues page
                </a>
              </li>
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Frequently Asked Questions</h3>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-gray-800">Q: Is this an official VA website?</p>
                <p className="text-gray-700 text-sm">
                  No, Vet-Rate.org is an independent educational tool. We are not affiliated with the U.S. 
                  Department of Veterans Affairs.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: Do you provide legal or medical advice?</p>
                <p className="text-gray-700 text-sm">
                  No, this tool is for educational purposes only. Please consult qualified professionals for 
                  advice specific to your situation.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: How can I support this project?</p>
                <p className="text-gray-700 text-sm">
                  Share it with fellow veterans! You can also support us by using our affiliate links or 
                  donating via Buy Me a Coffee.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
