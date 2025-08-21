import React, { useState, useEffect, useRef } from 'react';
import { 
  AcademicCapIcon,
  PhotoIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/admin/AdminLayout';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import { useAuth } from '../../contexts/AuthContext';
import { CertificateTemplate, Certificate } from '../../types';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { CertificateService, IssuedCertificate } from '../../services/certificateService';
import { EventService } from '../../services/eventService';
import toast from 'react-hot-toast';

const CertificatesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const LayoutComponent = isAdmin ? AdminLayout : OrganizerLayout;
  
  const [activeTab, setActiveTab] = useState<'templates' | 'issued' | 'upload'>('templates');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(false);

  // Upload template state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateEventId, setTemplateEventId] = useState('');
  const [positioningMode, setPositioningMode] = useState(false);
  const [currentPositioning, setCurrentPositioning] = useState<'name' | 'code' | 'qr' | null>(null);
  
  // Text positions (percentage based)
  const [namePosition, setNamePosition] = useState({ 
    x: 50, y: 50, fontSize: 24, fontFamily: 'Arial', color: '#000000', align: 'center' as const 
  });
  const [codePosition, setCodePosition] = useState({ 
    x: 80, y: 85, fontSize: 12, fontFamily: 'Arial', color: '#666666', align: 'right' as const 
  });
  const [qrPosition, setQrPosition] = useState({ x: 85, y: 75, size: 80 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all data in parallel
        const [eventsData, templatesData, certificatesData] = await Promise.all([
          EventService.getAllEvents(),
          CertificateService.getAllTemplates(),
          CertificateService.getAllIssuedCertificates()
        ]);
        
        setEvents(eventsData);
        setTemplates(templatesData);
        setIssuedCertificates(certificatesData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load certificate data');
        // Set empty arrays as fallback
        setEvents([]);
        setTemplates([]);
        setIssuedCertificates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!positioningMode || !currentPositioning || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (currentPositioning === 'name') {
      setNamePosition(prev => ({ ...prev, x, y }));
    } else if (currentPositioning === 'code') {
      setCodePosition(prev => ({ ...prev, x, y }));
    } else if (currentPositioning === 'qr') {
      setQrPosition(prev => ({ ...prev, x, y }));
    }
  };

  const createTemplate = async () => {
    if (!uploadedImage || !templateName.trim()) {
      toast.error('Please provide a template name and upload an image');
      return;
    }

    try {
      setLoading(true);
      
      // Create the template object with correct structure
      const templateData: Omit<CertificateTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
        name: templateName,
        description: templateDescription,
        eventId: templateEventId || undefined,
        templateImageUrl: uploadedImage, // This will be processed by the service
        textPositions: {
          recipientName: namePosition,
          verificationCode: codePosition,
          qrCode: qrPosition
        },
        isActive: true,
        createdBy: userProfile?.uid || 'unknown'
      };

      // Create the template
      await CertificateService.createTemplate(templateData);
      
      toast.success('Certificate template created successfully');
      
      // Reset form
      setUploadedImage(null);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateEventId('');
      setNamePosition({ x: 50, y: 50, fontSize: 24, fontFamily: 'Arial', color: '#000000', align: 'center' });
      setCodePosition({ x: 80, y: 85, fontSize: 12, fontFamily: 'Arial', color: '#666666', align: 'right' });
      setQrPosition({ x: 85, y: 75, size: 80 });
      
      // Refresh templates
      const updatedTemplates = await CertificateService.getAllTemplates();
      setTemplates(updatedTemplates);
      
      // Switch to templates tab
      setActiveTab('templates');
      
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create certificate template');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await CertificateService.deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const generateCertificate = async (templateId: string, recipientData: {
    recipientName: string;
    recipientEmail: string;
    eventId: string;
    eventTitle: string;
    userId?: string;
    registrationId?: string;
  }) => {
    try {
      setLoading(true);
      const certificate = await CertificateService.generateCertificate({
        templateId,
        ...recipientData
      });
      toast.success('Certificate generated successfully');
      
      // Refresh issued certificates
      const updatedCertificates = await CertificateService.getAllIssuedCertificates();
      setIssuedCertificates(updatedCertificates);
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('Failed to generate certificate');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates and certificates based on search and event
  const filteredTemplates = templates.filter(template => 
    (template.name || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedEvent === '' || template.eventId === selectedEvent)
  );

  const filteredCertificates = issuedCertificates.filter(cert => 
    ((cert.recipientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
     (cert.recipientEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
     (cert.templateName || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedEvent === '' || cert.eventTitle === events.find(e => e.id === selectedEvent)?.title)
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Events</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
        <button
          onClick={() => setActiveTab('upload')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Template
        </button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500 mb-4">Create your first certificate template to get started.</p>
          <button
            onClick={() => setActiveTab('upload')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="aspect-[4/3] bg-gray-100 relative">
                {template.templateImageUrl ? (
                  <img 
                    src={template.templateImageUrl} 
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhotoIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {template.isActive ? (
                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircleIcon className="w-6 h-6 text-gray-400" />
                  )}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                )}
                {template.eventId && (
                  <p className="text-xs text-blue-600 mb-3">
                    {events.find(e => e.id === template.eventId)?.title || 'Unknown Event'}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderIssuedTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Events</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
      </div>

      {/* Certificates Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
          <p className="text-gray-500">No certificates have been issued yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCertificates.map(certificate => (
                  <tr key={certificate.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{certificate.recipientName}</div>
                        <div className="text-sm text-gray-500">{certificate.recipientEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {certificate.templateName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {certificate.eventTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(certificate.issuedDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        certificate.status === 'issued' 
                          ? 'bg-green-100 text-green-800'
                          : certificate.status === 'verified'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {certificate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button className="text-purple-600 hover:text-purple-900">
                          <QrCodeIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderUploadTab = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Certificate Template</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter template description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event (Optional)
              </label>
              <select
                value={templateEventId}
                onChange={(e) => setTemplateEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an event (optional)</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Template Image *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Template" className="h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to upload template image</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Position Controls */}
            {uploadedImage && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Position Elements</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPositioningMode(true);
                        setCurrentPositioning('name');
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        currentPositioning === 'name' 
                          ? 'bg-blue-100 border-blue-300 text-blue-700' 
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                      }`}
                    >
                      <MapPinIcon className="w-4 h-4 inline mr-1" />
                      Position Name
                    </button>
                    <span className="text-sm text-gray-500">
                      Current: {namePosition.x.toFixed(1)}%, {namePosition.y.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPositioningMode(true);
                        setCurrentPositioning('code');
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        currentPositioning === 'code' 
                          ? 'bg-blue-100 border-blue-300 text-blue-700' 
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                      }`}
                    >
                      <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                      Position Code
                    </button>
                    <span className="text-sm text-gray-500">
                      Current: {codePosition.x.toFixed(1)}%, {codePosition.y.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPositioningMode(true);
                        setCurrentPositioning('qr');
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        currentPositioning === 'qr' 
                          ? 'bg-blue-100 border-blue-300 text-blue-700' 
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                      }`}
                    >
                      <QrCodeIcon className="w-4 h-4 inline mr-1" />
                      Position QR Code
                    </button>
                    <span className="text-sm text-gray-500">
                      Current: {qrPosition.x.toFixed(1)}%, {qrPosition.y.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {positioningMode && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Click on the template preview to position the {currentPositioning} element.
                    </p>
                    <button
                      onClick={() => {
                        setPositioningMode(false);
                        setCurrentPositioning(null);
                      }}
                      className="mt-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded border border-blue-300 hover:bg-blue-200"
                    >
                      Done Positioning
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Create Button */}
            <div className="flex gap-3">
              <button
                onClick={createTemplate}
                disabled={loading || !uploadedImage || !templateName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Preview Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              {uploadedImage ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className={`w-full border border-gray-200 rounded bg-white ${
                      positioningMode ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                    style={{ aspectRatio: '4/3' }}
                  />
                  
                  {/* Overlay elements for positioning */}
                  <div className="absolute inset-0">
                    {/* Name position indicator */}
                    <div
                      className="absolute w-2 h-2 bg-red-500 rounded-full transform -translate-x-1 -translate-y-1"
                      style={{
                        left: `${namePosition.x}%`,
                        top: `${namePosition.y}%`
                      }}
                    />
                    
                    {/* Code position indicator */}
                    <div
                      className="absolute w-2 h-2 bg-green-500 rounded-full transform -translate-x-1 -translate-y-1"
                      style={{
                        left: `${codePosition.x}%`,
                        top: `${codePosition.y}%`
                      }}
                    />
                    
                    {/* QR position indicator */}
                    <div
                      className="absolute w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1"
                      style={{
                        left: `${qrPosition.x}%`,
                        top: `${qrPosition.y}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                  <div className="text-center">
                    <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Upload an image to see preview</p>
                  </div>
                </div>
              )}
            </div>
            
            {uploadedImage && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Name Position</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Code Position</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>QR Code Position</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render canvas for template preview
  useEffect(() => {
    if (uploadedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        // Set canvas size to match aspect ratio
        const containerWidth = canvas.offsetWidth;
        const aspectRatio = img.width / img.height;
        const containerHeight = containerWidth / aspectRatio;
        
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${containerHeight}px`;
        
        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Draw sample text and elements
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Draw name
        ctx.font = `${(namePosition.fontSize / 100) * canvasHeight}px ${namePosition.fontFamily}`;
        ctx.fillStyle = namePosition.color;
        ctx.textAlign = namePosition.align;
        const nameX = (namePosition.x / 100) * canvasWidth;
        const nameY = (namePosition.y / 100) * canvasHeight;
        ctx.fillText('John Doe', nameX, nameY);
        
        // Draw verification code
        ctx.font = `${(codePosition.fontSize / 100) * canvasHeight}px ${codePosition.fontFamily}`;
        ctx.fillStyle = codePosition.color;
        ctx.textAlign = codePosition.align;
        const codeX = (codePosition.x / 100) * canvasWidth;
        const codeY = (codePosition.y / 100) * canvasHeight;
        ctx.fillText('CERT-1234567890', codeX, codeY);
        
        // Draw QR code placeholder
        const qrSize = (qrPosition.size / 100) * Math.min(canvasWidth, canvasHeight);
        const qrX = (qrPosition.x / 100) * canvasWidth - qrSize / 2;
        const qrY = (qrPosition.y / 100) * canvasHeight - qrSize / 2;
        ctx.fillStyle = '#000000';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX + qrSize * 0.1, qrY + qrSize * 0.1, qrSize * 0.8, qrSize * 0.8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(qrX + qrSize * 0.2, qrY + qrSize * 0.2, qrSize * 0.6, qrSize * 0.6);
      };
      img.src = uploadedImage;
    }
  }, [uploadedImage, namePosition, codePosition, qrPosition]);

  return (
    <LayoutComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Certificate Management</h1>
            <p className="text-gray-600">Create templates and manage issued certificates</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AcademicCapIcon className="w-5 h-5 inline mr-2" />
              Templates ({templates.length})
            </button>
            <button
              onClick={() => setActiveTab('issued')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'issued'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5 inline mr-2" />
              Issued Certificates ({issuedCertificates.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CloudArrowUpIcon className="w-5 h-5 inline mr-2" />
              Create Template
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'issued' && renderIssuedTab()}
        {activeTab === 'upload' && renderUploadTab()}
      </div>
    </LayoutComponent>
  );
};

export default CertificatesPage;
