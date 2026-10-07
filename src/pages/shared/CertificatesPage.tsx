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
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import DashboardShell from '../../components/shared/DashboardShell';
import ProgressBar from '../../components/shared/UI/ProgressBar';
import { Button, Modal } from '../../components/shared/UI';
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
 * Combines First Name + Last Name from customResponses for forms with separate name fields
 * 
 * Common field mappings:
 * - Field '1': First Name (DevFest Davao form)
 * - Field '1762143123275': Last Name (DevFest Davao form)
 * - Also checks for common variations like 'firstName', 'first_name', 'lastName', 'last_name'
 * 
 * Falls back to userDetails.name if customResponses don't have the fields
 */
const getFullNameFromRegistration = (regData: { customResponses?: Record<string, string | boolean | number>; userDetails?: { name?: string } } | Registration | null): string | null => {
  if (!regData) return null;
  
  const customResponses = (regData as Registration).customResponses || (regData as { customResponses?: Record<string, string | boolean | number> }).customResponses || {};
  const userDetails = (regData as Registration).userDetails || (regData as { userDetails?: { name?: string } }).userDetails || {};
  
  // Try to find first name and last name from customResponses
  // Support multiple field naming conventions
  const firstNameFields = ['1', 'firstName', 'first_name', 'First Name', 'first name'];
  const lastNameFields = ['1762143123275', 'lastName', 'last_name', 'Last Name', 'last name'];
  
  let firstName: string | undefined;
  let lastName: string | undefined;
  
  // Find first name
  for (const field of firstNameFields) {
    const value = customResponses[field];
    if (typeof value === 'string' && value.trim()) {
      firstName = value.trim();
      break;
    }
  }
  
  // Find last name
  for (const field of lastNameFields) {
    const value = customResponses[field];
    if (typeof value === 'string' && value.trim()) {
      lastName = value.trim();
      break;
    }
  }
  
  // If we found both first and last name, combine them
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  // Fall back to userDetails.name
  if (userDetails.name) return userDetails.name;
  
  // Last resort: return first name only if available
  return firstName || null;
};

interface CertificatesPageProps {
  embedded?: boolean;
  propEventId?: string;
}

