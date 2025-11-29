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
  ExclamationTriangleIcon,
  ArchiveBoxArrowDownIcon,
  UserGroupIcon,
  XMarkIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/admin/AdminLayout';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import { useAuth } from '../../contexts/AuthContext';
import { CertificateTemplate, Certificate, TemplateElement, Registration } from '../../types';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { CertificateService, IssuedCertificate } from '../../services/certificateService';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';

/**
 * Extract full name from registration customResponses
 * Combines First Name (field '1') + Last Name (field '1762143123275') for DevFest Davao
 */
const getFullNameFromRegistration = (regData: { customResponses?: Record<string, string | boolean | number>; userDetails?: { name?: string } } | null): string | null => {
  if (!regData) return null;
  
  const customResponses = regData.customResponses || {};
  const userDetails = regData.userDetails || {};
  
  // Field '1' is First Name, '1762143123275' is Last Name for DevFest Davao form
  const firstName = customResponses['1'] as string | undefined;
  const lastName = customResponses['1762143123275'] as string | undefined;
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  return userDetails.name || firstName || null;
};

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
  const [selectedCertificates, setSelectedCertificates] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Bulk generate state
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [bulkGenerateEventId, setBulkGenerateEventId] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [bulkGenerateFilter, setBulkGenerateFilter] = useState<'all' | 'attended' | 'no-certificate'>('no-certificate');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkGenerateProgress, setBulkGenerateProgress] = useState({ current: 0, total: 0 });
  const [attendeeSearchTerm, setAttendeeSearchTerm] = useState('');

  // Certificate name regeneration state
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingCertId, setRegeneratingCertId] = useState<string | null>(null);
  const [regenerateProgress, setRegenerateProgress] = useState({ current: 0, total: 0 });
  const [certificateFullNames, setCertificateFullNames] = useState<Record<string, string | null>>({});

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
        logger.error('Error fetching data:', error);
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
      logger.error('Error creating template:', error);
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
      logger.error('Error updating template:', error);
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
      logger.error('Error deleting template:', error);
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
      logger.error('Error re-uploading image:', error);
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
      logger.error('Error generating certificate:', error);
      toast.error('Failed to generate certificate');
    } finally {
      setLoading(false);
    }
  };

  // Bulk selection handlers
  const handleSelectCertificate = (certificateId: string) => {
    setSelectedCertificates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(certificateId)) {
        newSet.delete(certificateId);
      } else {
        newSet.add(certificateId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCertificates.size === filteredCertificates.length) {
      setSelectedCertificates(new Set());
    } else {
      setSelectedCertificates(new Set(filteredCertificates.map(c => c.id)));
    }
  };

  // Fetch full name from registration for a certificate
  const fetchFullNameForCertificate = async (cert: IssuedCertificate): Promise<string | null> => {
    if (!cert.registrationId) return null;
    
    try {
      const regRef = doc(db, 'registrations', cert.registrationId);
      const regSnap = await getDoc(regRef);
      
      if (regSnap.exists()) {
        return getFullNameFromRegistration(regSnap.data() as { customResponses?: Record<string, string | boolean | number>; userDetails?: { name?: string } });
      }
    } catch (err) {
      logger.warn(`Could not fetch registration ${cert.registrationId}:`, err);
    }
    return null;
  };

  // Check if certificate needs name fix (full name differs from current name)
  const certificateNeedsNameFix = (cert: IssuedCertificate): boolean => {
    const fullName = certificateFullNames[cert.id];
    return fullName !== undefined && fullName !== null && fullName !== cert.recipientName;
  };

  // Regenerate a single certificate with the correct full name
  const handleRegenerateCertificateName = async (cert: IssuedCertificate) => {
    const fullName = certificateFullNames[cert.id];
    if (!fullName || fullName === cert.recipientName) {
      toast.error('Certificate name is already correct');
      return;
    }

    setRegeneratingCertId(cert.id);
    
    try {
      // Get the template
      const template = await CertificateService.getTemplateById(cert.templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Generate new certificate with full name
      const result = await CertificateGenerationService.generateCertificate(template, {
        templateId: cert.templateId,
        recipientName: fullName,
        recipientEmail: cert.recipientEmail,
        eventTitle: cert.eventTitle,
        eventDate: cert.eventDate,
        eventId: cert.eventId,
        verificationCode: cert.verificationCode // Keep the same verification code
      });
      
      // Upload to Firebase Storage (overwrite existing)
      const imageRef = ref(storage, `certificates/${cert.eventId}/${cert.verificationCode}.png`);
      await uploadBytes(imageRef, result.blob, { contentType: 'image/png' });
      const newUrl = await getDownloadURL(imageRef);
      
      // Update Firestore document with new name and URL
      const certRef = doc(db, 'certificates', cert.id);
      await updateDoc(certRef, {
        recipientName: fullName,
        certificateUrl: newUrl,
        updatedAt: serverTimestamp(),
        regeneratedAt: serverTimestamp(),
        regenerationReason: 'Full name fix'
      });
      
      // Update local state
      setIssuedCertificates(prev => prev.map(c => 
        c.id === cert.id ? { ...c, recipientName: fullName, certificateUrl: newUrl } : c
      ));
      
      toast.success(`Certificate regenerated for ${fullName}`);
    } catch (err) {
      logger.error(`Error regenerating certificate ${cert.id}:`, err);
      toast.error('Failed to regenerate certificate');
    } finally {
      setRegeneratingCertId(null);
    }
  };

  // Bulk regenerate certificates with name fixes
  const handleBulkRegenerateNames = async () => {
    const certsToFix = filteredCertificates.filter(c => 
      selectedCertificates.has(c.id) && certificateNeedsNameFix(c)
    );
    
    if (certsToFix.length === 0) {
      toast.error('No certificates selected that need name fixes');
      return;
    }

    setIsRegenerating(true);
    setRegenerateProgress({ current: 0, total: certsToFix.length });
    
    let successCount = 0;
    for (let i = 0; i < certsToFix.length; i++) {
      const cert = certsToFix[i];
      const fullName = certificateFullNames[cert.id];
      
      if (!fullName) continue;
      
      try {
        const template = await CertificateService.getTemplateById(cert.templateId);
        if (!template) continue;
        
        const result = await CertificateGenerationService.generateCertificate(template, {
          templateId: cert.templateId,
          recipientName: fullName,
          recipientEmail: cert.recipientEmail,
          eventTitle: cert.eventTitle,
          eventDate: cert.eventDate,
          eventId: cert.eventId,
          verificationCode: cert.verificationCode
        });
        
        const imageRef = ref(storage, `certificates/${cert.eventId}/${cert.verificationCode}.png`);
        await uploadBytes(imageRef, result.blob, { contentType: 'image/png' });
        const newUrl = await getDownloadURL(imageRef);
        
        const certRef = doc(db, 'certificates', cert.id);
        await updateDoc(certRef, {
          recipientName: fullName,
          certificateUrl: newUrl,
          updatedAt: serverTimestamp(),
          regeneratedAt: serverTimestamp(),
          regenerationReason: 'Full name fix (bulk)'
        });
        
        setIssuedCertificates(prev => prev.map(c => 
          c.id === cert.id ? { ...c, recipientName: fullName, certificateUrl: newUrl } : c
        ));
        
        successCount++;
      } catch (err) {
        logger.error(`Error regenerating certificate ${cert.id}:`, err);
      }
      
      setRegenerateProgress({ current: i + 1, total: certsToFix.length });
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between certificates
    }
    
    setIsRegenerating(false);
    setSelectedCertificates(new Set());
    toast.success(`Regenerated ${successCount} of ${certsToFix.length} certificates`);
  };

  // Load full names for selected event's certificates
  const handleLoadFullNames = async () => {
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }
    
    const eventCerts = issuedCertificates.filter(c => c.eventId === selectedEvent);
    
    if (eventCerts.length === 0) {
      toast.error('No certificates found for this event');
      return;
    }
    
    toast.loading('Loading registration data...', { id: 'load-names' });
    
    const newFullNames: Record<string, string | null> = {};
    let needsFixCount = 0;
    
    for (const cert of eventCerts) {
      const fullName = await fetchFullNameForCertificate(cert);
      newFullNames[cert.id] = fullName;
      if (fullName && fullName !== cert.recipientName) {
        needsFixCount++;
      }
    }
    
    setCertificateFullNames(prev => ({ ...prev, ...newFullNames }));
    
    if (needsFixCount > 0) {
      toast.success(`Found ${needsFixCount} certificate(s) needing name fixes`, { id: 'load-names' });
    } else {
      toast.success('All certificates have correct names', { id: 'load-names' });
    }
  };

  const handleBulkExport = async () => {
    if (selectedCertificates.size === 0) {
      toast.error('Please select at least one certificate to export');
      return;
    }

    try {
      setIsExporting(true);
      toast.loading(`Preparing ${selectedCertificates.size} certificate(s) for download...`, { id: 'bulk-export' });

      const selectedCerts = filteredCertificates.filter(c => selectedCertificates.has(c.id));
      
      // Check if certificates have URLs
      const certsWithUrls = selectedCerts.filter(c => c.certificateUrl);
      const certsWithoutUrls = selectedCerts.filter(c => !c.certificateUrl);

      if (certsWithoutUrls.length > 0) {
        toast.error(`${certsWithoutUrls.length} certificate(s) don't have download URLs yet`, { id: 'bulk-export' });
        return;
      }

      // For single certificate, just download directly
      if (certsWithUrls.length === 1) {
        const cert = certsWithUrls[0];
        const link = document.createElement('a');
        link.href = cert.certificateUrl;
        link.download = `certificate-${cert.recipientName.replace(/\s+/g, '_')}-${cert.verificationCode}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Certificate downloaded successfully!', { id: 'bulk-export' });
        setSelectedCertificates(new Set());
        return;
      }

      // For multiple certificates, download each one with a slight delay
      let downloadedCount = 0;
      for (const cert of certsWithUrls) {
        try {
          const response = await fetch(cert.certificateUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `certificate-${cert.recipientName.replace(/\s+/g, '_')}-${cert.verificationCode}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          downloadedCount++;
          
          // Small delay between downloads to prevent browser blocking
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          logger.error(`Failed to download certificate ${cert.id}:`, err);
        }
      }

      toast.success(`Successfully downloaded ${downloadedCount} certificate(s)!`, { id: 'bulk-export' });
      setSelectedCertificates(new Set());
    } catch (error) {
      logger.error('Error during bulk export:', error);
      toast.error('Failed to export certificates', { id: 'bulk-export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedCertificates.size === 0) {
      toast.error('Please select at least one certificate to export');
      return;
    }

    const selectedCerts = filteredCertificates.filter(c => selectedCertificates.has(c.id));
    
    // Create CSV content
    const headers = ['Recipient Name', 'Email', 'Event', 'Template', 'Issue Date', 'Verification Code', 'Status', 'Certificate URL'];
    const rows = selectedCerts.map(cert => [
      cert.recipientName,
      cert.recipientEmail,
      cert.eventTitle,
      cert.templateName,
      new Date(cert.issuedDate).toLocaleDateString(),
      cert.verificationCode,
      cert.status,
      cert.certificateUrl || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certificates-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedCerts.length} certificate(s) to CSV`);
  };

  // Bulk Generate Handlers
  const handleOpenBulkGenerate = () => {
    setShowBulkGenerateModal(true);
    setBulkGenerateEventId('');
    setRegistrations([]);
    setSelectedRegistrations(new Set());
    setBulkGenerateFilter('no-certificate');
    setBulkGenerateProgress({ current: 0, total: 0 });
    setAttendeeSearchTerm('');
  };

  const handleCloseBulkGenerate = () => {
    if (bulkGenerating) {
      if (!confirm('Generation is in progress. Are you sure you want to cancel?')) {
        return;
      }
    }
    setShowBulkGenerateModal(false);
    setBulkGenerateEventId('');
    setRegistrations([]);
    setSelectedRegistrations(new Set());
    setBulkGenerating(false);
  };

  const handleLoadRegistrations = async (eventId: string) => {
    if (!eventId) {
      setRegistrations([]);
      setSelectedRegistrations(new Set());
      return;
    }

    try {
      setLoadingRegistrations(true);
      const eventRegistrations = await RegistrationService.getEventRegistrations(eventId);
      setRegistrations(eventRegistrations);
      setSelectedRegistrations(new Set());
    } catch (error) {
      logger.error('Error loading registrations:', error);
      toast.error('Failed to load registrations');
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const getFilteredRegistrations = () => {
    // Filter issued certificates for the selected event
    const eventCertificates = issuedCertificates.filter(cert => cert.eventId === bulkGenerateEventId);
    
    return registrations.filter(reg => {
      // Check if certificate exists in issuedCertificates for this event
      const hasCertificate = eventCertificates.some(
        cert => cert.registrationId === reg.id || 
               cert.recipientEmail === reg.userDetails?.email
      );
      
      // Apply status filter - check for both 'attended' and 'checked-in' statuses
      if (bulkGenerateFilter === 'attended') {
        if (reg.attendanceStatus !== 'attended' && reg.attendanceStatus !== 'checked-in') return false;
      }
      if (bulkGenerateFilter === 'no-certificate') {
        if (hasCertificate || reg.certificateIssued) return false;
      }
      
      // Apply search filter
      if (attendeeSearchTerm.trim()) {
        const search = attendeeSearchTerm.toLowerCase();
        const name = (reg.userDetails?.name || '').toLowerCase();
        const email = (reg.userDetails?.email || '').toLowerCase();
        if (!name.includes(search) && !email.includes(search)) return false;
      }
      
      return true;
    });
  };

  // Helper to check if a registration has a certificate issued
  const hasIssuedCertificate = (reg: Registration) => {
    // Filter issued certificates for the selected event
    const eventCertificates = issuedCertificates.filter(cert => cert.eventId === bulkGenerateEventId);
    
    return reg.certificateIssued || eventCertificates.some(
      cert => cert.registrationId === reg.id || 
             cert.recipientEmail === reg.userDetails?.email
    );
  };

  // Get count of registrations without certificates (using actual issued certs data)
  const getRegistrationsWithoutCertificateCount = () => {
    // Filter issued certificates for the selected event
    const eventCertificates = issuedCertificates.filter(cert => cert.eventId === bulkGenerateEventId);
    
    return registrations.filter(reg => {
      const hasCert = reg.certificateIssued || eventCertificates.some(
        cert => cert.registrationId === reg.id || 
               cert.recipientEmail === reg.userDetails?.email
      );
      return !hasCert;
    }).length;
  };

  // Get count of attended/checked-in registrations
  const getAttendedCount = () => {
    return registrations.filter(r => r.attendanceStatus === 'attended' || r.attendanceStatus === 'checked-in').length;
  };

  const handleClearSelection = () => {
    setSelectedRegistrations(new Set());
  };

  const handleInvertSelection = () => {
    const filtered = getFilteredRegistrations();
    const newSelection = new Set<string>();
    filtered.forEach(reg => {
      if (!selectedRegistrations.has(reg.id)) {
        newSelection.add(reg.id);
      }
    });
    setSelectedRegistrations(newSelection);
  };

  const handleSelectRegistration = (registrationId: string) => {
    setSelectedRegistrations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(registrationId)) {
        newSet.delete(registrationId);
      } else {
        newSet.add(registrationId);
      }
      return newSet;
    });
  };

  const handleSelectAllRegistrations = () => {
    const filtered = getFilteredRegistrations();
    if (selectedRegistrations.size === filtered.length) {
      setSelectedRegistrations(new Set());
    } else {
      setSelectedRegistrations(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkGenerate = async () => {
    if (selectedRegistrations.size === 0) {
      toast.error('Please select at least one attendee');
      return;
    }

    const selectedEvent = events.find(e => e.id === bulkGenerateEventId);
    if (!selectedEvent) {
      toast.error('Please select an event');
      return;
    }

    // Find template for this event
    const eventTemplate = templates.find(t => t.eventId === bulkGenerateEventId && t.isActive);
    if (!eventTemplate) {
      toast.error('No active certificate template found for this event. Please create one first.');
      return;
    }

    // Show warning for large batches
    if (selectedRegistrations.size > 50) {
      const proceed = confirm(
        `You are about to generate ${selectedRegistrations.size} certificates. ` +
        `This may take a while. Do you want to continue?`
      );
      if (!proceed) return;
    }

    try {
      setBulkGenerating(true);
      const selected = getFilteredRegistrations().filter(r => selectedRegistrations.has(r.id));
      setBulkGenerateProgress({ current: 0, total: selected.length });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selected.length; i++) {
        const reg = selected[i];
        try {
          await CertificateService.generateCertificate({
            templateId: eventTemplate.id,
            recipientName: reg.userDetails?.name || 'Unknown',
            recipientEmail: reg.userDetails?.email || '',
            eventId: bulkGenerateEventId,
            eventTitle: selectedEvent.title,
            userId: reg.userId,
            registrationId: reg.id
          });
          successCount++;
        } catch (err) {
          logger.error(`Failed to generate certificate for ${reg.userDetails?.name}:`, err);
          failCount++;
        }

        setBulkGenerateProgress({ current: i + 1, total: selected.length });

        // Add small delay every 10 certificates to prevent rate limiting
        if ((i + 1) % 10 === 0 && i + 1 < selected.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Refresh issued certificates
      const updatedCertificates = await CertificateService.getAllIssuedCertificates();
      setIssuedCertificates(updatedCertificates);

      if (failCount === 0) {
        toast.success(`Successfully generated ${successCount} certificate(s)!`);
      } else {
        toast.success(`Generated ${successCount} certificate(s). ${failCount} failed.`);
      }

      handleCloseBulkGenerate();
    } catch (error) {
      logger.error('Error during bulk generation:', error);
      toast.error('An error occurred during bulk generation');
    } finally {
      setBulkGenerating(false);
    }
  };

  // Helper function to get template name by ID
  const getTemplateName = (templateId: string, fallback: string) => {
    const template = templates.find(t => t.id === templateId);
    return template?.name || fallback;
  };

  // Filter templates and certificates based on search and event
  const filteredTemplates = templates.filter(template => 
    (template.name || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedEvent === '' || template.eventId === selectedEvent)
  );

  // Enrich certificates with resolved template names
  const enrichedCertificates = issuedCertificates.map(cert => ({
    ...cert,
    templateName: getTemplateName(cert.templateId, cert.templateName)
  }));

  const filteredCertificates = enrichedCertificates.filter(cert => 
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
        {/* Load Names Button - shows when event is selected */}
        {selectedEvent && (
          <button
            onClick={handleLoadFullNames}
            className="px-3 py-2 text-sm bg-amber-100 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors inline-flex items-center gap-2"
            title="Load full names from registrations to check for name mismatches"
          >
            <WrenchScrewdriverIcon className="w-4 h-4" />
            Check Names
          </button>
        )}
      </div>

      {/* Regeneration Progress */}
      {isRegenerating && (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-700">
              Regenerating certificates...
            </span>
            <span className="text-sm text-amber-600">
              {regenerateProgress.current} / {regenerateProgress.total}
            </span>
          </div>
          <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-600 transition-all duration-300 ease-out"
              style={{ 
                width: `${regenerateProgress.total > 0 
                  ? (regenerateProgress.current / regenerateProgress.total) * 100 
                  : 0}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Bulk Export Controls */}
      {filteredCertificates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedCertificates.size === filteredCertificates.length && filteredCertificates.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              aria-label="Select all certificates"
            />
            <span className="text-sm text-gray-600">
              {selectedCertificates.size > 0 
                ? `${selectedCertificates.size} of ${filteredCertificates.length} selected`
                : `Select all (${filteredCertificates.length})`
              }
            </span>
          </div>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            {/* Fix Names Button - only show when there are certificates that need fixing */}
            {selectedCertificates.size > 0 && Object.keys(certificateFullNames).length > 0 && (
              <button
                onClick={handleBulkRegenerateNames}
                disabled={isRegenerating || !filteredCertificates.some(c => selectedCertificates.has(c.id) && certificateNeedsNameFix(c))}
                className="px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                title="Regenerate selected certificates with corrected full names"
              >
                {isRegenerating ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <WrenchScrewdriverIcon className="w-4 h-4" />
                    Fix Names
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={selectedCertificates.size === 0}
              className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleBulkExport}
              disabled={selectedCertificates.size === 0 || isExporting}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                  Download Selected
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedCertificates.size === filteredCertificates.length && filteredCertificates.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      aria-label="Select all certificates"
                    />
                  </th>
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
                  <tr 
                    key={certificate.id}
                    className={selectedCertificates.has(certificate.id) ? 'bg-blue-50' : ''}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCertificates.has(certificate.id)}
                        onChange={() => handleSelectCertificate(certificate.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        aria-label={`Select certificate for ${certificate.recipientName}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          {certificate.recipientName}
                          {certificateNeedsNameFix(certificate) && (
                            <span 
                              className="inline-flex items-center text-amber-600" 
                              title={`Should be: ${certificateFullNames[certificate.id]}`}
                            >
                              <ExclamationTriangleIcon className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        {certificateNeedsNameFix(certificate) && (
                          <div className="text-xs text-amber-600">
                            Should be: {certificateFullNames[certificate.id]}
                          </div>
                        )}
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
                        <button 
                          onClick={() => certificate.certificateUrl && window.open(certificate.certificateUrl, '_blank')}
                          disabled={!certificate.certificateUrl}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-300 disabled:cursor-not-allowed p-1 rounded hover:bg-blue-50 transition-colors"
                          title="View certificate"
                          aria-label={`View certificate for ${certificate.recipientName}`}
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!certificate.certificateUrl) {
                              toast.error('Certificate URL not available');
                              return;
                            }
                            try {
                              const response = await fetch(certificate.certificateUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `certificate-${certificate.recipientName.replace(/\s+/g, '_')}-${certificate.verificationCode}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                              toast.success('Certificate downloaded!');
                            } catch (err) {
                              logger.error('Failed to download certificate:', err);
                              toast.error('Failed to download certificate');
                            }
                          }}
                          disabled={!certificate.certificateUrl}
                          className="text-green-600 hover:text-green-900 disabled:text-gray-300 disabled:cursor-not-allowed p-1 rounded hover:bg-green-50 transition-colors"
                          title="Download certificate"
                          aria-label={`Download certificate for ${certificate.recipientName}`}
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            const verifyUrl = `${window.location.origin}/verify/${certificate.verificationCode}`;
                            window.open(verifyUrl, '_blank');
                          }}
                          className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50 transition-colors"
                          title="View verification page"
                          aria-label={`View verification page for ${certificate.recipientName}`}
                        >
                          <QrCodeIcon className="w-4 h-4" />
                        </button>
                        {/* Fix Name Button - only show if certificate needs fixing */}
                        {certificateNeedsNameFix(certificate) && (
                          <button 
                            onClick={() => handleRegenerateCertificateName(certificate)}
                            disabled={regeneratingCertId === certificate.id}
                            className="text-amber-600 hover:text-amber-900 disabled:text-gray-300 disabled:cursor-not-allowed p-1 rounded hover:bg-amber-50 transition-colors"
                            title={`Fix name to: ${certificateFullNames[certificate.id]}`}
                            aria-label={`Fix certificate name for ${certificate.recipientName}`}
                          >
                            {regeneratingCertId === certificate.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <WrenchScrewdriverIcon className="w-4 h-4" />
                            )}
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
          <button
            onClick={handleOpenBulkGenerate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
          >
            <UserGroupIcon className="w-5 h-5" />
            Bulk Generate
          </button>
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

      {/* Bulk Generate Modal */}
      {showBulkGenerateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseBulkGenerate}
              aria-hidden="true"
            />
            
            <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Bulk Generate Certificates</h2>
                  <p className="text-sm text-gray-500 mt-1">Generate certificates for multiple attendees at once</p>
                </div>
                <button
                  onClick={handleCloseBulkGenerate}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {/* Event Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Event *
                  </label>
                  <select
                    value={bulkGenerateEventId}
                    onChange={(e) => {
                      setBulkGenerateEventId(e.target.value);
                      handleLoadRegistrations(e.target.value);
                    }}
                    disabled={bulkGenerating}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Choose an event...</option>
                    {events.map(event => {
                      const hasTemplate = templates.some(t => t.eventId === event.id && t.isActive);
                      return (
                        <option key={event.id} value={event.id}>
                          {event.title} {hasTemplate ? '✓' : '(No template)'}
                        </option>
                      );
                    })}
                  </select>
                  {bulkGenerateEventId && !templates.some(t => t.eventId === bulkGenerateEventId && t.isActive) && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      This event has no active certificate template. Please create one first.
                    </p>
                  )}
                </div>

                {/* Filter Tabs */}
                {bulkGenerateEventId && registrations.length > 0 && (
                  <div className="mb-4">
                    <div className="flex gap-2 border-b border-gray-200">
                      <button
                        onClick={() => setBulkGenerateFilter('all')}
                        disabled={bulkGenerating}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          bulkGenerateFilter === 'all'
                            ? 'text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        All ({registrations.length})
                      </button>
                      <button
                        onClick={() => setBulkGenerateFilter('attended')}
                        disabled={bulkGenerating}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          bulkGenerateFilter === 'attended'
                            ? 'text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Attended ({getAttendedCount()})
                      </button>
                      <button
                        onClick={() => setBulkGenerateFilter('no-certificate')}
                        disabled={bulkGenerating}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          bulkGenerateFilter === 'no-certificate'
                            ? 'text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        No Certificate ({getRegistrationsWithoutCertificateCount()})
                      </button>
                    </div>
                  </div>
                )}

                {/* Search and Selection Controls */}
                {bulkGenerateEventId && registrations.length > 0 && (
                  <div className="mb-4 flex flex-col sm:flex-row gap-3">
                    {/* Search Box */}
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={attendeeSearchTerm}
                        onChange={(e) => setAttendeeSearchTerm(e.target.value)}
                        disabled={bulkGenerating}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                    
                    {/* Quick Selection Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllRegistrations}
                        disabled={bulkGenerating || getFilteredRegistrations().length === 0}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleClearSelection}
                        disabled={bulkGenerating || selectedRegistrations.size === 0}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleInvertSelection}
                        disabled={bulkGenerating || getFilteredRegistrations().length === 0}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Invert
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {bulkGenerating && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700">
                        Generating certificates...
                      </span>
                      <span className="text-sm text-green-600">
                        {bulkGenerateProgress.current} / {bulkGenerateProgress.total}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-green-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 transition-all duration-300 ease-out"
                        style={{ 
                          width: `${bulkGenerateProgress.total > 0 
                            ? (bulkGenerateProgress.current / bulkGenerateProgress.total) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Registrations Table */}
                {loadingRegistrations ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : bulkGenerateEventId && getFilteredRegistrations().length === 0 ? (
                  <div className="text-center py-12">
                    <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No attendees found matching the selected filter.</p>
                  </div>
                ) : bulkGenerateEventId && getFilteredRegistrations().length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left w-12">
                            <input
                              type="checkbox"
                              checked={selectedRegistrations.size === getFilteredRegistrations().length && getFilteredRegistrations().length > 0}
                              onChange={handleSelectAllRegistrations}
                              disabled={bulkGenerating}
                              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              aria-label="Select all attendees"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredRegistrations().map(reg => (
                          <tr 
                            key={reg.id}
                            onClick={() => !bulkGenerating && handleSelectRegistration(reg.id)}
                            className={`cursor-pointer transition-colors ${selectedRegistrations.has(reg.id) ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedRegistrations.has(reg.id)}
                                onChange={() => handleSelectRegistration(reg.id)}
                                disabled={bulkGenerating}
                                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                aria-label={`Select ${reg.userDetails?.name}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {reg.userDetails?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {reg.userDetails?.email || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                reg.attendanceStatus === 'attended' || reg.attendanceStatus === 'checked-in'
                                  ? 'bg-green-100 text-green-800'
                                  : reg.attendanceStatus === 'registered' || reg.attendanceStatus === 'pending'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {reg.attendanceStatus === 'checked-in' ? 'Checked In' : (reg.attendanceStatus || 'Registered')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {hasIssuedCertificate(reg) ? (
                                <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Issued
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
                                  <XCircleIcon className="w-4 h-4" />
                                  Not issued
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-500">
                  {selectedRegistrations.size > 0 && (
                    <span>{selectedRegistrations.size} attendee(s) selected</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseBulkGenerate}
                    disabled={bulkGenerating}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkGenerate}
                    disabled={bulkGenerating || selectedRegistrations.size === 0 || !templates.some(t => t.eventId === bulkGenerateEventId && t.isActive)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {bulkGenerating ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        Generate Certificates
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutComponent>
  );
};

export default CertificatesPage;
