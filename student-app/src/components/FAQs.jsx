import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaQuestionCircle } from 'react-icons/fa';
import '../styles/FAQs.css';

const FAQs = ({ onNavigate }) => {
  const [openIndex, setOpenIndex] = useState(0);

  const faqSections = [
    {
      title: 'Submitting a Request',
      items: [
        {
          question: "Can I submit a request outside office hours?",
          answer: "Yes. You can submit requests through the system at any time. However, school staff will process requests during official office hours."
        },
        {
          question: "Can I attach documents to my request?",
          answer: "Yes. You can upload relevant supporting documents when submitting a request, if required by the selected office or request type."
        },
        {
          question: "Can I submit multiple requests?",
          answer: "Yes. You can submit multiple requests when they concern different academic needs. Each request will have its own ticket for easier tracking."
        },
        {
          question: "Which school offices can I send requests to?",
          answer: "The system is designed to support academic requests handled by participating school offices, such as the Registrar, Library, Guidance Office, and Finance Office."
        }
      ]
    },
    {
      title: 'Tracking Your Request',
      items: [
        {
          question: "How can I check the status of my request?",
          answer: "Go to your submitted requests or ticket history. You can view the current status and updates of each request."
        },
        {
          question: "What do the ticket statuses mean?",
          answer: "Pending: Your request has been submitted and is waiting for processing.\n\nIn Progress: The assigned office is currently handling your request.\n\nResolved: The office has completed the request.\n\nClosed: The request has been completed and finalized."
        },
        {
          question: "How will I know if my request has been updated?",
          answer: "You can check your ticket status and view updates in the system. Notifications may also be provided when there are changes to your request."
        },
        {
          question: "How long will my request take?",
          answer: "Processing time depends on the type of request and the requirements involved. You can monitor your request status through the system."
        }
      ]
    },
    {
      title: 'Managing Your Request',
      items: [
        {
          question: "What should I do if I submitted incorrect information?",
          answer: "Contact the appropriate school office or follow the instructions provided in the system. Do not submit duplicate requests unless instructed to do so."
        },
        {
          question: "Can I cancel or modify a submitted request?",
          answer: "Request modification or cancellation depends on the current status of your ticket. Contact the appropriate school office for assistance."
        }
      ]
    },
    {
      title: 'Account & Security',
      items: [
        {
          question: "Is my personal information secure?",
          answer: "The system is designed to protect user information through secure authentication and controlled access. Only authorized users should have access to relevant request information."
        },
        {
          question: "What if I forget my password?",
          answer: "Use the available password recovery option or contact the designated school administrator for assistance."
        }
      ]
    },
    {
      title: 'Getting Help',
      items: [
        {
          question: "What should I do if I encounter a problem with the system?",
          answer: "Report the issue to the designated system administrator or school office. Provide details about the problem so it can be investigated and resolved."
        }
      ]
    }
  ];

  // Pre-compute the flat index of each item so the single-open accordion works across sections
  const sectionOffsets = [];
  let acc = 0;
  faqSections.forEach((section, i) => {
    sectionOffsets[i] = acc;
    acc += section.items.length;
  });

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const scrollToSection = (sIndex) => {
    const el = document.getElementById(`faq-section-${sIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="faqs-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">FAQ's</h1>
          <p className="page-subtitle">Find answers to common questions about the student request system</p>
        </div>
      </div>

      <div className="faqs-content">
        <div className="faqs-main">
          <div className="faqs-sections">
            {faqSections.map((section, sIndex) => (
              <section key={sIndex} id={`faq-section-${sIndex}`} className="faq-section" aria-labelledby={`faq-section-title-${sIndex}`}>
                <h2 id={`faq-section-title-${sIndex}`} className="faq-section-title">
                  {section.title}
                </h2>
                <div className="faq-section-list">
                  {section.items.map((faq, iIndex) => {
                    const index = sectionOffsets[sIndex] + iIndex;
                    return (
                      <div
                        key={index}
                        className={`faq-item ${openIndex === index ? 'active' : ''}`}
                      >
                        <button
                          type="button"
                          className="faq-question"
                          onClick={() => toggleFAQ(index)}
                          aria-expanded={openIndex === index}
                        >
                          <span className="question-text">{faq.question}</span>
                          <span className="question-icon" aria-hidden="true">
                            {openIndex === index ? <FaChevronUp /> : <FaChevronDown />}
                          </span>
                        </button>

                        <div className={`faq-answer ${openIndex === index ? 'open' : ''}`}>
                          <div className="answer-content">
                            {faq.answer.split('\n\n').map((paragraph, pIndex) => (
                              <p key={pIndex}>{paragraph}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="faqs-sidebar" aria-label="Quick navigation and help">
          <div className="faq-sidebar-card faq-nav-card">
            <h3 className="faq-sidebar-title">Categories</h3>
            <nav className="faq-topic-nav" aria-label="FAQ Topics">
              {faqSections.map((section, sIndex) => (
                <button
                  key={sIndex}
                  type="button"
                  className="faq-topic-link"
                  onClick={() => scrollToSection(sIndex)}
                >
                  <span className="faq-topic-name">{section.title}</span>
                  <span className="faq-topic-count">{section.items.length}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="faq-sidebar-card faq-help-card">
            <div className="faq-help-icon-wrap" aria-hidden="true">
              <FaQuestionCircle className="faq-help-icon" />
            </div>
            <h3 className="faq-help-title">Still have questions?</h3>
            <p className="faq-help-text">
              Can't find what you need? Reach out to the school office or submit a feedback directly.
            </p>
            {onNavigate && (
              <button
                type="button"
                className="faq-help-btn"
                onClick={() => onNavigate('feedback')}
              >
                Submit Feedback
              </button>
            )}
            <div className="faq-help-contact">
              <div className="faq-contact-item">
                <span className="faq-contact-label">Office Hours</span>
                <span className="faq-contact-val">Mon – Fri: 7:00 AM – 7:00 PM</span>
              </div>
              <div className="faq-contact-item">
                <span className="faq-contact-label">Email Support</span>
                <span className="faq-contact-val">academiadesanjose@gmail.com</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default FAQs;