const CertificatesPage: React.FC<CertificatesPageProps> = ({
  embedded = false,
  propEventId
}) => {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const eventId = propEventId || searchParams.get('eventId');
  const LayoutComponent = DashboardShell;
  
  const [activeTab, setActiveTab] = useState<'templates' | 'issued' | 'builder'>('templates');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(eventId || '');
  const [loading, setLoading] = useState(false);
  const [selectedCertificates, setSelectedCertificates] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Bulk generate state
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [bulkGenerateEventId, setBulkGenerateEventId] = useState(eventId || '');
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

  // Regenerate with updated template state
  const [showRegenerateWarningModal, setShowRegenerateWarningModal] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState<'template_fix' | 'name_fix' | ''>('');

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
        
        // Organizers are scoped to their own events (Data Privacy Act 2012)
        const isAdminUser = userProfile?.role === 'admin';
        const [eventsData, templatesData, certificatesData] = await Promise.all([
          isAdminUser || !userProfile?.uid
            ? EventService.getAllEvents()
            : EventService.getEventsByOrganizer(userProfile.uid),
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
        templateImageUrl: uploadedImage,
        dimensions: templateDimensions,
        elements: elements,
        templateMode: 'enhanced',
        isActive: true,
        createdBy: userProfile?.uid || 'unknown'
      };
      // Firestore rejects undefined field values, so omit rather than assign undefined.
      if (templateEventId) templateData.eventId = templateEventId;

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
        templateImageUrl: uploadedImage,
        dimensions: templateDimensions,
        elements: elements,
        templateMode: 'enhanced',
        isActive: true,
        createdBy: editingTemplate.createdBy
      };
      // Firestore rejects undefined field values, so omit rather than assign undefined.
      if (templateEventId) updatedTemplateData.eventId = templateEventId;

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

      // Refresh only the affected event's certificates
      const updatedCertificates = await CertificateService.getAllIssuedCertificates(recipientData.eventId);
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
        eventDate: cert.eventDate || cert.issuedDate || new Date().toISOString(),
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
          eventDate: cert.eventDate || cert.issuedDate || new Date().toISOString(),
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

    // Every certificate in `eventCerts` belongs to `selectedEvent`, so one indexed
    // query replaces one getDoc per certificate (was N sequential round-trips).
    const registrations = await RegistrationService.getEventRegistrations(selectedEvent);
    const byId = new Map(registrations.map((reg) => [reg.id, reg]));

    for (const cert of eventCerts) {
      const reg = cert.registrationId ? byId.get(cert.registrationId) : undefined;
      const fullName = reg ? getFullNameFromRegistration(reg) : null;
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

  // Regenerate selected certificates with updated template (e.g., after template fix)
  const handleRegenerateWithTemplate = async () => {
    if (selectedCertificates.size === 0) {
      toast.error('Please select at least one certificate to regenerate');
      return;
    }

    const selectedCerts = filteredCertificates.filter(c => selectedCertificates.has(c.id));
    
    // Group by template to show which templates will be used
    const templateIds = [...new Set(selectedCerts.map(c => c.templateId))];
    
    setIsRegenerating(true);
    setRegenerateProgress({ current: 0, total: selectedCerts.length });
    setShowRegenerateWarningModal(false);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedCerts.length; i++) {
      const cert = selectedCerts[i];
      
      try {
        // Get the latest template
        const template = await CertificateService.getTemplateById(cert.templateId);
        if (!template) {
          logger.warn(`Template ${cert.templateId} not found for certificate ${cert.id}`);
          failCount++;
          continue;
        }
        
        // Generate new certificate with current template
        const result = await CertificateGenerationService.generateCertificate(template, {
          templateId: cert.templateId,
          recipientName: cert.recipientName,
          recipientEmail: cert.recipientEmail,
          eventTitle: cert.eventTitle,
          eventDate: cert.eventDate || cert.issuedDate || new Date().toISOString(),
          eventId: cert.eventId,
          verificationCode: cert.verificationCode // Keep the same verification code
        });
        
        // Upload to Firebase Storage (overwrite existing)
        const imageRef = ref(storage, `certificates/${cert.eventId}/${cert.verificationCode}.png`);
        await uploadBytes(imageRef, result.blob, { contentType: 'image/png' });
        const newUrl = await getDownloadURL(imageRef);
        
        // Update Firestore document with new URL
        const certRef = doc(db, 'certificates', cert.id);
        await updateDoc(certRef, {
          certificateUrl: newUrl,
          updatedAt: serverTimestamp(),
          regeneratedAt: serverTimestamp(),
          regenerationReason: regenerateReason || 'Template update'
        });
        
        // Update local state
        setIssuedCertificates(prev => prev.map(c => 
          c.id === cert.id ? { ...c, certificateUrl: newUrl } : c
        ));
        
        successCount++;
      } catch (err) {
        logger.error(`Error regenerating certificate ${cert.id}:`, err);
        failCount++;
      }
      
      setRegenerateProgress({ current: i + 1, total: selectedCerts.length });
      
      // Add small delay to prevent rate limiting
      if ((i + 1) % 5 === 0 && i + 1 < selectedCerts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsRegenerating(false);
    setSelectedCertificates(new Set());
    setRegenerateReason('');
    
    if (failCount === 0) {
      toast.success(`Successfully regenerated ${successCount} certificate(s) with updated template!`);
    } else {
      toast.success(`Regenerated ${successCount} certificate(s). ${failCount} failed.`);
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
      
      // Filter to attendees only. 'attended' is a UI-only status value; the value
      // persisted to Firestore is 'checked-in'.
      if (bulkGenerateFilter === 'attended') {
        if (reg.attendanceStatus !== 'checked-in') return false;
      }
      if (bulkGenerateFilter === 'no-certificate') {
        if (hasCertificate || reg.certificateIssued) return false;
      }
      
      // Apply search filter - search both userDetails.name and full name from customResponses
      if (attendeeSearchTerm.trim()) {
        const search = attendeeSearchTerm.toLowerCase();
        const name = (reg.userDetails?.name || '').toLowerCase();
        const fullName = (getFullNameFromRegistration(reg) || '').toLowerCase();
        const email = (reg.userDetails?.email || '').toLowerCase();
        if (!name.includes(search) && !fullName.includes(search) && !email.includes(search)) return false;
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
    return registrations.filter(r => r.attendanceStatus === 'checked-in').length;
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
        // Use getFullNameFromRegistration to properly combine First Name + Last Name from customResponses
        const fullName = getFullNameFromRegistration(reg) || reg.userDetails?.name || 'Unknown';
        try {
          await CertificateService.generateCertificate({
            templateId: eventTemplate.id,
            recipientName: fullName,
            recipientEmail: reg.userDetails?.email || '',
            eventId: bulkGenerateEventId,
            eventTitle: selectedEvent.title,
            userId: reg.userId,
            registrationId: reg.id
          });
          successCount++;
        } catch (err) {
          logger.error(`Failed to generate certificate for ${fullName}:`, err);
          failCount++;
        }

        setBulkGenerateProgress({ current: i + 1, total: selected.length });

        // Add small delay every 10 certificates to prevent rate limiting
        if ((i + 1) % 10 === 0 && i + 1 < selected.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Refresh only the affected event's certificates
      const updatedCertificates = await CertificateService.getAllIssuedCertificates(bulkGenerateEventId);
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
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-outline-variant" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="px-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">All Events</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
        <button
          onClick={() => setActiveTab('builder')}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
        >
          <SparklesIcon className="w-5 h-5" />
          Create Template
        </button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="w-16 h-16 mx-auto text-outline-variant mb-4" />
          <h3 className="text-lg font-medium text-on-surface mb-2">No templates found</h3>
          <p className="text-on-surface-variant mb-4">Create your first certificate template to get started.</p>
          <button
            onClick={() => setActiveTab('builder')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-lg border border-outline-variant overflow-hidden">
              <div className="aspect-[4/3] bg-surface-container relative">
                {template.templateImageUrl ? (
                  <img 
                    src={template.templateImageUrl} 
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhotoIcon className="w-12 h-12 text-outline-variant" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {template.isActive ? (
                    <CheckCircleIcon className="w-6 h-6 text-success" />
                  ) : (
                    <XCircleIcon className="w-6 h-6 text-outline-variant" />
                  )}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-on-surface mb-1">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-on-surface-variant mb-2">{template.description}</p>
                )}
                {template.eventId && (
                  <p className="text-sm text-primary mb-2">
                    {events.find(e => e.id === template.eventId)?.title || 'Unknown Event'}
                  </p>
                )}
                
                {/* CORS Warning for external URLs */}
                {template.templateImageUrl && !CertificateService.isFirebaseStorageUrl(template.templateImageUrl) && (
                  <div className="mb-3 p-2 bg-warning-container border border-outline-variant rounded-lg">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-warning">
                        <p className="font-medium">External image URL</p>
                        <p>Re-upload to Firebase for CORS compliance</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreviewTemplate(template)}
                    className="flex-1 px-3 py-2 text-sm bg-surface-container text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Preview
                  </button>
                  {/* Re-upload button for external URLs */}
                  {template.templateImageUrl && !CertificateService.isFirebaseStorageUrl(template.templateImageUrl) && (
                    <button
                      onClick={() => handleReuploadImage(template)}
                      disabled={loading}
                      className="px-3 py-2 text-sm bg-warning-container text-warning rounded-lg hover:bg-warning-container transition-colors disabled:opacity-50"
                      title="Re-upload to Firebase Storage"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="px-3 py-2 text-sm bg-error-container text-error rounded-lg hover:bg-error-container transition-colors"
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
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-outline-variant" />
          <input
            type="text"
            placeholder="Search by name, email, or template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="px-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="px-3 py-2 text-sm bg-warning-container border border-outline-variant text-on-warning-container rounded-lg hover:bg-warning-container transition-colors inline-flex items-center gap-2"
            title="Load full names from registrations to check for name mismatches"
          >
            <WrenchScrewdriverIcon className="w-4 h-4" />
            Check Names
          </button>
        )}
      </div>

      {/* Regeneration Progress */}
      {isRegenerating && (
        <div className="p-4 bg-warning-container rounded-lg border border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-warning">
              Regenerating certificates...
            </span>
            <span className="text-sm text-warning">
              {regenerateProgress.current} / {regenerateProgress.total}
            </span>
          </div>
          <ProgressBar
            value={regenerateProgress.total > 0
              ? (regenerateProgress.current / regenerateProgress.total) * 100
              : 0}
            size="md"
            color="bg-amber-600"
            label="Certificate regeneration progress"
            showValue
          />
        </div>
      )}

      {/* Bulk Export Controls */}
      {filteredCertificates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedCertificates.size === filteredCertificates.length && filteredCertificates.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary"
              aria-label="Select all certificates"
            />
            <span className="text-sm text-on-surface-variant">
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
                className="px-3 py-2 text-sm bg-warning text-white rounded-lg hover:bg-warning transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                title="Regenerate selected certificates with corrected full names"
              >
                {isRegenerating ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 motion-essential animate-spin" />
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
            {/* Regenerate with Template Button */}
            {selectedCertificates.size > 0 && (
              <button
                onClick={() => setShowRegenerateWarningModal(true)}
                disabled={isRegenerating}
                className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                title="Regenerate selected certificates with updated template"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Regenerate Template
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={selectedCertificates.size === 0}
              className="px-3 py-2 text-sm bg-white border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleBulkExport}
              disabled={selectedCertificates.size === 0 || isExporting}
              className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 motion-essential animate-spin" />
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
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-outline-variant mb-4" />
          <h3 className="text-lg font-medium text-on-surface mb-2">No certificates found</h3>
          <p className="text-on-surface-variant">No certificates have been issued yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedCertificates.size === filteredCertificates.length && filteredCertificates.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary"
                      aria-label="Select all certificates"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-outline-variant">
                {filteredCertificates.map(certificate => (
                  <tr 
                    key={certificate.id}
                    className={selectedCertificates.has(certificate.id) ? 'bg-surface-container-low' : ''}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCertificates.has(certificate.id)}
                        onChange={() => handleSelectCertificate(certificate.id)}
                        className="w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary"
                        aria-label={`Select certificate for ${certificate.recipientName}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-on-surface flex items-center gap-1">
                          {certificate.recipientName}
                          {certificateNeedsNameFix(certificate) && (
                            <span 
                              className="inline-flex items-center text-warning" 
                              title={`Should be: ${certificateFullNames[certificate.id]}`}
                            >
                              <ExclamationTriangleIcon className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        {certificateNeedsNameFix(certificate) && (
                          <div className="text-sm text-warning">
                            Should be: {certificateFullNames[certificate.id]}
                          </div>
                        )}
                        <div className="text-sm text-on-surface-variant">{certificate.recipientEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {certificate.templateName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {certificate.eventTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {new Date(certificate.issuedDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-sm font-medium rounded-full ${
                        certificate.status === 'issued' 
                          ? 'bg-success-container text-on-success-container'
                          : certificate.status === 'verified'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-error-container text-on-error-container'
                      }`}>
                        {certificate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => certificate.certificateUrl && window.open(certificate.certificateUrl, '_blank')}
                          disabled={!certificate.certificateUrl}
                          className="text-primary hover:text-on-secondary-container disabled:text-outline-variant disabled:cursor-not-allowed p-1 rounded hover:bg-surface-container-low transition-colors"
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
                          className="text-success hover:text-on-success-container disabled:text-outline-variant disabled:cursor-not-allowed p-1 rounded hover:bg-success-container transition-colors"
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
                          className="text-primary hover:text-on-primary-container p-1 rounded hover:bg-surface-container-low transition-colors"
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
                            className="text-warning hover:text-on-warning-container disabled:text-outline-variant disabled:cursor-not-allowed p-1 rounded hover:bg-warning-container transition-colors"
                            title={`Fix name to: ${certificateFullNames[certificate.id]}`}
                            aria-label={`Fix certificate name for ${certificate.recipientName}`}
                          >
                            {regeneratingCertId === certificate.id ? (
                              <ArrowPathIcon className="w-4 h-4 motion-essential animate-spin" />
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
      <div className="bg-white rounded-lg border border-outline-variant p-6">
        <h2 className="text-xl font-semibold text-on-surface mb-6">
          {editingTemplate ? 'Edit Certificate Template' : 'Create Certificate Template'}
        </h2>
        
        <div className="space-y-8">
          {/* Template Information Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Info */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter template name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Description
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter template description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Event (Optional)
              </label>
              <select
                value={templateEventId}
                onChange={(e) => setTemplateEventId(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select an event (optional)</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Upload Template Image *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-outline-variant rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Template" className="h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <CloudArrowUpIcon className="w-8 h-8 text-outline-variant mx-auto mb-2" />
                    <p className="text-sm text-on-surface-variant">Click to upload template image</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Width (px)</label>
                <input
                  type="number"
                  value={templateDimensions.width}
                  readOnly
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant"
                  placeholder="Upload image to auto-detect"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Height (px)</label>
                <input
                  type="number"
                  value={templateDimensions.height}
                  readOnly
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant"
                  placeholder="Upload image to auto-detect"
                />
              </div>
            </div>
            </div>

            {/* Template Elements Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-on-surface">Template Elements</h3>
                <div className="flex gap-2">
                    <button
                    onClick={() => addElement('text')}
                    className="px-3 py-1 text-sm bg-secondary-container text-primary rounded hover:bg-surface-container-high transition-colors flex items-center gap-1"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Add Text
                    </button>
                    <button
                    onClick={() => addElement('qrcode')}
                    className="px-3 py-1 text-sm bg-success-container text-success rounded hover:bg-success-container transition-colors flex items-center gap-1"
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
                        ? 'border-primary bg-surface-container-low'
                        : 'border-outline-variant hover:border-outline'
                    }`}
                    onClick={() => setSelectedElement(element.id)}
                  >
                    <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                        {element.type === 'text' && <DocumentTextIcon className="w-4 h-4 text-primary" />}
                        {element.type === 'qrcode' && <QrCodeIcon className="w-4 h-4 text-success" />}
                        <span className="text-sm font-medium capitalize">{element.type}</span>
                      </div>
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(element.id);
                        }}
                        className="p-1 text-error hover:bg-error-container rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                    <p className="text-sm text-on-surface-variant mt-1 truncate">
                      {element.content || `${element.type} element`}
                    </p>
                  </div>
                ))}
                </div>

              {/* Element Properties */}
              {selectedElementData && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-on-surface mb-3">Element Properties</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">Content</label>
                      <textarea
                        value={selectedElementData.content}
                        onChange={(e) => updateElement(selectedElement!, { content: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                        placeholder="Enter content or template variables like {{ recipientName }}"
                      />
                  </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">X Position (%)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.x}
                          onChange={(e) => updateElement(selectedElement!, { 
                            position: { ...selectedElementData.position, x: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                        />
              </div>
                      <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Y Position (%)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.y}
                          onChange={(e) => updateElement(selectedElement!, { 
                            position: { ...selectedElementData.position, y: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    {selectedElementData.type === 'text' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElementData.style.fontSize || 16}
                              onChange={(e) => updateElement(selectedElement!, { 
                                style: { ...selectedElementData.style, fontSize: parseInt(e.target.value) || 16 }
                              })}
                              className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Color</label>
                            <input
                              type="color"
                              value={selectedElementData.style.color || '#000000'}
                              onChange={(e) => updateElement(selectedElement!, { 
                                style: { ...selectedElementData.style, color: e.target.value }
                              })}
                              className="w-full h-8 border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-on-surface-variant mb-1">Font Family</label>
                          <select
                            value={selectedElementData.style.fontFamily || 'Arial'}
                            onChange={(e) => updateElement(selectedElement!, { 
                              style: { ...selectedElementData.style, fontFamily: e.target.value }
                            })}
                            className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                          </select>
                  </div>

                        <div>
                          <label className="block text-sm font-medium text-on-surface-variant mb-1">Text Align</label>
                          <select
                            value={selectedElementData.style.align || 'left'}
                            onChange={(e) => updateElement(selectedElement!, { 
                              style: { ...selectedElementData.style, align: e.target.value as 'left' | 'center' | 'right' }
                            })}
                            className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
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
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Size (px)</label>
                        <input
                          type="number"
                          value={selectedElementData.position.width || 100}
                          onChange={(e) => {
                            const size = parseInt(e.target.value) || 100;
                            updateElement(selectedElement!, { 
                              position: { ...selectedElementData.position, width: size, height: size }
                            });
                          }}
                          className="w-full px-2 py-1 text-sm border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-transparent"
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
              <h3 className="text-lg font-medium text-on-surface">Template Preview</h3>
              {uploadedImage && (
                <div className="text-sm text-on-surface-variant">
                  {templateDimensions.width} × {templateDimensions.height} pixels
                </div>
              )}
            </div>
            <div className="border border-outline-variant rounded-lg p-6 bg-surface-container-low">
              {uploadedImage ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`w-full max-w-4xl mx-auto border border-outline-variant rounded bg-white shadow-lg ${
                      isDragging ? 'cursor-grabbing' : hoveredElement ? 'cursor-grab' : 'cursor-default'
                    }`}
                      style={{
                      aspectRatio: `${templateDimensions.width}/${templateDimensions.height}`,
                      maxHeight: '600px'
                    }}
                  />
                  
                </div>
              ) : (
                <div className="w-full h-96 bg-surface-container-high rounded flex items-center justify-center">
                  <div className="text-center">
                    <PhotoIcon className="w-16 h-16 text-outline-variant mx-auto mb-4" />
                    <p className="text-lg text-on-surface-variant mb-2">Upload a template image to start building</p>
                    <p className="text-sm text-outline-variant">The canvas will automatically resize to match your image dimensions</p>
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
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-surface-container-highest disabled:cursor-not-allowed transition-colors"
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
              className="px-4 py-2 bg-surface-container-highest text-on-surface-variant rounded-lg hover:bg-surface-container-highest transition-colors"
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
            case 'text': {
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
            }
              
            case 'qrcode': {
        // Draw QR code placeholder
              const size = element.position.width || 100;
        ctx.fillStyle = '#000000';
              ctx.fillRect(x - size/2, y - size/2, size, size);
        ctx.fillStyle = '#ffffff';
              ctx.fillRect(x - size/2 + 10, y - size/2 + 10, size - 20, size - 20);
              break;
            }
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

  const certContent = (
    <>
      <div className="space-y-6">
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between">
          {/*
            h2, not h1. LayoutComponent is DashboardShell, which already emits
            the page's <h1> from the route; this used to be a second <h1> on
            the same screen. Demoted to h2 so the document outline has exactly
            one top-level heading while the action stays here.
          */}
          <div>
            <h2 className="text-xl font-bold text-on-surface">Certificate Management</h2>
          </div>
          <button
            onClick={handleOpenBulkGenerate}
            className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover transition-colors inline-flex items-center gap-2"
          >
            <UserGroupIcon className="w-5 h-5" />
            Bulk Generate
          </button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <button
            onClick={handleOpenBulkGenerate}
            className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover transition-colors inline-flex items-center gap-2"
          >
            <UserGroupIcon className="w-5 h-5" />
            Bulk Generate
          </button>
        </div>
      )}

        {/* Tabs */}
        <div className="border-b border-outline-variant">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
              }`}
            >
              <AcademicCapIcon className="w-5 h-5 inline mr-2" />
              Templates ({templates.length})
            </button>
            <button
              onClick={() => setActiveTab('issued')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'issued'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5 inline mr-2" />
              Issued Certificates ({issuedCertificates.length})
            </button>
            <button
              onClick={() => setActiveTab('builder')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'builder'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
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
      <Modal
        open={showBulkGenerateModal}
        onClose={handleCloseBulkGenerate}
        title="Bulk Generate Certificates"
        size="lg"
        footer={
          <>
            <span className="mr-auto text-sm text-on-surface-variant">
              {selectedRegistrations.size > 0 && (
                <span>{selectedRegistrations.size} attendee(s) selected</span>
              )}
            </span>
            <Button
              variant="outlined"
              onClick={handleCloseBulkGenerate}
              disabled={bulkGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkGenerate}
              loading={bulkGenerating}
              disabled={selectedRegistrations.size === 0 || !templates.some(t => t.eventId === bulkGenerateEventId && t.isActive)}
              icon={!bulkGenerating && <SparklesIcon className="h-5 w-5" />}
            >
              {bulkGenerating ? 'Generating...' : 'Generate Certificates'}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-on-surface-variant">
          Generate certificates for multiple attendees at once
        </p>

        {/* Event Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-on-surface-variant mb-2">
            Select Event *
          </label>
          <select
            value={bulkGenerateEventId}
            onChange={(e) => {
              setBulkGenerateEventId(e.target.value);
              handleLoadRegistrations(e.target.value);
            }}
            disabled={bulkGenerating}
            className="w-full px-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-surface-container"
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
            <p className="mt-2 text-sm text-error flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              This event has no active certificate template. Please create one first.
            </p>
          )}
        </div>

        {/* Filter Tabs */}
        {bulkGenerateEventId && registrations.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2 border-b border-outline-variant">
              <button
                onClick={() => setBulkGenerateFilter('all')}
                disabled={bulkGenerating}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  bulkGenerateFilter === 'all'
                    ? 'text-success border-b-2 border-success'
                    : 'text-on-surface-variant hover:text-on-surface-variant'
                }`}
              >
                All ({registrations.length})
              </button>
              <button
                onClick={() => setBulkGenerateFilter('attended')}
                disabled={bulkGenerating}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  bulkGenerateFilter === 'attended'
                    ? 'text-success border-b-2 border-success'
                    : 'text-on-surface-variant hover:text-on-surface-variant'
                }`}
              >
                Attended ({getAttendedCount()})
              </button>
              <button
                onClick={() => setBulkGenerateFilter('no-certificate')}
                disabled={bulkGenerating}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  bulkGenerateFilter === 'no-certificate'
                    ? 'text-success border-b-2 border-success'
                    : 'text-on-surface-variant hover:text-on-surface-variant'
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
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={attendeeSearchTerm}
                onChange={(e) => setAttendeeSearchTerm(e.target.value)}
                disabled={bulkGenerating}
                className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-surface-container"
              />
            </div>
                    
            {/* Quick Selection Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllRegistrations}
                disabled={bulkGenerating || getFilteredRegistrations().length === 0}
                className="px-3 py-2 text-sm bg-surface-container text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select All
              </button>
              <button
                onClick={handleClearSelection}
                disabled={bulkGenerating || selectedRegistrations.size === 0}
                className="px-3 py-2 text-sm bg-surface-container text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                onClick={handleInvertSelection}
                disabled={bulkGenerating || getFilteredRegistrations().length === 0}
                className="px-3 py-2 text-sm bg-surface-container text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Invert
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {bulkGenerating && (
          <div className="mb-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-success">
                Generating certificates...
              </span>
              <span className="text-sm text-success">
                {bulkGenerateProgress.current} / {bulkGenerateProgress.total}
              </span>
            </div>
            <ProgressBar
              value={bulkGenerateProgress.total > 0
                ? (bulkGenerateProgress.current / bulkGenerateProgress.total) * 100
                : 0}
              size="md"
              color="bg-success"
              label="Bulk certificate generation progress"
              showValue
            />
          </div>
        )}

        {/* Registrations Table */}
        {loadingRegistrations ? (
          <div className="flex justify-center items-center py-12">
            <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-success"></div>
          </div>
        ) : bulkGenerateEventId && getFilteredRegistrations().length === 0 ? (
          <div className="text-center py-12">
            <UserGroupIcon className="w-12 h-12 mx-auto text-on-surface-variant mb-3" />
            <p className="text-on-surface-variant">No attendees found matching the selected filter.</p>
          </div>
        ) : bulkGenerateEventId && getFilteredRegistrations().length > 0 ? (
          <div className="border border-outline-variant rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedRegistrations.size === getFilteredRegistrations().length && getFilteredRegistrations().length > 0}
                      onChange={handleSelectAllRegistrations}
                      disabled={bulkGenerating}
                      className="w-4 h-4 text-success border-outline-variant rounded focus:ring-primary"
                      aria-label="Select all attendees"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant uppercase">Attendance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant uppercase">Certificate</th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-outline-variant">
                {getFilteredRegistrations().map(reg => (
                  <tr 
                    key={reg.id}
                    onClick={() => !bulkGenerating && handleSelectRegistration(reg.id)}
                    className={`cursor-pointer transition-colors ${selectedRegistrations.has(reg.id) ? 'bg-surface-container-low hover:bg-surface-container-high' : 'hover:bg-surface-container-low'}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRegistrations.has(reg.id)}
                        onChange={() => handleSelectRegistration(reg.id)}
                        disabled={bulkGenerating}
                        className="w-4 h-4 text-success border-outline-variant rounded focus:ring-primary"
                        aria-label={`Select ${getFullNameFromRegistration(reg) || reg.userDetails?.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-on-surface">
                      {getFullNameFromRegistration(reg) || reg.userDetails?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">
                      {reg.userDetails?.email || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-sm font-medium rounded-full ${
                        reg.attendanceStatus === 'checked-in'
                          ? 'bg-surface-container-high text-success'
                          : reg.attendanceStatus === 'registered' || reg.attendanceStatus === 'pending'
                          ? 'bg-surface-container-high text-primary'
                          : 'bg-surface-container text-on-surface'
                      }`}>
                        {reg.attendanceStatus === 'checked-in' ? 'Checked In' : (reg.attendanceStatus || 'Registered')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasIssuedCertificate(reg) ? (
                        <span className="inline-flex items-center gap-1 text-success text-sm">
                          <CheckCircleIcon className="w-4 h-4" />
                          Issued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-on-surface-variant text-sm">
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
      </Modal>

      {/* Regenerate with Template Warning Modal */}
      <Modal
        open={showRegenerateWarningModal}
        onClose={() => !isRegenerating && setShowRegenerateWarningModal(false)}
        title="Regenerate Certificates"
        size="md"
        closeOnBackdrop={!isRegenerating}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => setShowRegenerateWarningModal(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateWithTemplate}
              loading={isRegenerating}
              icon={!isRegenerating && <ArrowPathIcon className="h-5 w-5" />}
            >
              {isRegenerating
                ? 'Regenerating...'
                : `Regenerate ${selectedCertificates.size} Certificate(s)`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            This action will overwrite existing certificates
          </p>
          <div className="p-4 bg-surface-container border border-outline-variant rounded-lg">
            <h3 className="font-medium text-on-surface mb-2">⚠️ Warning</h3>
            <ul className="text-sm text-on-surface-variant space-y-1 list-disc list-inside">
              <li>This will regenerate <strong>{selectedCertificates.size}</strong> certificate(s) using the <strong>current template</strong></li>
              <li>The previous certificate images will be <strong>overwritten</strong></li>
              <li>Verification codes will remain the same</li>
              <li>This action <strong>cannot be undone</strong></li>
            </ul>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              Reason for regeneration (optional)
            </label>
            <select
              value={regenerateReason}
              onChange={(e) => setRegenerateReason(e.target.value as typeof regenerateReason)}
              disabled={isRegenerating}
              className="w-full px-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-surface-container"
            >
              <option value="">Select a reason...</option>
              <option value="template_fix">Template was updated/fixed</option>
              <option value="name_fix">Name correction needed</option>
            </select>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg">
            <p className="text-sm text-primary">
              <strong>When to use:</strong> Use this when the certificate template had visual issues 
              (wrong logo, incorrect text, design problems) that have been fixed and you need to 
              regenerate certificates with the corrected template.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {isRegenerating && (
          <div className="mt-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-success">
                Regenerating certificates...
              </span>
              <span className="text-sm text-success">
                {regenerateProgress.current} / {regenerateProgress.total}
              </span>
            </div>
            <ProgressBar
              value={regenerateProgress.total > 0
                ? (regenerateProgress.current / regenerateProgress.total) * 100
                : 0}
              size="md"
              color="bg-success"
              label="Certificate regeneration progress"
              showValue
            />
          </div>
        )}
      </Modal>
    </>
  );

  if (embedded) {
    return certContent;
  }

  return (
    <LayoutComponent subtitle="Create templates and manage issued certificates">
      {certContent}
    </LayoutComponent>
  );
};

export default CertificatesPage;
