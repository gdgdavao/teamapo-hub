import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  CalendarDaysIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { PromoCode, TicketType } from '../../../types';

interface PromoCodeManagerProps {
  eventId: string;
  promoCodes: PromoCode[];
  ticketTypes: TicketType[];
  onCreatePromoCode: (promoCode: Omit<PromoCode, 'id' | 'currentUses' | 'createdAt' | 'updatedAt'>) => void;
  onUpdatePromoCode: (id: string, promoCode: Partial<PromoCode>) => void;
  onDeletePromoCode: (id: string) => void;
  className?: string;
}

interface PromoCodeFormData {
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency: string;
  maxUses?: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  applicableTicketTypes: string[];
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}

const PromoCodeManager: React.FC<PromoCodeManagerProps> = ({
  eventId,
  promoCodes,
  ticketTypes,
  onCreatePromoCode,
  onUpdatePromoCode,
  onDeletePromoCode,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const toLocalDateTimeInput = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    currency: 'PHP',
    maxUses: undefined,
    isActive: true,
    validFrom: toLocalDateTimeInput(new Date()),
    validUntil: toLocalDateTimeInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    applicableTicketTypes: [],
    minOrderAmount: undefined,
    maxDiscountAmount: undefined
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      currency: 'PHP',
      maxUses: undefined,
      isActive: true,
      validFrom: toLocalDateTimeInput(new Date()),
      validUntil: toLocalDateTimeInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      applicableTicketTypes: [],
      minOrderAmount: undefined,
      maxDiscountAmount: undefined
    });
    setEditingPromoCode(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Helper function to safely convert Firestore timestamps to Date objects
  const convertTimestampToDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp object
      return timestamp.toDate();
    } else if (timestamp?.seconds && typeof timestamp.seconds === 'number') {
      // Firestore timestamp as plain object (from Firestore emulator or client)
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      // Regular Date object
      return timestamp;
    } else if (typeof timestamp === 'string') {
      // Date string
      return new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      return new Date(timestamp);
    } else {
      // Try to create a Date object
      return new Date(timestamp);
    }
  };

  const openEditModal = (promoCode: PromoCode) => {
    setEditingPromoCode(promoCode);
    setFormData({
      code: promoCode.code,
      name: promoCode.name,
      description: promoCode.description || '',
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      currency: promoCode.currency || 'PHP',
      maxUses: promoCode.maxUses,
      isActive: promoCode.isActive,
      validFrom: toLocalDateTimeInput(convertTimestampToDate(promoCode.validFrom)),
      validUntil: toLocalDateTimeInput(convertTimestampToDate(promoCode.validUntil)),
      applicableTicketTypes: promoCode.applicableTicketTypes || [],
      minOrderAmount: promoCode.minOrderAmount,
      maxDiscountAmount: promoCode.maxDiscountAmount
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPromoCode && formData.maxUses && formData.maxUses < editingPromoCode.currentUses) {
      toast.error(`Max uses cannot be less than the ${editingPromoCode.currentUses} claimed uses.`);
      return;
    }
    
    const promoCodeData = {
      ...formData,
      validFrom: new Date(formData.validFrom) as any,
      validUntil: new Date(formData.validUntil) as any,
      createdBy: 'current-user-id', // Replace with actual user ID
      applicableTicketTypes: formData.applicableTicketTypes.length > 0 ? formData.applicableTicketTypes : undefined
    };

    if (editingPromoCode) {
      onUpdatePromoCode(editingPromoCode.id, promoCodeData);
    } else {
      onCreatePromoCode(promoCodeData);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You might want to show a toast notification here
  };

  const handleMaxUsesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, valueAsNumber } = event.target;
    if (!value.length) {
      setFormData(prev => ({ ...prev, maxUses: undefined }));
      return;
    }

    if (!Number.isFinite(valueAsNumber)) {
      return;
    }

    const normalizedLimit = Math.max(1, Math.floor(valueAsNumber));
    setFormData(prev => ({ ...prev, maxUses: normalizedLimit }));
  };

  const getUsagePercentage = (promoCode: PromoCode): number => {
    if (!promoCode.maxUses) return 0;
    return (promoCode.currentUses / promoCode.maxUses) * 100;
  };

  const isExpired = (promoCode: PromoCode): boolean => {
    return new Date() > convertTimestampToDate(promoCode.validUntil);
  };

  const isNotYetActive = (promoCode: PromoCode): boolean => {
    return new Date() < convertTimestampToDate(promoCode.validFrom);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Promo Codes</h2>
          <p className="text-gray-600">Manage discount codes for your event</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create Promo Code</span>
        </button>
      </div>

      {/* Promo Codes List */}
      <div className="grid grid-cols-1 gap-6">
        {promoCodes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <TagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No promo codes yet</h3>
            <p className="text-gray-600 mb-4">Create your first promo code to offer discounts to attendees</p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Promo Code
            </button>
          </div>
        ) : (
          promoCodes.map((promoCode) => (
            <div key={promoCode.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-lg font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded">
                        {promoCode.code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(promoCode.code)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Copy code"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {promoCode.isActive ? (
                        isExpired(promoCode) ? (
                          <span className="flex items-center space-x-1 text-red-600 text-sm">
                            <XCircleIcon className="w-4 h-4" />
                            <span>Expired</span>
                          </span>
                        ) : isNotYetActive(promoCode) ? (
                          <span className="flex items-center space-x-1 text-yellow-600 text-sm">
                            <CalendarDaysIcon className="w-4 h-4" />
                            <span>Scheduled</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-green-600 text-sm">
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>Active</span>
                          </span>
                        )
                      ) : (
                        <span className="flex items-center space-x-1 text-gray-500 text-sm">
                          <XCircleIcon className="w-4 h-4" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900">{promoCode.name}</h3>
                  {promoCode.description && (
                    <p className="text-gray-600 mt-1">{promoCode.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Discount:</span>
                      <div className="font-medium">
                        {promoCode.discountType === 'percentage' 
                          ? `${promoCode.discountValue}%`
                          : `₱${promoCode.discountValue.toLocaleString()}`
                        }
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Usage:</span>
                      <div className="font-medium">
                        {promoCode.currentUses}
                        {promoCode.maxUses ? ` / ${promoCode.maxUses}` : ' / ∞'}
                      </div>
                      {promoCode.maxUses && (
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full" 
                            style={{ width: `${Math.min(100, getUsagePercentage(promoCode))}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Valid From:</span>
                      <div className="font-medium">
                        {convertTimestampToDate(promoCode.validFrom).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Valid Until:</span>
                      <div className="font-medium">
                        {convertTimestampToDate(promoCode.validUntil).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {promoCode.applicableTicketTypes && promoCode.applicableTicketTypes.length > 0 && (
                    <div className="mt-3">
                      <span className="text-gray-500 text-sm">Applicable to:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {promoCode.applicableTicketTypes.map(ticketTypeId => {
                          const ticketType = ticketTypes.find(t => t.id === ticketTypeId);
                          return ticketType ? (
                            <span key={ticketTypeId} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {ticketType.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => openEditModal(promoCode)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Edit promo code"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeletePromoCode(promoCode.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete promo code"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-gray-900">
                  {editingPromoCode ? 'Edit Promo Code' : 'Create Promo Code'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Code *
                      </label>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          value={formData.code}
                          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                          placeholder="SAVE10"
                          required
                        />
                        <button
                          type="button"
                          onClick={generateRandomCode}
                          className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          Generate
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Early Bird Special"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Special discount for early registrations"
                      />
                    </div>
                  </div>
                </div>

                {/* Discount Configuration */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Discount Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Type *
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Value *
                      </label>
                      <div className="relative">
                        {formData.discountType === 'fixed' && (
                          <span className="absolute left-4 top-3 text-gray-500">₱</span>
                        )}
                        <input
                          type="number"
                          value={formData.discountValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                          className={`w-full ${formData.discountType === 'fixed' ? 'pl-8 pr-4' : 'px-4'} py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                          min="0"
                          step={formData.discountType === 'percentage' ? '1' : '0.01'}
                          max={formData.discountType === 'percentage' ? '100' : undefined}
                          required
                        />
                        {formData.discountType === 'percentage' && (
                          <span className="absolute right-4 top-3 text-gray-500">%</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Uses
                      </label>
                      <input
                        type="number"
                        value={formData.maxUses ?? ''}
                        onChange={handleMaxUsesChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                        placeholder="Unlimited"
                      />
                    </div>

                    {formData.discountType === 'percentage' && (
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Discount Amount (₱)
                        </label>
                        <input
                          type="number"
                          value={formData.maxDiscountAmount || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                          className="w-full max-w-xs px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                          placeholder="No limit"
                        />
                        <p className="text-sm text-gray-500 mt-1">Cap the maximum discount amount for percentage-based discounts</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Validity Period */}
                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Validity Period</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valid From *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.validFrom}
                        onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valid Until *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.validUntil}
                        onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Type Restrictions */}
                <div className="bg-orange-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Ticket Type Restrictions</h4>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Choose which ticket types this promo code can be applied to:</p>
                    <div className="space-y-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-white">
                      <label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.applicableTicketTypes.length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, applicableTicketTypes: [] }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-900">All ticket types</span>
                      </label>
                      {ticketTypes.map(ticketType => (
                        <label key={ticketType.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.applicableTicketTypes.includes(ticketType.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  applicableTicketTypes: [...prev.applicableTicketTypes, ticketType.id]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  applicableTicketTypes: prev.applicableTicketTypes.filter(id => id !== ticketType.id)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{ticketType.name}</span>
                            <div className="text-xs text-gray-500">₱{ticketType.price.toLocaleString()}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Status</h4>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-900">
                      Active (users can apply this promo code)
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Inactive promo codes cannot be used by attendees but remain in your list for future activation.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    {editingPromoCode ? 'Update' : 'Create'} Promo Code
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoCodeManager;
