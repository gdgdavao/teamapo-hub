import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import {
  ProgressBar,
  Button,
  Modal,
  Select,
  Input,
  Textarea,
  Card,
  Badge,
  EmptyState,
  type BadgeTone
} from '../../../components/UI';
import { PromoCode, TicketType } from '../../../types';
import { toDateSafe } from '../../../utils/dateUtils';

interface PromoCodeManagerProps {
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

  const convertTimestampToDate = (timestamp: any): Date => {
    return toDateSafe(timestamp) ?? new Date();
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
      createdBy: 'current-user-id',
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
    void navigator.clipboard.writeText(text);
    toast.success(`Copied code "${text}" to clipboard`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-on-surface">Promo Codes</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">Manage discount codes for your event</p>
        </div>
        <Button
          variant="filled"
          icon={<PlusIcon className="w-4 h-4" />}
          onClick={openCreateModal}
        >
          Create Promo Code
        </Button>
      </div>

      {/* Promo Codes List */}
      <div className="space-y-4">
        {promoCodes.length === 0 ? (
          <Card padding="none">
            <div className="py-8 px-4 sm:px-6">
              <EmptyState
                icon={<TagIcon className="w-10 h-10 text-outline-variant" />}
                title="No promo codes yet"
                description="Create your first promo code to offer discounts to attendees."
                action={
                  <Button
                    variant="filled"
                    icon={<PlusIcon className="w-4 h-4" />}
                    onClick={openCreateModal}
                  >
                    Create Promo Code
                  </Button>
                }
              />
            </div>
          </Card>
        ) : (
          promoCodes.map((promoCode) => {
            const expired = isExpired(promoCode);
            const notYetActive = isNotYetActive(promoCode);
            const statusTone: BadgeTone = !promoCode.isActive
              ? 'neutral'
              : expired
              ? 'danger'
              : notYetActive
              ? 'warning'
              : 'success';
            const statusLabel = !promoCode.isActive
              ? 'Inactive'
              : expired
              ? 'Expired'
              : notYetActive
              ? 'Scheduled'
              : 'Active';

            return (
              <Card key={promoCode.id} padding="none" className="p-4 sm:p-5 relative transition-[border-color,background-color] duration-fast ease-quart">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-1.5 bg-secondary-container text-primary font-mono text-base sm:text-lg font-bold px-3 py-1 rounded-lg">
                        <span>{promoCode.code}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(promoCode.code)}
                          className="p-1.5 rounded-md text-primary/70 hover:text-primary hover:bg-primary-container/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[48px] min-w-[48px] flex items-center justify-center"
                          title="Copy code"
                          aria-label={`Copy code ${promoCode.code}`}
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <Badge tone={statusTone}>{statusLabel}</Badge>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-on-surface">{promoCode.name}</h3>
                      {promoCode.description && (
                        <p className="text-sm text-on-surface-variant mt-0.5">{promoCode.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1 text-sm">
                      <div>
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Discount</span>
                        <div className="font-semibold text-on-surface mt-0.5">
                          {promoCode.discountType === 'percentage'
                            ? `${promoCode.discountValue}%`
                            : `₱${promoCode.discountValue.toLocaleString()}`
                          }
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Usage</span>
                        <div className="font-semibold text-on-surface mt-0.5">
                          {promoCode.currentUses}
                          {promoCode.maxUses ? ` / ${promoCode.maxUses}` : ' / ∞'}
                        </div>
                        {promoCode.maxUses && (
                          <ProgressBar
                            value={Math.min(100, getUsagePercentage(promoCode))}
                            size="xs"
                            color="bg-primary"
                            label={`Redemptions used for ${promoCode.code}`}
                            className="mt-1.5"
                          />
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Valid From</span>
                        <div className="font-medium text-on-surface mt-0.5">
                          {convertTimestampToDate(promoCode.validFrom).toLocaleDateString()}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Valid Until</span>
                        <div className="font-medium text-on-surface mt-0.5">
                          {convertTimestampToDate(promoCode.validUntil).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {promoCode.applicableTicketTypes && promoCode.applicableTicketTypes.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Applicable to:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {promoCode.applicableTicketTypes.map(ticketTypeId => {
                            const ticketType = ticketTypes.find(t => t.id === ticketTypeId);
                            return ticketType ? (
                              <span key={ticketTypeId} className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant text-xs rounded-md font-medium">
                                {ticketType.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:self-start border-t sm:border-t-0 pt-3 sm:pt-0 border-outline-variant/60">
                    <button
                      type="button"
                      onClick={() => openEditModal(promoCode)}
                      className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Edit promo code"
                      aria-label={`Edit ${promoCode.name}`}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePromoCode(promoCode.id)}
                      className="p-2.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                      title="Delete promo code"
                      aria-label={`Delete ${promoCode.name}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPromoCode ? 'Edit Promo Code' : 'Create Promo Code'}
        size="lg"
        footer={
          <>
            <Button variant="outlined" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="promo-code-form">
              {editingPromoCode ? 'Update Promo Code' : 'Create Promo Code'}
            </Button>
          </>
        }
      >
        <form id="promo-code-form" onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Code & Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                Code <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="md-field font-mono text-base uppercase flex-1 h-11"
                  placeholder="SAVE10"
                  required
                />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={generateRandomCode}
                  className="shrink-0 h-11"
                >
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <Input
                label="Name"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Early Bird Special"
              />
            </div>

            <div className="md:col-span-2">
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Special discount for early registrations"
                rows={2}
              />
            </div>
          </div>

          {/* Discount & Max Uses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-outline-variant/60 pt-5">
            <Select
              label="Discount Type"
              required
              value={formData.discountType}
              onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₱)</option>
            </Select>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                Discount Value <span className="text-error">*</span>
              </label>
              <div className="relative">
                {formData.discountType === 'fixed' && (
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">₱</span>
                )}
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                  className={`md-field w-full h-11 ${formData.discountType === 'fixed' ? 'pl-8' : ''} ${formData.discountType === 'percentage' ? 'pr-8' : ''}`}
                  min="0"
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  max={formData.discountType === 'percentage' ? '100' : undefined}
                  required
                />
                {formData.discountType === 'percentage' && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">%</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                Max Uses
              </label>
              <input
                type="number"
                value={formData.maxUses ?? ''}
                onChange={handleMaxUsesChange}
                className="md-field w-full h-11"
                min="1"
                placeholder="Unlimited"
              />
            </div>

            {formData.discountType === 'percentage' && (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-on-surface mb-1.5">
                  Max Discount Cap (₱)
                </label>
                <input
                  type="number"
                  value={formData.maxDiscountAmount ?? ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="md-field w-full max-w-xs h-11"
                  min="0"
                  step="0.01"
                  placeholder="No limit"
                />
                <p className="text-xs text-on-surface-variant mt-1">Cap the maximum discount amount for percentage-based discounts</p>
              </div>
            )}
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-outline-variant/60 pt-5">
            <Input
              label="Valid From"
              type="datetime-local"
              required
              value={formData.validFrom}
              onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
            />

            <Input
              label="Valid Until"
              type="datetime-local"
              required
              value={formData.validUntil}
              onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
            />
          </div>

          {/* Ticket Type Restrictions */}
          <div className="border-t border-outline-variant/60 pt-5 space-y-2">
            <label className="block text-sm font-medium text-on-surface">Ticket Type Restrictions</label>
            <p className="text-xs text-on-surface-variant">Choose which tickets can redeem this promo code:</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border border-outline-variant rounded-xl p-2.5 sm:p-3 bg-surface-container-low">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container transition-colors min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.applicableTicketTypes.length === 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, applicableTicketTypes: [] }));
                    }
                  }}
                  className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm font-medium text-on-surface">All ticket types</span>
              </label>
              {ticketTypes.map(ticketType => (
                <label key={ticketType.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container transition-colors min-h-[44px] cursor-pointer">
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
                    className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="flex-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-on-surface">{ticketType.name}</span>
                    <span className="text-on-surface-variant font-mono">₱{ticketType.price.toLocaleString()}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="border-t border-outline-variant/60 pt-5">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-outline-variant/60 bg-surface-container-low cursor-pointer">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded border-outline-variant text-primary focus:ring-primary h-5 w-5 mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-on-surface">Active (attendees can apply this code)</span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Inactive promo codes cannot be applied during checkout.
                </p>
              </div>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PromoCodeManager;
