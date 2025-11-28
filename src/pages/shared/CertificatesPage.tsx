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
  MapPinIcon,
  SparklesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/admin/AdminLayout';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import { useAuth } from '../../contexts/AuthContext';
import { CertificateTemplate, Certificate, TemplateElement } from '../../types';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { CertificateService, IssuedCertificate } from '../../services/certificateService';
import { EventService } from '../../services/eventService';
import toast from 'react-hot-toast';

const CertificatesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const LayoutComponent = isAdmin ? AdminLayout : OrganizerLayout;
  
  const [activeTab, setActiveTab] = useState<'templates' | 'issued' | 'builder'>('templates');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(false);

  // Unified template builder state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateEventId, setTemplateEventId] = useState('');
  const [templateDimensions, setTemplateDimensions] = useState({ width: 1200, height: 800 });
  
  // Enhanced elements-based approach
  const [elements, setElements] = useState<TemplateElement[]>([
    {
      id: 'recipient-name',
      type: 'text',
      position: { x: 50, y: 50 },
      content: '{{ recipientName }}',
      style: {
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#000000',
        align: 'center',
        fontWeight: 'normal',
        fontStyle: 'normal'
      }
    },
    {
      id: 'verification-code',
      type: 'text',
      position: { x: 80, y: 85 },
      content: '{{ verificationCode }}',
      style: {
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#666666',
        align: 'right',
        fontWeight: 'normal',
        fontStyle: 'normal'
      }
    },
    {
      id: 'qr-code',
      type: 'qrcode',
      position: { x: 85, y: 75, width: 80, height: 80 },
      content: '{{ verificationUrl }}',
      style: {}
    }
  ]);
  
  // UI state
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  

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
        const imageDataUrl = e.target?.result as string;
        setUploadedImage(imageDataUrl);
        
        // Get actual image dimensions
        const img = new Image();
        img.onload = () => {
          setTemplateDimensions({
            width: img.width,
            height: img.height
          });
        };
        img.src = imageDataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form function
  const resetForm = () => {
    setUploadedImage(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateEventId('');
    setTemplateDimensions({ width: 1200, height: 800 });
    setElements([
      {
        id: 'recipient-name',
        type: 'text',
        position: { x: 50, y: 50 },
        content: '{{ recipientName }}',
        style: {
          fontSize: 24,
          fontFamily: 'Arial',
          color: '#000000',
          align: 'center',
          fontWeight: 'normal',
          fontStyle: 'normal'
        }
      },
      {
        id: 'verification-code',
        type: 'text',
        position: { x: 80, y: 85 },
        content: '{{ verificationCode }}',
        style: {
          fontSize: 12,
          fontFamily: 'Arial',
          color: '#666666',
          align: 'right',
          fontWeight: 'normal',
          fontStyle: 'normal'
        }
      },
      {
        id: 'qr-code',
        type: 'qrcode',
        position: { x: 85, y: 75, width: 80, height: 80 },
        content: '{{ verificationUrl }}',
        style: {}
      }
    ]);
    setSelectedElement(null);
    setActiveTab('templates');
  };

  // Handle preview template
  const handlePreviewTemplate = (template: CertificateTemplate) => {
    // Load template data into the builder
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setTemplateEventId(template.eventId || '');
    
    // Set template dimensions
    if (template.dimensions) {
      setTemplateDimensions(template.dimensions);
    }
    
    // Load template image if available
    if (template.templateImageUrl) {
      setUploadedImage(template.templateImageUrl);
    }
    
    // Load elements if it's an enhanced template
    if (template.templateMode === 'enhanced' && template.elements) {
      setElements(template.elements);
    } else if (template.textPositions) {
      // Convert legacy template to elements format
      const convertedElements: TemplateElement[] = [];
      
      if (template.textPositions.recipientName) {
        convertedElements.push({
          id: 'recipient-name',
          type: 'text',
          position: template.textPositions.recipientName,
          content: '{{ recipientName }}',
          style: {
            fontSize: 24,
            fontFamily: 'Arial',
            color: '#000000',
            align: 'center',
            fontWeight: 'normal',
            fontStyle: 'normal'
          }
        });
      }
      
      if (template.textPositions.verificationCode) {
        convertedElements.push({
          id: 'verification-code',
          type: 'text',
          position: template.textPositions.verificationCode,
          content: '{{ verificationCode }}',
          style: {
            fontSize: 12,
            fontFamily: 'Arial',
            color: '#666666',
            align: 'right',
            fontWeight: 'normal',
            fontStyle: 'normal'
          }
        });
      }
      
      if (template.textPositions.qrCode) {
        convertedElements.push({
          id: 'qr-code',
          type: 'qrcode',
          position: {
            x: template.textPositions.qrCode.x,
            y: template.textPositions.qrCode.y,
            width: 80,
            height: 80
          },
          content: '{{ verificationUrl }}',
          style: {}
        });
      }
      
      setElements(convertedElements);
    }
    
    // Set editing template and switch to builder
    setEditingTemplate(template);
    setActiveTab('builder');
  };

  // Element management functions
  const addElement = (type: TemplateElement['type']) => {
    const newElement: TemplateElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      content: type === 'text' ? 'Sample Text' : '{{ verificationUrl }}',
      style: {
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#000000',
        align: 'center',
        fontWeight: 'normal',
        fontStyle: 'normal'
      }
    };
    
    if (type === 'qrcode') {
      newElement.position.width = 100;
      newElement.position.height = 100;
    }
    
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = (elementId: string, updates: Partial<TemplateElement>) => {
    setElements(elements.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  const deleteElement = (elementId: string) => {
    setElements(elements.filter(el => el.id !== elementId));
    setSelectedElement(null);
  };

  // Helper function to get mouse position relative to canvas
  const getMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  // Helper function to check if mouse is over element
  const getElementAtPosition = (mouseX: number, mouseY: number) => {
    return elements.find(element => {
      const elementX = (element.position.x / 100) * templateDimensions.width;
      const elementY = (element.position.y / 100) * templateDimensions.height;
      
      if (element.type === 'text') {
        // Create a temporary canvas context to measure text
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return false;
        
        const fontSize = element.style.fontSize || 16;
        const fontFamily = element.style.fontFamily || 'Arial';
        const fontWeight = element.style.fontWeight || 'normal';
        const fontStyle = element.style.fontStyle || 'normal';
        
        tempCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        
        let sampleText = element.content;
        if (element.content.includes('{{')) {
          sampleText = element.content
            .replace(/\{\{\s*recipientName\s*\}\}/g, 'John Doe')
            .replace(/\{\{\s*verificationCode\s*\}\}/g, 'CERT-123456')
            .replace(/\{\{[^}]+\}\}/g, 'Sample Text');
        }
        
        const textMetrics = tempCtx.measureText(sampleText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // Adjust bounds based on text alignment
        let textX = elementX;
        const textY = elementY - textHeight;
        
        if (element.style.align === 'center') {
          textX = elementX - textWidth / 2;
        } else if (element.style.align === 'right') {
          textX = elementX - textWidth;
        }
        
        return mouseX >= textX && mouseX <= textX + textWidth && 
               mouseY >= textY && mouseY <= textY + textHeight;
               
      } else if (element.type === 'qrcode') {
        const size = element.position.width || 100;
        const qrX = elementX - size/2;
        const qrY = elementY - size/2;
        
        return mouseX >= qrX && mouseX <= qrX + size && 
               mouseY >= qrY && mouseY <= qrY + size;
      }
      
      return false;
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const mousePos = getMousePosition(event);
    const elementAtPosition = getElementAtPosition(mousePos.x, mousePos.y);
    
    if (elementAtPosition) {
      setSelectedElement(elementAtPosition.id);
      setIsDragging(true);
      
      // Calculate offset from element center to mouse position
      const elementX = (elementAtPosition.position.x / 100) * templateDimensions.width;
      const elementY = (elementAtPosition.position.y / 100) * templateDimensions.height;
      
      setDragOffset({
        x: mousePos.x - elementX,
        y: mousePos.y - elementY
      });
    } else {
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const mousePos = getMousePosition(event);
    
    if (isDragging && selectedElement) {
      // Calculate new element position accounting for drag offset
      const newX = mousePos.x - dragOffset.x;
      const newY = mousePos.y - dragOffset.y;
      
      // Convert to percentage
      const percentX = (newX / templateDimensions.width) * 100;
      const percentY = (newY / templateDimensions.height) * 100;
      
      // Clamp to canvas bounds
      const clampedX = Math.max(0, Math.min(100, percentX));
      const clampedY = Math.max(0, Math.min(100, percentY));
      
      updateElement(selectedElement, {
        position: { 
          ...elements.find(e => e.id === selectedElement)!.position, 
          x: clampedX, 
          y: clampedY 
        }
      });
    } else {
      // Update hover state when not dragging
      const elementAtPosition = getElementAtPosition(mousePos.x, mousePos.y);
      setHoveredElement(elementAtPosition?.id || null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const createTemplate = async () => {
    if (!uploadedImage || !templateName.trim()) {
      toast.error('Please provide a template name and upload an image');
      return;
    }

    try {
      setLoading(true);
      
      // Create the template object with enhanced elements approach
      const templateData: Omit<CertificateTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
        name: templateName,
        description: templateDescription,
        eventId: templateEventId || undefined,
        templateImageUrl: uploadedImage,
        dimensions: templateDimensions,
        elements: elements,
        templateMode: 'enhanced',
        isActive: true,
        createdBy: userProfile?.uid || 'unknown'
      };

      // Create the template
      await CertificateService.createTemplate(templateData);
      
      toast.success('Certificate template created successfully');
      
      // Reset form
      resetForm();
      
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

  const updateTemplate = async () => {
    if (!editingTemplate || !uploadedImage || !templateName.trim()) {
      toast.error('Please provide a template name and upload an image');
      return;
    }

    try {
      setLoading(true);
      
      // Create the updated template object
      const updatedTemplateData: Omit<CertificateTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
        name: templateName,
        description: templateDescription,
        eventId: templateEventId || undefined,
        templateImageUrl: uploadedImage,
        dimensions: templateDimensions,
        elements: elements,
        templateMode: 'enhanced',
        isActive: true,
        createdBy: editingTemplate.createdBy
      };

      // Update the template
      await CertificateService.updateTemplate(editingTemplate.id, updatedTemplateData);
      
      toast.success('Certificate template updated successfully');
      
      // Reset form and editing state
      setEditingTemplate(null);
      resetForm();
      
      // Refresh templates
      const updatedTemplates = await CertificateService.getAllTemplates();
      setTemplates(updatedTemplates);
      
      // Switch to templates tab
      setActiveTab('templates');
      
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update certificate template');
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

  // Re-upload template image to Firebase Storage for CORS compliance
  const handleReuploadImage = async (template: CertificateTemplate) => {
    if (!template.templateImageUrl) {
      toast.error('No image URL to re-upload');
      return;
    }

    if (CertificateService.isFirebaseStorageUrl(template.templateImageUrl)) {
      toast.success('Image is already hosted on Firebase Storage');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Re-uploading image to Firebase Storage...', { id: 'reupload' });
      
      const newUrl = await CertificateService.reuploadTemplateImage(template.id, template.templateImageUrl);
      
      // Update local state
      setTemplates(templates.map(t => 
        t.id === template.id ? { ...t, templateImageUrl: newUrl } : t
      ));
      
      toast.success('Image re-uploaded successfully! Template is now CORS-compliant.', { id: 'reupload' });
    } catch (error) {
      console.error('Error re-uploading image:', error);
      toast.error('Failed to re-upload image. The external URL may be blocked.', { id: 'reupload' });
    } finally {
      setLoading(false);
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
          onClick={() => setActiveTab('builder')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <SparklesIcon className="w-5 h-5" />
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
            onClick={() => setActiveTab('builder')}
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
                  <p className="text-xs text-blue-600 mb-2">
                    {events.find(e => e.id === template.eventId)?.title || 'Unknown Event'}
                  </p>
                )}
                
                {/* CORS Warning for external URLs */}
                {template.templateImageUrl && !CertificateService.isFirebaseStorageUrl(template.templateImageUrl) && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-700">
                        <p className="font-medium">External image URL</p>
                        <p>Re-upload to Firebase for CORS compliance</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreviewTemplate(template)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Preview
                  </button>
                  {/* Re-upload button for external URLs */}
                  {template.templateImageUrl && !CertificateService.isFirebaseStorageUrl(template.templateImageUrl) && (
                    <button
                      onClick={() => handleReuploadImage(template)}
                      disabled={loading}
                      className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
                      title="Re-upload to Firebase Storage"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                  )}
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

  const renderBuilderTab = () => {
    const selectedElementData = selectedElement ? elements.find(el => el.id === selectedElement) : null;
    
    return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {editingTemplate ? 'Edit Certificate Template' : 'Create Certificate Template'}
        </h2>
        
        <div className="space-y-8">
          {/* Template Information Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Info */}
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

            {/* Template Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Width (px)</label>
                <input
                  type="number"
                  value={templateDimensions.width}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  placeholder="Upload image to auto-detect"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Height (px)</label>
                <input
                  type="number"
                  value={templateDimensions.height}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  placeholder="Upload image to auto-detect"
                />
              </div>
            </div>
            </div>

            {/* Template Elements Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Template Elements</h3>
                <div className="flex gap-2">
                    <button
                    onClick={() => addElement('text')}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Add Text
                    </button>
                    <button
                    onClick={() => addElement('qrcode')}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                  >
                    <QrCodeIcon className="w-4 h-4" />
                    Add QR Code
                    </button>
                </div>
                  </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {elements.map(element => (
                  <div
                    key={element.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedElement === element.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedElement(element.id)}
                  >
                    <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                        {element.type === 'text' && <DocumentTextIcon className="w-4 h-4 text-blue-500" />}
                        {element.type === 'qrcode' && <QrCodeIcon className="w-4 h-4 text-green-500" />}
                        <span className="text-sm font-medium capitalize">{element.type}</span>
                      </div>
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(element.id);
                        }}
                        className="p-1 text-red-500 hover:bg-red-100 rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {element.content || `${element.type} element`}
                    </p>
                  </div>
                ))}
                </div>

              {/* Element Properties */}
              {selectedElementData && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Element Properties</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
                      <textarea
                        value={selectedElementData.content}
                        onChange={(e) => updateElement(selectedElement!, { content: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter content or template variables like {{ recipientName }}"
                      />
                  </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">X Position (%)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.x}
                          onChange={(e) => updateElement(selectedElement!, { 
                            position: { ...selectedElementData.position, x: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
              </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Y Position (%)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.y}
                          onChange={(e) => updateElement(selectedElement!, { 
                            position: { ...selectedElementData.position, y: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {selectedElementData.type === 'text' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElementData.style.fontSize || 16}
                              onChange={(e) => updateElement(selectedElement!, { 
                                style: { ...selectedElementData.style, fontSize: parseInt(e.target.value) || 16 }
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                            <input
                              type="color"
                              value={selectedElementData.style.color || '#000000'}
                              onChange={(e) => updateElement(selectedElement!, { 
                                style: { ...selectedElementData.style, color: e.target.value }
                              })}
                              className="w-full h-8 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Font Family</label>
                          <select
                            value={selectedElementData.style.fontFamily || 'Arial'}
                            onChange={(e) => updateElement(selectedElement!, { 
                              style: { ...selectedElementData.style, fontFamily: e.target.value }
                            })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                          </select>
                  </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Text Align</label>
                          <select
                            value={selectedElementData.style.align || 'left'}
                            onChange={(e) => updateElement(selectedElement!, { 
                              style: { ...selectedElementData.style, align: e.target.value as 'left' | 'center' | 'right' }
                            })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedElementData.type === 'qrcode' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Size (px)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.width || 100}
                          onChange={(e) => {
                            const size = parseInt(e.target.value) || 100;
                            updateElement(selectedElement!, { 
                              position: { ...selectedElementData.position, width: size, height: size }
                            });
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
              </div>
            )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Template Preview Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Template Preview</h3>
              {uploadedImage && (
                <div className="text-sm text-gray-500">
                  {templateDimensions.width} × {templateDimensions.height} pixels
                </div>
              )}
            </div>
            <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
              {uploadedImage ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`w-full max-w-4xl mx-auto border border-gray-200 rounded bg-white shadow-lg ${
                      isDragging ? 'cursor-grabbing' : hoveredElement ? 'cursor-grab' : 'cursor-default'
                    }`}
                      style={{
                      aspectRatio: `${templateDimensions.width}/${templateDimensions.height}`,
                      maxHeight: '600px'
                    }}
                  />
                  
                </div>
              ) : (
                <div className="w-full h-96 bg-gray-200 rounded flex items-center justify-center">
                  <div className="text-center">
                    <PhotoIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-500 mb-2">Upload a template image to start building</p>
                    <p className="text-sm text-gray-400">The canvas will automatically resize to match your image dimensions</p>
                  </div>
                </div>
              )}
            </div>
            </div>
            
          {/* Create/Update Button */}
          <div className="flex gap-3">
            <button
              onClick={editingTemplate ? updateTemplate : createTemplate}
              disabled={loading || !uploadedImage || !templateName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading 
                ? (editingTemplate ? 'Updating...' : 'Creating...') 
                : (editingTemplate ? 'Update Template' : 'Create Template')
              }
            </button>
            <button
              onClick={() => {
                setEditingTemplate(null);
                resetForm();
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
                </div>
        </div>
      </div>
    </div>
  );
  };

  // Render canvas for template preview
  useEffect(() => {
    if (uploadedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        // Set canvas size to template dimensions
        canvas.width = templateDimensions.width;
        canvas.height = templateDimensions.height;
        
        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Draw elements
        elements.forEach(element => {
          const x = (element.position.x / 100) * canvas.width;
          const y = (element.position.y / 100) * canvas.height;
          
          ctx.save();

          switch (element.type) {
            case 'text':
              // Set font properties
              const fontSize = element.style.fontSize || 16;
              const fontFamily = element.style.fontFamily || 'Arial';
              const fontWeight = element.style.fontWeight || 'normal';
              const fontStyle = element.style.fontStyle || 'normal';
              
              ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
              ctx.fillStyle = element.style.color || '#000000';
              ctx.textAlign = element.style.align || 'left';
              
              // Draw sample text with specific replacements
              let sampleText = element.content;
              if (element.content.includes('{{')) {
                sampleText = element.content
                  .replace(/\{\{\s*recipientName\s*\}\}/g, 'John Doe')
                  .replace(/\{\{\s*verificationCode\s*\}\}/g, 'CERT-123456')
                  .replace(/\{\{[^}]+\}\}/g, 'Sample Text'); // fallback for other variables
              }
              ctx.fillText(sampleText, x, y);
              break;
              
            case 'qrcode':
        // Draw QR code placeholder
              const size = element.position.width || 100;
        ctx.fillStyle = '#000000';
              ctx.fillRect(x - size/2, y - size/2, size, size);
        ctx.fillStyle = '#ffffff';
              ctx.fillRect(x - size/2 + 10, y - size/2 + 10, size - 20, size - 20);
              break;
          }
          
          // Draw selection and hover indicators
          const isSelected = selectedElement === element.id;
          const isHovered = hoveredElement === element.id;
          
          if (isSelected || isHovered) {
            let bounds = { x, y, width: 100, height: 30 };
            
            if (element.type === 'text') {
              // Calculate text bounds based on actual text metrics
              let sampleText = element.content;
              if (element.content.includes('{{')) {
                sampleText = element.content
                  .replace(/\{\{\s*recipientName\s*\}\}/g, 'John Doe')
                  .replace(/\{\{\s*verificationCode\s*\}\}/g, 'CERT-123456')
                  .replace(/\{\{[^}]+\}\}/g, 'Sample Text');
              }
              
              const fontSize = element.style.fontSize || 16;
              const textMetrics = ctx.measureText(sampleText);
              const textWidth = textMetrics.width;
              const textHeight = fontSize;
              
              // Adjust bounds based on text alignment
              let textX = x;
              const textY = y - textHeight; // Text is drawn from baseline, so adjust for height
              
              if (element.style.align === 'center') {
                textX = x - textWidth / 2;
              } else if (element.style.align === 'right') {
                textX = x - textWidth;
              }
              
              bounds = { 
                x: textX, 
                y: textY, 
                width: textWidth, 
                height: textHeight 
              };
            } else if (element.type === 'qrcode') {
              const size = element.position.width || 100;
              bounds = { x: x - size/2, y: y - size/2, width: size, height: size };
            }
            
            if (isSelected) {
              // Selected element - solid blue border
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
              ctx.setLineDash([]);
            } else if (isHovered) {
              // Hovered element - lighter blue border
              ctx.strokeStyle = '#93c5fd';
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.strokeRect(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
              ctx.setLineDash([]);
            }
          }
          
          ctx.restore();
        });
        
      };
      img.src = uploadedImage;
    }
  }, [uploadedImage, elements, selectedElement, hoveredElement, templateDimensions]);

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
              onClick={() => setActiveTab('builder')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'builder'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SparklesIcon className="w-5 h-5 inline mr-2" />
              Template Builder
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'issued' && renderIssuedTab()}
        {activeTab === 'builder' && renderBuilderTab()}
      </div>
    </LayoutComponent>
  );
};

export default CertificatesPage;
