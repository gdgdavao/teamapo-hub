import React, { useState, useEffect } from 'react';
import { 
  AcademicCapIcon,
  PhotoIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  eventId?: string;
  eventTitle?: string;
  design: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    textColor: string;
    titleFontSize: number;
    bodyFontSize: number;
    logoUrl?: string;
    backgroundImageUrl?: string;
    orientation: 'landscape' | 'portrait';
  };
  content: {
    title: string;
    subtitle: string;
    recipientText: string; // e.g., "This is to certify that"
    eventText: string; // e.g., "has successfully completed"
    footerText: string;
    signatoryName: string;
    signatoryTitle: string;
    dateFormat: string;
  };
  isActive: boolean;
  createdAt: string;
  usageCount: number;
}

interface IssuedCertificate {
  id: string;
  templateId: string;
  templateName: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  issuedDate: string;
  verificationCode: string;
  status: 'issued' | 'verified' | 'revoked';
  downloadCount: number;
}

const AdminCertificatesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'issued' | 'designer'>('templates');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');

  // Template designer state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateEventId, setTemplateEventId] = useState('');
  const [design, setDesign] = useState({
    backgroundColor: '#ffffff',
    borderColor: '#4F46E5',
    borderWidth: 4,
    textColor: '#1F2937',
    titleFontSize: 32,
    bodyFontSize: 16,
    logoUrl: '',
    backgroundImageUrl: '',
    orientation: 'landscape' as 'landscape' | 'portrait'
  });
  const [content, setContent] = useState({
    title: 'Certificate of Completion',
    subtitle: 'GDG Davao Technology Events',
    recipientText: 'This is to certify that',
    eventText: 'has successfully completed',
    footerText: 'Awarded on this day',
    signatoryName: 'Event Organizer',
    signatoryTitle: 'GDG Davao Lead',
    dateFormat: 'MMMM DD, YYYY'
  });

  // Load mock data
  useEffect(() => {
    setEvents([
      { id: '1', title: 'Web Development Workshop', date: '2025-02-15' },
      { id: '2', title: 'AI/ML Fundamentals', date: '2025-02-20' },
      { id: '3', title: 'Mobile App Development', date: '2025-02-25' }
    ]);

    setTemplates([
      {
        id: '1',
        name: 'Modern Tech Certificate',
        description: 'Clean, modern design suitable for technical workshops',
        eventId: '1',
        eventTitle: 'Web Development Workshop',
        design: {
          backgroundColor: '#ffffff',
          borderColor: '#4F46E5',
          borderWidth: 4,
          textColor: '#1F2937',
          titleFontSize: 32,
          bodyFontSize: 16,
          logoUrl: '/images/gdg-logo.png',
          backgroundImageUrl: '',
          orientation: 'landscape'
        },
        content: {
          title: 'Certificate of Completion',
          subtitle: 'GDG Davao Technology Workshop',
          recipientText: 'This is to certify that',
          eventText: 'has successfully completed the',
          footerText: 'Awarded on this day',
          signatoryName: 'John Doe',
          signatoryTitle: 'GDG Davao Lead',
          dateFormat: 'MMMM DD, YYYY'
        },
        isActive: true,
        createdAt: '2025-01-10T10:00:00Z',
        usageCount: 45
      },
      {
        id: '2',
        name: 'Professional Certificate',
        description: 'Elegant design for professional events and conferences',
        eventId: '2',
        eventTitle: 'AI/ML Fundamentals',
        design: {
          backgroundColor: '#f8fafc',
          borderColor: '#059669',
          borderWidth: 6,
          textColor: '#064e3b',
          titleFontSize: 28,
          bodyFontSize: 14,
          logoUrl: '/images/gdg-logo.png',
          backgroundImageUrl: '/images/cert-bg.png',
          orientation: 'landscape'
        },
        content: {
          title: 'Certificate of Achievement',
          subtitle: 'GDG Davao AI/ML Workshop Series',
          recipientText: 'We hereby certify that',
          eventText: 'has successfully participated in',
          footerText: 'Given this day of',
          signatoryName: 'Jane Smith',
          signatoryTitle: 'Workshop Instructor',
          dateFormat: 'DD MMMM YYYY'
        },
        isActive: true,
        createdAt: '2025-01-12T14:00:00Z',
        usageCount: 78
      }
    ]);

    setIssuedCertificates([
      {
        id: '1',
        templateId: '1',
        templateName: 'Modern Tech Certificate',
        recipientName: 'John Doe',
        recipientEmail: 'john@example.com',
        eventTitle: 'Web Development Workshop',
        issuedDate: '2025-01-15T16:00:00Z',
        verificationCode: 'CERT-2025-001',
        status: 'verified',
        downloadCount: 3
      },
      {
        id: '2',
        templateId: '1',
        templateName: 'Modern Tech Certificate',
        recipientName: 'Jane Smith',
        recipientEmail: 'jane@example.com',
        eventTitle: 'Web Development Workshop',
        issuedDate: '2025-01-15T16:05:00Z',
        verificationCode: 'CERT-2025-002',
        status: 'issued',
        downloadCount: 1
      },
      {
        id: '3',
        templateId: '2',
        templateName: 'Professional Certificate',
        recipientName: 'Mike Johnson',
        recipientEmail: 'mike@example.com',
        eventTitle: 'AI/ML Fundamentals',
        issuedDate: '2025-01-20T14:30:00Z',
        verificationCode: 'CERT-2025-003',
        status: 'issued',
        downloadCount: 2
      }
    ]);
  }, []);

  const saveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please provide a template name.');
      return;
    }

    const newTemplate: CertificateTemplate = {
      id: editingTemplate?.id || Date.now().toString(),
      name: templateName,
      description: templateDescription,
      eventId: templateEventId || undefined,
      eventTitle: templateEventId ? events.find(e => e.id === templateEventId)?.title : undefined,
      design,
      content,
      isActive: true,
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
      usageCount: editingTemplate?.usageCount || 0
    };

    if (editingTemplate) {
      setTemplates(templates => templates.map(t => t.id === editingTemplate.id ? newTemplate : t));
    } else {
      setTemplates(templates => [newTemplate, ...templates]);
    }

    // Reset form
    resetDesigner();
    setActiveTab('templates');
  };

  const editTemplate = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description);
    setTemplateEventId(template.eventId || '');
    setDesign({
      ...template.design,
      logoUrl: template.design.logoUrl || '',
      backgroundImageUrl: template.design.backgroundImageUrl || ''
    });
    setContent(template.content);
    setActiveTab('designer');
  };

  const resetDesigner = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateEventId('');
    setDesign({
      backgroundColor: '#ffffff',
      borderColor: '#4F46E5',
      borderWidth: 4,
      textColor: '#1F2937',
      titleFontSize: 32,
      bodyFontSize: 16,
      logoUrl: '',
      backgroundImageUrl: '',
      orientation: 'landscape'
    });
    setContent({
      title: 'Certificate of Completion',
      subtitle: 'GDG Davao Technology Events',
      recipientText: 'This is to certify that',
      eventText: 'has successfully completed',
      footerText: 'Awarded on this day',
      signatoryName: 'Event Organizer',
      signatoryTitle: 'GDG Davao Lead',
      dateFormat: 'MMMM DD, YYYY'
    });
  };

  const deleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(templates => templates.filter(t => t.id !== templateId));
    }
  };

  const toggleTemplateStatus = (templateId: string) => {
    setTemplates(templates => 
      templates.map(t => 
        t.id === templateId ? { ...t, isActive: !t.isActive } : t
      )
    );
  };

  const revokeCertificate = (certificateId: string) => {
    if (confirm('Are you sure you want to revoke this certificate?')) {
      setIssuedCertificates(certs => 
        certs.map(cert => 
          cert.id === certificateId ? { ...cert, status: 'revoked' } : cert
        )
      );
    }
  };

  const renderCertificatePreview = () => {
    return (
      <div 
        className={`relative ${design.orientation === 'landscape' ? 'w-full aspect-[4/3]' : 'w-full aspect-[3/4]'} mx-auto border-4 shadow-lg`}
        style={{
          backgroundColor: design.backgroundColor,
          borderColor: design.borderColor,
          borderWidth: `${design.borderWidth}px`,
          color: design.textColor
        }}
      >
        {/* Background Image */}
        {design.backgroundImageUrl && (
          <div 
            className="absolute inset-0 opacity-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${design.backgroundImageUrl})` }}
          />
        )}

        {/* Content */}
        <div className="relative p-8 h-full flex flex-col justify-between">
          {/* Header */}
          <div className="text-center">
            {design.logoUrl && (
              <img 
                src={design.logoUrl} 
                alt="Logo" 
                className="h-12 mx-auto mb-4"
              />
            )}
            <h1 
              className="font-bold mb-2"
              style={{ fontSize: `${design.titleFontSize}px` }}
            >
              {content.title}
            </h1>
            <p 
              className="font-medium mb-6"
              style={{ fontSize: `${design.bodyFontSize}px` }}
            >
              {content.subtitle}
            </p>
          </div>

          {/* Body */}
          <div className="text-center flex-1 flex flex-col justify-center">
            <p 
              className="mb-2"
              style={{ fontSize: `${design.bodyFontSize}px` }}
            >
              {content.recipientText}
            </p>
            <p 
              className="text-2xl font-bold my-4 border-b-2 pb-2 border-current"
              style={{ borderColor: design.textColor }}
            >
              [RECIPIENT NAME]
            </p>
            <p 
              className="mb-2"
              style={{ fontSize: `${design.bodyFontSize}px` }}
            >
              {content.eventText}
            </p>
            <p 
              className="text-xl font-semibold"
              style={{ fontSize: `${design.bodyFontSize + 4}px` }}
            >
              [EVENT TITLE]
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end">
            <div className="text-left">
              <p 
                className="mb-1"
                style={{ fontSize: `${design.bodyFontSize - 2}px` }}
              >
                {content.footerText}
              </p>
              <p 
                className="font-medium"
                style={{ fontSize: `${design.bodyFontSize}px` }}
              >
                [DATE]
              </p>
            </div>
            <div className="text-right">
              <div className="border-t border-current w-32 mb-1"></div>
              <p 
                className="font-medium"
                style={{ fontSize: `${design.bodyFontSize}px` }}
              >
                {content.signatoryName}
              </p>
              <p 
                className="text-sm"
                style={{ fontSize: `${design.bodyFontSize - 2}px` }}
              >
                {content.signatoryTitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredIssuedCertificates = issuedCertificates.filter(cert => {
    const matchesSearch = cert.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cert.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cert.eventTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEvent = !selectedEvent || cert.eventTitle.includes(selectedEvent);
    return matchesSearch && matchesEvent;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Certificate Management</h1>
        <p className="text-gray-600 mt-2">
          Design templates and manage issued certificates
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'templates', name: 'Templates', icon: AcademicCapIcon },
            { id: 'issued', name: 'Issued Certificates', icon: DocumentDuplicateIcon },
            { id: 'designer', name: 'Template Designer', icon: PhotoIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Certificate Templates</h2>
            <button
              onClick={() => {
                resetDesigner();
                setActiveTab('designer');
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="dashboard-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {template.description}
                    </p>
                    {template.eventTitle && (
                      <p className="text-xs text-primary-600 font-medium">
                        📅 {template.eventTitle}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    template.isActive 
                      ? 'bg-success-100 text-success-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Mini Preview */}
                <div className="mb-4 p-2 bg-gray-50 rounded-lg">
                  <div 
                    className="w-full aspect-[4/3] border text-xs flex items-center justify-center"
                    style={{
                      backgroundColor: template.design.backgroundColor,
                      borderColor: template.design.borderColor,
                      color: template.design.textColor
                    }}
                  >
                    <div className="text-center">
                      <div className="font-bold mb-1">{template.content.title}</div>
                      <div className="text-xs">{template.content.subtitle}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{template.usageCount} issued</span>
                  <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editTemplate(template)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button className="text-gray-400 hover:text-gray-600">
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="text-secondary-500 hover:text-secondary-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleTemplateStatus(template.id)}
                    className={`text-xs font-medium ${
                      template.isActive 
                        ? 'text-secondary-600 hover:text-secondary-700' 
                        : 'text-success-600 hover:text-success-700'
                    }`}
                  >
                    {template.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issued Certificates Tab */}
      {activeTab === 'issued' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Issued Certificates</h2>
            <div className="flex space-x-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search certificates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.title}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Template
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issued Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verification Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Downloads
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIssuedCertificates.map((certificate) => (
                    <tr key={certificate.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {certificate.recipientName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {certificate.recipientEmail}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {certificate.eventTitle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {certificate.templateName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(certificate.issuedDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {certificate.verificationCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          certificate.status === 'verified' ? 'bg-success-100 text-success-800' :
                          certificate.status === 'issued' ? 'bg-primary-100 text-primary-800' :
                          'bg-secondary-100 text-secondary-800'
                        }`}>
                          {certificate.status === 'verified' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                          {certificate.status === 'revoked' && <XCircleIcon className="h-3 w-3 mr-1" />}
                          {certificate.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {certificate.downloadCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button className="text-primary-600 hover:text-primary-900">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <CloudArrowUpIcon className="h-4 w-4" />
                          </button>
                          {certificate.status !== 'revoked' && (
                            <button
                              onClick={() => revokeCertificate(certificate.id)}
                              className="text-secondary-600 hover:text-secondary-900"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Template Designer Tab */}
      {activeTab === 'designer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Design Controls */}
          <div className="space-y-6">
            <div className="dashboard-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Describe the template"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Associated Event (Optional)
                  </label>
                  <select
                    value={templateEventId}
                    onChange={(e) => setTemplateEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No specific event</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orientation
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="landscape"
                        checked={design.orientation === 'landscape'}
                        onChange={(e) => setDesign({...design, orientation: e.target.value as 'landscape' | 'portrait'})}
                        className="mr-2"
                      />
                      Landscape
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="portrait"
                        checked={design.orientation === 'portrait'}
                        onChange={(e) => setDesign({...design, orientation: e.target.value as 'landscape' | 'portrait'})}
                        className="mr-2"
                      />
                      Portrait
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Design Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={design.backgroundColor}
                    onChange={(e) => setDesign({...design, backgroundColor: e.target.value})}
                    className="w-full h-10 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border Color
                  </label>
                  <input
                    type="color"
                    value={design.borderColor}
                    onChange={(e) => setDesign({...design, borderColor: e.target.value})}
                    className="w-full h-10 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Color
                  </label>
                  <input
                    type="color"
                    value={design.textColor}
                    onChange={(e) => setDesign({...design, textColor: e.target.value})}
                    className="w-full h-10 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border Width
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={design.borderWidth}
                    onChange={(e) => setDesign({...design, borderWidth: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{design.borderWidth}px</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title Font Size
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    value={design.titleFontSize}
                    onChange={(e) => setDesign({...design, titleFontSize: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{design.titleFontSize}px</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Body Font Size
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={design.bodyFontSize}
                    onChange={(e) => setDesign({...design, bodyFontSize: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{design.bodyFontSize}px</span>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={design.logoUrl}
                    onChange={(e) => setDesign({...design, logoUrl: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={design.backgroundImageUrl}
                    onChange={(e) => setDesign({...design, backgroundImageUrl: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://example.com/background.png"
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Content</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Title
                  </label>
                  <input
                    type="text"
                    value={content.title}
                    onChange={(e) => setContent({...content, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Certificate of Completion"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={content.subtitle}
                    onChange={(e) => setContent({...content, subtitle: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Organization or Event Series Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Text
                  </label>
                  <input
                    type="text"
                    value={content.recipientText}
                    onChange={(e) => setContent({...content, recipientText: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="This is to certify that"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Text
                  </label>
                  <input
                    type="text"
                    value={content.eventText}
                    onChange={(e) => setContent({...content, eventText: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="has successfully completed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={content.footerText}
                    onChange={(e) => setContent({...content, footerText: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Awarded on this day"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signatory Name
                    </label>
                    <input
                      type="text"
                      value={content.signatoryName}
                      onChange={(e) => setContent({...content, signatoryName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signatory Title
                    </label>
                    <input
                      type="text"
                      value={content.signatoryTitle}
                      onChange={(e) => setContent({...content, signatoryTitle: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Event Organizer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={saveTemplate}
                disabled={!templateName.trim()}
                className="btn-primary disabled:opacity-50 flex items-center space-x-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                <span>{editingTemplate ? 'Update Template' : 'Save Template'}</span>
              </button>
              
              <button
                onClick={() => {
                  resetDesigner();
                  setActiveTab('templates');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="dashboard-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              {renderCertificatePreview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCertificatesPage;
