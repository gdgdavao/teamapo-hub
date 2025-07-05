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
import AdminLayout from '../../components/AdminLayout';
import { CertificateTemplate, Certificate } from '../../types';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { CertificateService, IssuedCertificate } from '../../services/certificateService';
import { EventService } from '../../services/eventService';
import toast from 'react-hot-toast';

const AdminCertificatesPage: React.FC = () => {
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

  // Load events from API
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
    if (!positioningMode || !currentPositioning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

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

  const saveTemplate = async () => {
    if (!uploadedImage || !templateName.trim()) {
      toast.error('Please provide a template name and upload an image');
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        name: templateName,
        description: templateDescription,
        eventId: templateEventId || undefined,
        templateImageUrl: uploadedImage,
        textPositions: {
          recipientName: namePosition,
          verificationCode: codePosition,
          qrCode: qrPosition
        },
        isActive: true,
        createdBy: 'admin'
      };

      const templateId = await CertificateService.createTemplate(templateData);
      
      // Refresh templates list
      const updatedTemplates = await CertificateService.getAllTemplates();
      setTemplates(updatedTemplates);
      
      // Reset form
      setUploadedImage(null);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateEventId('');
      setPositioningMode(false);
      setCurrentPositioning(null);
      setActiveTab('templates');
      
      toast.success('Certificate template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Error saving template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await CertificateService.deleteTemplate(templateId);
        
        // Refresh templates list
        const updatedTemplates = await CertificateService.getAllTemplates();
        setTemplates(updatedTemplates);
        
        toast.success('Template deleted successfully');
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete template');
      }
    }
  };

  const generateCertificate = async (templateId: string, recipientName: string, eventTitle: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      alert('Template not found');
      return;
    }

    try {
      setLoading(true);
      const result = await CertificateGenerationService.generateCertificate(template, {
        templateId: template.id,
        recipientName,
        recipientEmail: 'preview@example.com',
        eventTitle,
        eventDate: new Date().toISOString()
      });

      // Open certificate in new window for preview
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Certificate Preview - ${recipientName}</title></head>
            <body style="margin: 0; padding: 20px; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
              <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <img src="${result.certificateUrl}" alt="Certificate" style="max-width: 100%; height: auto; border-radius: 4px;" />
                <div style="margin-top: 16px; text-center;">
                  <button onclick="window.print()" style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Print</button>
                  <button onclick="window.close()" style="background: #6b7280; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
                <p style="text-align: center; margin-top: 8px; color: #6b7280; font-size: 14px;">
                  Verification Code: <strong>${result.verificationCode}</strong>
                </p>
              </div>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Error generating certificate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCertificates = issuedCertificates.filter(cert =>
    cert.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.verificationCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => setActiveTab('upload')}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <PlusIcon className="w-4 h-4 mr-2" />
        Upload Template
      </button>
    </div>
  );

  return (
    <AdminLayout 
      title="Certificate Management" 
      subtitle="Upload PNG templates and manage certificate generation"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'templates', name: 'Templates', icon: PhotoIcon },
              { id: 'issued', name: 'Issued Certificates', icon: DocumentTextIcon },
              { id: 'upload', name: 'Upload New Template', icon: CloudArrowUpIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${
                    activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Search Bar */}
        {(activeTab === 'templates' || activeTab === 'issued') && (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search certificates...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-w-16 aspect-h-9 bg-gray-100">
                  <img 
                    src={template.templateImageUrl} 
                    alt={template.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDQwMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xODQgMTIwTDIwOCAxMDRMMjMyIDEyMEwyMDggMTM2TDE4NCAxMjBaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
                    }}
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => setEditingTemplate(template)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit template"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete template"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>Used {template.usageCount} times</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      template.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <button 
                    onClick={() => generateCertificate(template.id, 'John Doe', 'Sample Event')}
                    className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                  >
                    Preview Certificate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Issued Certificates Tab */}
        {activeTab === 'issued' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                      Verification Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issued Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCertificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{cert.recipientName}</div>
                          <div className="text-sm text-gray-500">{cert.recipientEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{cert.eventTitle}</div>
                        <div className="text-sm text-gray-500">{cert.templateName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{cert.verificationCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          cert.status === 'verified' 
                            ? 'bg-green-100 text-green-800'
                            : cert.status === 'issued'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(cert.issuedDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="text-green-600 hover:text-green-900">
                            <ArrowDownTrayIcon className="w-4 h-4" />
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

        {/* Upload Template Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="space-y-8">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., GDG Davao Workshop Certificate"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Linked Event (Optional)
                      </label>
                      <select
                        value={templateEventId}
                        onChange={(e) => setTemplateEventId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Use for any event</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>{event.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Describe when this template should be used..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Template</h3>
                  {!uploadedImage ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    >
                      <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">Upload PNG Template</p>
                      <p className="text-sm text-gray-600">
                        Upload a PNG image that will serve as your certificate background.
                        <br />
                        Recommended size: 1200x800px or larger
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <canvas
                          ref={canvasRef}
                          onClick={handleCanvasClick}
                          className={`w-full max-w-2xl border border-gray-300 rounded-lg ${
                            positioningMode ? 'cursor-crosshair' : 'cursor-default'
                          }`}
                          style={{
                            backgroundImage: `url(${uploadedImage})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            aspectRatio: '4/3'
                          }}
                        />
                        
                        {/* Position indicators */}
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Name position */}
                          <div
                            className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white transform -translate-x-2 -translate-y-2"
                            style={{
                              left: `${namePosition.x}%`,
                              top: `${namePosition.y}%`
                            }}
                            title="Recipient Name Position"
                          />
                          
                          {/* Verification code position */}
                          <div
                            className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white transform -translate-x-2 -translate-y-2"
                            style={{
                              left: `${codePosition.x}%`,
                              top: `${codePosition.y}%`
                            }}
                            title="Verification Code Position"
                          />
                          
                          {/* QR code position */}
                          <div
                            className="absolute bg-purple-500 border-2 border-white transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${qrPosition.x}%`,
                              top: `${qrPosition.y}%`,
                              width: `${qrPosition.size}px`,
                              height: `${qrPosition.size}px`
                            }}
                            title="QR Code Position"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => {
                            setUploadedImage(null);
                            setPositioningMode(false);
                            setCurrentPositioning(null);
                          }}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Choose Different Image
                        </button>
                        
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-600">Click to position elements:</span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setPositioningMode(true);
                                setCurrentPositioning('name');
                              }}
                              className={`px-3 py-1 text-xs rounded-full ${
                                currentPositioning === 'name'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                              }`}
                            >
                              • Name
                            </button>
                            <button
                              onClick={() => {
                                setPositioningMode(true);
                                setCurrentPositioning('code');
                              }}
                              className={`px-3 py-1 text-xs rounded-full ${
                                currentPositioning === 'code'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                            >
                              • Code
                            </button>
                            <button
                              onClick={() => {
                                setPositioningMode(true);
                                setCurrentPositioning('qr');
                              }}
                              className={`px-3 py-1 text-xs rounded-full ${
                                currentPositioning === 'qr'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                              }`}
                            >
                              • QR Code
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Settings */}
                {uploadedImage && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Text Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Recipient Name</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Font Size</label>
                            <input
                              type="range"
                              min="12"
                              max="48"
                              value={namePosition.fontSize}
                              onChange={(e) => setNamePosition(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                            <span className="text-xs text-gray-500">{namePosition.fontSize}px</span>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Color</label>
                            <input
                              type="color"
                              value={namePosition.color}
                              onChange={(e) => setNamePosition(prev => ({ ...prev, color: e.target.value }))}
                              className="w-full h-8 rounded border border-gray-300"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Code settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Verification Code</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Font Size</label>
                            <input
                              type="range"
                              min="8"
                              max="16"
                              value={codePosition.fontSize}
                              onChange={(e) => setCodePosition(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                            <span className="text-xs text-gray-500">{codePosition.fontSize}px</span>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Color</label>
                            <input
                              type="color"
                              value={codePosition.color}
                              onChange={(e) => setCodePosition(prev => ({ ...prev, color: e.target.value }))}
                              className="w-full h-8 rounded border border-gray-300"
                            />
                          </div>
                        </div>
                      </div>

                      {/* QR Code settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">QR Code</h4>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Size</label>
                          <input
                            type="range"
                            min="40"
                            max="120"
                            value={qrPosition.size}
                            onChange={(e) => setQrPosition(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{qrPosition.size}px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    onClick={() => setActiveTab('templates')}
                    className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={!uploadedImage || !templateName.trim() || loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {loading ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCertificatesPage;
