import React, { useEffect, useMemo, useRef, useState } from 'react';
import Loader from '../components/Loader';
import StatCard from '../admin/components/StatCard';
import ConfirmDialog from '../admin/components/ConfirmDialog';
import { useToast } from '../admin/components/Toast';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';
import RestaurantEngagementTab from './RestaurantEngagementTab';
import {
  createLoyaltyCustomer,
  deleteLoyaltyCustomer,
  getLoyaltyCustomer,
  getLoyaltyCustomers,
  getLoyaltyPrograms,
  getLoyaltyStats,
  sendLoyaltyWhatsappOffer,
  updateLoyaltyCustomer,
  updateLoyaltyProgram,
} from '../services/loyaltyApi';

const CUSTOMER_FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['opted_in', 'WhatsApp Opted In'],
  ['opted_out', 'WhatsApp Opted Out'],
];

const CUSTOMER_SORTS = [
  ['recent', 'Recently Added'],
  ['name', 'Name'],
  ['offers', 'Most Offers Sent'],
  ['last_offer', 'Last Offer Sent'],
];

const INITIAL_CONTACT = {
  name: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  notes: '',
  marketingConsent: false,
};

const INITIAL_OFFER = {
  offerType: 'COUPON',
  title: '',
  couponCode: '',
  discountPercent: '',
  minimumOrderValue: '',
  offerDescription: '',
  message: '',
  expiresAt: '',
};

export default function RestaurantLoyaltyPage() {
  const { user, permissions } = useRestaurantAuth();
  const { push } = useToast();
  const [view, setView] = useState('engagement');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [contactModal, setContactModal] = useState({ open: false, mode: 'create', customer: null });
  const [contactForm, setContactForm] = useState(INITIAL_CONTACT);
  const [contactSaving, setContactSaving] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, loading: false, customer: null });
  const [offerModal, setOfferModal] = useState({ open: false, customer: null });
  const [offerForm, setOfferForm] = useState(INITIAL_OFFER);
  const [offerSending, setOfferSending] = useState(false);
  const [programModal, setProgramModal] = useState({ open: false, program: null });
  const [programForm, setProgramForm] = useState({});
  const [programSaving, setProgramSaving] = useState(false);
  const [togglingPrograms, setTogglingPrograms] = useState(() => new Set());
  const togglingRef = useRef(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (view !== 'customers') return undefined;
    let alive = true;
    (async () => {
      setStatsLoading(true);
      try {
        const data = await getLoyaltyStats();
        if (alive) setStats(data);
      } catch (err) {
        if (alive) push(err.message || 'Failed to load loyalty stats.', 'error');
      } finally {
        if (alive) setStatsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [view, push]);

  useEffect(() => {
    if (view !== 'customers') return undefined;
    loadCustomers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search, filter, sort]);

  useEffect(() => {
    if (view !== 'programs') return undefined;
    let alive = true;
    (async () => {
      setProgramsLoading(true);
      try {
        const data = await getLoyaltyPrograms();
        if (alive) setPrograms(data.items || []);
      } catch (err) {
        if (alive) push(err.message || 'Failed to load loyalty programs.', 'error');
      } finally {
        if (alive) setProgramsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [view, push]);

  async function loadCustomers(nextPage = pageInfo.page || 1) {
    setListLoading(true);
    try {
      const data = await getLoyaltyCustomers({
        page: nextPage,
        limit: pageInfo.limit,
        search,
        filter,
        sort,
      });
      setCustomers(data.items || []);
      setPageInfo({
        page: data.page || 1,
        limit: data.limit || 20,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      });
    } catch (err) {
      push(err.message || 'Failed to load customers.', 'error');
    } finally {
      setListLoading(false);
    }
  }

  const statsCards = useMemo(
    () => [
      ['Total Customers', stats?.totalCustomers ?? 0],
      ['Active Customers', stats?.activeCustomers ?? 0],
      ['Customers Added This Month', stats?.customersAddedThisMonth ?? 0],
      ['Offers Sent', stats?.offersSent ?? 0],
    ],
    [stats],
  );

  function openCreateModal() {
    setContactForm(INITIAL_CONTACT);
    setContactModal({ open: true, mode: 'create', customer: null });
  }

  function openEditModal(customer) {
    setContactForm({
      name: customer.name || '',
      phone: customer.phone || '',
      whatsappPhone: customer.whatsappPhone || '',
      email: customer.email || '',
      notes: customer.notes || '',
      marketingConsent: customer.marketingConsent === true,
    });
    setContactModal({ open: true, mode: 'edit', customer });
  }

  async function onSaveContact(e) {
    e.preventDefault();
    setContactSaving(true);
    try {
      const payload = {
        name: contactForm.name,
        phone: contactForm.phone,
        whatsappPhone: contactForm.whatsappPhone || undefined,
        email: contactForm.email || undefined,
        notes: contactForm.notes || undefined,
        marketingConsent: contactForm.marketingConsent === true,
      };
      if (contactModal.mode === 'edit' && contactModal.customer?.id) {
        await updateLoyaltyCustomer(contactModal.customer.id, payload);
        push('Customer contact updated successfully.');
      } else {
        await createLoyaltyCustomer(payload);
        push('Customer contact added successfully.');
      }
      setContactModal({ open: false, mode: 'create', customer: null });
      if (detailModal.customer?.id === contactModal.customer?.id) {
        openCustomerDetail(contactModal.customer.id);
      }
      await Promise.all([loadCustomers(pageInfo.page), refreshStats()]);
    } catch (err) {
      push(err.message || 'Could not save customer contact.', 'error');
    } finally {
      setContactSaving(false);
    }
  }

  async function refreshStats() {
    const data = await getLoyaltyStats();
    setStats(data);
  }

  async function openCustomerDetail(id) {
    setDetailModal({ open: true, loading: true, customer: null });
    try {
      const data = await getLoyaltyCustomer(id);
      setDetailModal({ open: true, loading: false, customer: data });
    } catch (err) {
      setDetailModal({ open: false, loading: false, customer: null });
      push(err.message || 'Could not load customer.', 'error');
    }
  }

  async function onDeleteCustomer() {
    if (!confirmDelete?.id) return;
    try {
      await deleteLoyaltyCustomer(confirmDelete.id);
      push('Customer deleted successfully.');
      setConfirmDelete(null);
      setDetailModal({ open: false, loading: false, customer: null });
      await Promise.all([loadCustomers(1), refreshStats()]);
    } catch (err) {
      push(err.message || 'Could not delete customer.', 'error');
    }
  }

  async function onSendOffer(e) {
    e.preventDefault();
    if (!offerModal.customer?.id) return;
    setOfferSending(true);
    try {
      const payload = {
        ...offerForm,
        discountPercent:
          offerForm.discountPercent !== '' ? Number(offerForm.discountPercent) : undefined,
        minimumOrderValue:
          offerForm.minimumOrderValue !== '' ? Number(offerForm.minimumOrderValue) : undefined,
        expiresAt: offerForm.expiresAt || undefined,
      };
      const result = await sendLoyaltyWhatsappOffer(offerModal.customer.id, payload);
      push(
        result.status === 'FAILED'
          ? result.message || 'WhatsApp send failed.'
          : 'WhatsApp offer sent successfully.',
        result.status === 'FAILED' ? 'error' : 'success',
      );
      setOfferModal({ open: false, customer: null });
      setOfferForm(INITIAL_OFFER);
      await Promise.all([
        loadCustomers(pageInfo.page),
        refreshStats(),
        openCustomerDetail(offerModal.customer.id),
      ]);
    } catch (err) {
      push(err.message || 'Could not send WhatsApp offer.', 'error');
    } finally {
      setOfferSending(false);
    }
  }

  async function onToggleProgram(program, enabled) {
    if (!permissions?.manageLoyaltyPrograms) return;
    const key = program.programType;
    if (togglingRef.current.has(key)) return;
    togglingRef.current.add(key);
    setTogglingPrograms(new Set(togglingRef.current));
    try {
      const updated = await updateLoyaltyProgram(key, {
        enabled,
        configuration: program.configuration || {},
      });
      push(`${program.title} ${enabled ? 'enabled' : 'disabled'}.`);
      setPrograms((current) =>
        current.map((item) =>
          item.programType === key
            ? {
                ...item,
                enabled: updated.enabled,
                configuration: updated.configuration ?? item.configuration,
              }
            : item,
        ),
      );
    } catch (err) {
      push(err.message || `Unable to update ${program.title}. Please try again.`, 'error');
    } finally {
      togglingRef.current.delete(key);
      setTogglingPrograms(new Set(togglingRef.current));
    }
  }

  async function onSaveProgram(e) {
    e.preventDefault();
    if (!programModal.program) return;
    setProgramSaving(true);
    try {
      const updated = await updateLoyaltyProgram(programModal.program.programType, {
        enabled: programModal.program.enabled,
        configuration: normalizeProgramConfig(programModal.program.programType, programForm),
      });
      push(`${programModal.program.title} configuration saved.`);
      setProgramModal({ open: false, program: null });
      setPrograms((current) =>
        current.map((item) =>
          item.programType === updated.programType
            ? {
                ...item,
                enabled: updated.enabled,
                configuration: updated.configuration ?? item.configuration,
              }
            : item,
        ),
      );
    } catch (err) {
      push(err.message || 'Could not save loyalty program.', 'error');
    } finally {
      setProgramSaving(false);
    }
  }

  const offerPreview = buildOfferPreview(
    offerForm,
    offerModal.customer?.name || 'Customer',
    user?.restaurantName || 'Your Restaurant',
  );

  return (
    <div className="admin-page loyalty-page">
      <div className="admin-page-header">
        <div>
          <h1>Loyalty Program</h1>
          <p className="admin-muted">
            Customer engagement and offers. Reach diners on their device with push notifications and coupons.
          </p>
        </div>
      </div>

      <div className="loyalty-view-toggle" role="tablist" aria-label="Loyalty views">
        <button
          type="button"
          className={`loyalty-view-tab ${view === 'engagement' ? 'active' : ''}`}
          onClick={() => setView('engagement')}
        >
          Customer Engagement
        </button>
        <button
          type="button"
          className={`loyalty-view-tab ${view === 'customers' ? 'active' : ''}`}
          onClick={() => setView('customers')}
        >
          Saved contacts
        </button>
        <button
          type="button"
          className={`loyalty-view-tab ${view === 'programs' ? 'active' : ''}`}
          onClick={() => setView('programs')}
        >
          Loyalty Programs
        </button>
      </div>

      {view === 'engagement' ? (
        <RestaurantEngagementTab canSend={permissions?.sendLoyaltyOffers} />
      ) : null}

      {view === 'customers' ? (
        <>
          <div className="admin-stats-grid">
            {statsCards.map(([label, value]) => (
              <StatCard key={label} label={label} value={value} loading={statsLoading} />
            ))}
          </div>

          <section className="admin-panel">
            <div className="admin-page-header loyalty-sub-header">
              <div>
                <h2>Customers</h2>
                <p className="admin-muted">
                  Contacts and offer history for {user?.restaurantName}.
                </p>
              </div>
              {permissions?.manageLoyaltyCustomers ? (
                <button type="button" className="admin-btn admin-btn-primary" onClick={openCreateModal}>
                  + Add Contact
                </button>
              ) : null}
            </div>

            <div className="loyalty-toolbar">
              <label className="admin-field">
                <span>Search customers</span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by customer name, phone, or WhatsApp"
                />
              </label>
              <label className="admin-field">
                <span>Filter</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  {CUSTOMER_FILTERS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {CUSTOMER_SORTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {listLoading ? <Loader label="Loading loyalty customers…" /> : null}

            {!listLoading && customers.length === 0 ? (
              <div className="admin-empty">
                <h3>Loyalty Program has no customers yet.</h3>
                <p>
                  Add your first customer contact to start building your restaurant's
                  loyalty audience.
                </p>
                {permissions?.manageLoyaltyCustomers ? (
                  <button type="button" className="admin-btn admin-btn-primary" onClick={openCreateModal}>
                    + Add Contact
                  </button>
                ) : null}
              </div>
            ) : null}

            {!listLoading && customers.length > 0 ? (
              <>
                <div className="admin-table-wrap loyalty-table-desktop">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th>Phone Number</th>
                        <th>WhatsApp Status</th>
                        <th>Date Added</th>
                        <th>Offers Sent</th>
                        <th>Last Offer</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id}>
                          <td>
                            <strong>{customer.name}</strong>
                            {customer.email ? (
                              <div className="admin-cell-sub">{customer.email}</div>
                            ) : null}
                          </td>
                          <td>
                            <div>{customer.phone}</div>
                            <div className="admin-cell-sub">WhatsApp: {customer.whatsappPhone}</div>
                          </td>
                          <td>
                            <OptInBadge optedIn={customer.marketingConsent} />
                          </td>
                          <td>{formatDate(customer.createdAt)}</td>
                          <td>{customer.totalOffersSent}</td>
                          <td>{customer.lastOfferSentAt ? formatDateTime(customer.lastOfferSentAt) : '—'}</td>
                          <td>
                            <div className="admin-row-actions loyalty-actions">
                              <button type="button" className="admin-link-btn" onClick={() => openCustomerDetail(customer.id)}>
                                View
                              </button>
                              {permissions?.manageLoyaltyCustomers ? (
                                <button type="button" className="admin-link-btn" onClick={() => openEditModal(customer)}>
                                  Edit
                                </button>
                              ) : null}
                              {permissions?.sendLoyaltyOffers ? (
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => {
                                    setOfferModal({ open: true, customer });
                                    setOfferForm(INITIAL_OFFER);
                                  }}
                                >
                                  Send WhatsApp Offer
                                </button>
                              ) : null}
                              {permissions?.manageLoyaltyCustomers ? (
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => setConfirmDelete({ id: customer.id, name: customer.name })}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="loyalty-cards-mobile">
                  {customers.map((customer) => (
                    <div key={customer.id} className="admin-panel loyalty-customer-card">
                      <div className="loyalty-card-head">
                        <div>
                          <strong>{customer.name}</strong>
                          <div className="admin-cell-sub">{customer.phone}</div>
                        </div>
                        <OptInBadge optedIn={customer.marketingConsent} />
                      </div>
                      <div className="admin-muted">WhatsApp: {customer.whatsappPhone}</div>
                      <div className="admin-muted">Added: {formatDate(customer.createdAt)}</div>
                      <div className="admin-muted">Offers Sent: {customer.totalOffersSent}</div>
                      <div className="admin-row-actions loyalty-actions">
                        <button type="button" className="admin-link-btn" onClick={() => openCustomerDetail(customer.id)}>
                          View
                        </button>
                        {permissions?.manageLoyaltyCustomers ? (
                          <button type="button" className="admin-link-btn" onClick={() => openEditModal(customer)}>
                            Edit
                          </button>
                        ) : null}
                        {permissions?.sendLoyaltyOffers ? (
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => {
                              setOfferModal({ open: true, customer });
                              setOfferForm(INITIAL_OFFER);
                            }}
                          >
                            Send Offer
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="loyalty-pagination">
                  <span className="admin-muted">
                    Page {pageInfo.page} of {pageInfo.totalPages} · {pageInfo.total} customers
                  </span>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      disabled={pageInfo.page <= 1}
                      onClick={() => loadCustomers(pageInfo.page - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      disabled={pageInfo.page >= pageInfo.totalPages}
                      onClick={() => loadCustomers(pageInfo.page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : (
        <section className="admin-panel">
          {programsLoading ? <Loader label="Loading loyalty programs…" /> : null}
          {!programsLoading ? (
            <div className="loyalty-program-grid">
              <p className="admin-muted loyalty-program-count">
                Active programs: {programs.filter((program) => program.enabled).length}
              </p>
              {programs.map((program) => {
                const toggling = togglingPrograms.has(program.programType);
                return (
                <div key={program.id} className="loyalty-program-card">
                  <div className="loyalty-program-head">
                    <div>
                      <h3>{program.title}</h3>
                      <p className="admin-muted">{buildProgramSummary(program)}</p>
                    </div>
                    <button
                      type="button"
                      className={`loyalty-status-toggle ${program.enabled ? 'on' : 'off'}${toggling ? ' is-loading' : ''}`}
                      disabled={toggling || !permissions?.manageLoyaltyPrograms}
                      aria-pressed={program.enabled}
                      aria-busy={toggling}
                      aria-label={program.enabled ? `Disable ${program.title}` : `Enable ${program.title}`}
                      onClick={() => onToggleProgram(program, !program.enabled)}
                    >
                      {toggling ? (
                        <span className="dy-loader-spinner" aria-hidden="true" />
                      ) : program.enabled ? (
                        'On'
                      ) : (
                        'Off'
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => {
                      setProgramModal({ open: true, program });
                      setProgramForm(program.configuration || {});
                    }}
                    disabled={!permissions?.manageLoyaltyPrograms}
                  >
                    Configure
                  </button>
                </div>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      <ContactModal
        open={contactModal.open}
        mode={contactModal.mode}
        form={contactForm}
        saving={contactSaving}
        onChange={setContactForm}
        onClose={() => setContactModal({ open: false, mode: 'create', customer: null })}
        onSubmit={onSaveContact}
      />

      <CustomerDetailModal
        open={detailModal.open}
        loading={detailModal.loading}
        customer={detailModal.customer}
        canManage={permissions?.manageLoyaltyCustomers}
        canSend={permissions?.sendLoyaltyOffers}
        onClose={() => setDetailModal({ open: false, loading: false, customer: null })}
        onEdit={() => {
          if (detailModal.customer) openEditModal(detailModal.customer);
        }}
        onSend={() => {
          if (detailModal.customer) {
            setOfferModal({ open: true, customer: detailModal.customer });
            setOfferForm(INITIAL_OFFER);
          }
        }}
        onDelete={() =>
          detailModal.customer &&
          setConfirmDelete({ id: detailModal.customer.id, name: detailModal.customer.name })
        }
      />

      <OfferModal
        open={offerModal.open}
        form={offerForm}
        preview={offerPreview}
        customer={offerModal.customer}
        sending={offerSending}
        onChange={setOfferForm}
        onClose={() => {
          setOfferModal({ open: false, customer: null });
          setOfferForm(INITIAL_OFFER);
        }}
        onSubmit={onSendOffer}
      />

      <ProgramConfigModal
        open={programModal.open}
        program={programModal.program}
        form={programForm}
        saving={programSaving}
        onChange={setProgramForm}
        onClose={() => setProgramModal({ open: false, program: null })}
        onSubmit={onSaveProgram}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete Customer"
        message={
          confirmDelete
            ? `Delete ${confirmDelete.name} from your Loyalty Program? This will also remove the customer's stored offer history.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={onDeleteCustomer}
      />
    </div>
  );
}

function ContactModal({ open, mode, form, saving, onChange, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'edit' ? 'Edit Customer Contact' : 'Add Customer Contact'}</h3>
        <form onSubmit={onSubmit}>
          <div className="admin-form-grid">
            <Field label="Customer Name *">
              <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone Number *">
              <input value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp Number">
              <input
                value={form.whatsappPhone}
                onChange={(e) => onChange({ ...form, whatsappPhone: e.target.value })}
                placeholder="Optional if same as phone"
              />
            </Field>
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
                type="email"
              />
            </Field>
            <Field label="Notes" className="span-2">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <label className="loyalty-checkbox">
            <input
              type="checkbox"
              checked={form.marketingConsent}
              onChange={(e) => onChange({ ...form, marketingConsent: e.target.checked })}
            />
            <span>Customer has agreed to receive offers and updates on WhatsApp.</span>
          </label>
          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save Contact' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerDetailModal({
  open,
  loading,
  customer,
  canManage,
  canSend,
  onClose,
  onEdit,
  onSend,
  onDelete,
}) {
  if (!open) return null;
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal loyalty-detail-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Customer Details</h3>
        {loading ? <Loader variant="inline" label="Loading customer…" /> : null}
        {!loading && customer ? (
          <>
            <div className="loyalty-detail-grid">
              <Detail label="Customer Name" value={customer.name} />
              <Detail label="Phone" value={customer.phone} />
              <Detail label="WhatsApp" value={customer.whatsappPhone} />
              <Detail label="Email" value={customer.email || '—'} />
              <Detail label="Date Added" value={formatDateTime(customer.createdAt)} />
              <Detail
                label="Consent Status"
                value={customer.marketingConsent ? 'WhatsApp Opted In' : 'WhatsApp Opted Out'}
              />
              <Detail label="Offers Sent" value={String(customer.totalOffersSent || 0)} />
              <Detail
                label="Last Offer"
                value={customer.lastOfferSentAt ? formatDateTime(customer.lastOfferSentAt) : '—'}
              />
              <Detail label="Notes" value={customer.notes || '—'} full />
            </div>
            <div className="admin-row-actions loyalty-detail-actions">
              {canManage ? (
                <button type="button" className="admin-btn admin-btn-ghost" onClick={onEdit}>
                  Edit
                </button>
              ) : null}
              {canSend ? (
                <button type="button" className="admin-btn admin-btn-primary" onClick={onSend}>
                  Send WhatsApp Offer
                </button>
              ) : null}
              {canManage ? (
                <button type="button" className="admin-btn admin-btn-danger" onClick={onDelete}>
                  Delete
                </button>
              ) : null}
            </div>
            <section className="loyalty-history">
              <h4>Offer History</h4>
              {!customer.offers?.length ? (
                <p className="admin-muted">No offers have been sent to this customer yet.</p>
              ) : (
                <div className="loyalty-history-list">
                  {customer.offers.map((offer) => (
                    <div key={offer.id} className="loyalty-history-item">
                      <div className="loyalty-history-title">
                        <strong>{offer.title || offer.offerType}</strong>
                        <span>{offer.status}</span>
                      </div>
                      <p>{offer.message}</p>
                      <div className="admin-cell-sub">
                        {offer.sentAt ? formatDateTime(offer.sentAt) : formatDateTime(offer.createdAt)}
                        {offer.failureReason ? ` · ${offer.failureReason}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function OfferModal({ open, form, preview, customer, sending, onChange, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal loyalty-offer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Send WhatsApp Offer</h3>
        <p className="admin-muted">
          {customer?.name} · {customer?.whatsappPhone}
        </p>
        <form onSubmit={onSubmit}>
          <div className="admin-form-grid">
            <Field label="Offer Type">
              <select value={form.offerType} onChange={(e) => onChange({ ...INITIAL_OFFER, offerType: e.target.value })}>
                <option value="COUPON">Coupon</option>
                <option value="DISCOUNT">Discount</option>
                <option value="SPECIAL_OFFER">Special Offer</option>
                <option value="CUSTOM_MESSAGE">Custom Message</option>
              </select>
            </Field>
            <Field label="Offer Title">
              <input value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} />
            </Field>

            {form.offerType === 'COUPON' ? (
              <>
                <Field label="Coupon Code">
                  <input value={form.couponCode} onChange={(e) => onChange({ ...form, couponCode: e.target.value })} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" value={form.expiresAt} onChange={(e) => onChange({ ...form, expiresAt: e.target.value })} />
                </Field>
                <Field label="Offer Description" className="span-2">
                  <textarea rows={3} value={form.offerDescription} onChange={(e) => onChange({ ...form, offerDescription: e.target.value })} />
                </Field>
              </>
            ) : null}

            {form.offerType === 'DISCOUNT' ? (
              <>
                <Field label="Discount Percentage">
                  <input value={form.discountPercent} onChange={(e) => onChange({ ...form, discountPercent: e.target.value })} />
                </Field>
                <Field label="Minimum Order Value">
                  <input value={form.minimumOrderValue} onChange={(e) => onChange({ ...form, minimumOrderValue: e.target.value })} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" value={form.expiresAt} onChange={(e) => onChange({ ...form, expiresAt: e.target.value })} />
                </Field>
              </>
            ) : null}

            {form.offerType === 'SPECIAL_OFFER' ? (
              <>
                <Field label="Expiry Date">
                  <input type="date" value={form.expiresAt} onChange={(e) => onChange({ ...form, expiresAt: e.target.value })} />
                </Field>
                <Field label="Offer Description" className="span-2">
                  <textarea rows={3} value={form.offerDescription} onChange={(e) => onChange({ ...form, offerDescription: e.target.value })} />
                </Field>
              </>
            ) : null}

            {form.offerType === 'CUSTOM_MESSAGE' ? (
              <Field label="Message" className="span-2">
                <textarea rows={5} value={form.message} onChange={(e) => onChange({ ...form, message: e.target.value })} />
              </Field>
            ) : null}
          </div>

          <div className="loyalty-preview">
            <span className="admin-muted">Message Preview</span>
            <pre>{preview}</pre>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send WhatsApp Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgramConfigModal({ open, program, form, saving, onChange, onClose, onSubmit }) {
  if (!open || !program) return null;
  const fields = getProgramFields(program.programType);
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal loyalty-program-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{program.title}</h3>
        <p className="admin-muted">{program.summary}</p>
        <form onSubmit={onSubmit}>
          <div className="admin-form-grid">
            {fields.map((field) => (
              <Field key={field.key} label={field.label} className={field.className}>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={form[field.key] ?? ''}
                    onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={form[field.key] ?? ''}
                    onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`admin-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value, full = false }) {
  return (
    <div className={full ? 'span-2' : ''}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OptInBadge({ optedIn }) {
  return (
    <span className={`loyalty-opt-badge ${optedIn ? 'opted-in' : 'opted-out'}`}>
      {optedIn ? 'WhatsApp Opted In' : 'WhatsApp Opted Out'}
    </span>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function buildProgramSummary(program) {
  const config = program.configuration || {};
  const hiddenKeys = new Set(['linkedCouponId']);
  const entries = Object.entries(config).filter(
    ([key, value]) => !hiddenKeys.has(key) && value !== '' && value != null,
  );
  if (entries.length) {
    return entries.map(([key, value]) => `${startCase(key)}: ${value}`).join(' · ');
  }
  return program.summary || '';
}

function buildOfferPreview(form, customerName, restaurantName) {
  const expiryText = form.expiresAt
    ? new Date(form.expiresAt).toLocaleDateString('en-IN')
    : '';
  if (form.offerType === 'CUSTOM_MESSAGE') {
    return String(form.message || '')
      .replace(/\{\{\s*customerName\s*\}\}/g, customerName)
      .replace(/\{\{\s*restaurantName\s*\}\}/g, restaurantName)
      .replace(/\{\{\s*expiryDate\s*\}\}/g, expiryText)
      .trim();
  }
  if (form.offerType === 'COUPON') {
    return `Hi ${customerName}\n\n${form.offerDescription || 'Enjoy a special offer at our restaurant.'}\nUse coupon code: ${form.couponCode || 'SAVE20'}${expiryText ? `\nValid until: ${expiryText}.` : ''}\n\nThank you for choosing ${restaurantName}!`;
  }
  if (form.offerType === 'DISCOUNT') {
    return `Hi ${customerName}\n\nEnjoy ${form.discountPercent || 20}% OFF on your next order at ${restaurantName}.\nMinimum order value: Rs ${form.minimumOrderValue || 0}.${expiryText ? `\nValid until: ${expiryText}.` : ''}\n\nThank you for choosing ${restaurantName}!`;
  }
  return `Hi ${customerName}\n\n${form.offerDescription || 'Enjoy our special offer.'}${expiryText ? `\nValid until: ${expiryText}.` : ''}\n\nThank you for choosing ${restaurantName}!`;
}

function getProgramFields(programType) {
  const map = {
    POINTS: [
      { key: 'pointsPerRupee', label: 'Points earned per Rs 1', type: 'number' },
      { key: 'redemptionPoints', label: 'Redemption points', type: 'number' },
      { key: 'redemptionValue', label: 'Redemption value', type: 'number' },
    ],
    STAMP_CARD: [
      { key: 'stampsRequired', label: 'Stamps required', type: 'number' },
      { key: 'rewardType', label: 'Reward type' },
      { key: 'rewardDescription', label: 'Reward description', className: 'span-2' },
    ],
    MEMBERSHIP_TIERS: [
      { key: 'bronzeThreshold', label: 'Bronze threshold', type: 'number' },
      { key: 'bronzeDiscount', label: 'Bronze discount (%)', type: 'number' },
      { key: 'silverThreshold', label: 'Silver threshold', type: 'number' },
      { key: 'silverDiscount', label: 'Silver discount (%)', type: 'number' },
      { key: 'goldThreshold', label: 'Gold threshold', type: 'number' },
      { key: 'goldDiscount', label: 'Gold discount (%)', type: 'number' },
    ],
    BIRTHDAY_REWARD: [
      { key: 'discountPercent', label: 'Discount percentage', type: 'number' },
      { key: 'couponCode', label: 'Coupon code' },
      { key: 'validityDays', label: 'Validity (days)', type: 'number' },
    ],
    REFER_EARN: [
      { key: 'referrerReward', label: 'Referrer reward', type: 'number' },
      { key: 'friendReward', label: 'Friend reward', type: 'number' },
    ],
    CASHBACK: [
      { key: 'cashbackPercent', label: 'Cashback percentage', type: 'number' },
      { key: 'maxCashback', label: 'Maximum cashback', type: 'number' },
    ],
    EXCLUSIVE_OFFERS: [
      { key: 'discountPercent', label: 'Discount percentage', type: 'number' },
      { key: 'minimumOrderValue', label: 'Minimum order value', type: 'number' },
    ],
    ORDER_STREAK: [
      { key: 'consecutiveDays', label: 'Consecutive days required', type: 'number' },
      { key: 'rewardDescription', label: 'Reward description', className: 'span-2' },
    ],
  };
  return map[programType] || [];
}

function normalizeProgramConfig(programType, form) {
  const numericFieldsByProgram = {
    POINTS: ['pointsPerRupee', 'redemptionPoints', 'redemptionValue'],
    STAMP_CARD: ['stampsRequired'],
    MEMBERSHIP_TIERS: [
      'bronzeThreshold',
      'bronzeDiscount',
      'silverThreshold',
      'silverDiscount',
      'goldThreshold',
      'goldDiscount',
    ],
    BIRTHDAY_REWARD: ['discountPercent', 'validityDays'],
    REFER_EARN: ['referrerReward', 'friendReward'],
    CASHBACK: ['cashbackPercent', 'maxCashback'],
    EXCLUSIVE_OFFERS: ['discountPercent', 'minimumOrderValue'],
    ORDER_STREAK: ['consecutiveDays'],
  };
  const numericFields = new Set(numericFieldsByProgram[programType] || []);
  const out = {};
  Object.entries(form || {}).forEach(([key, value]) => {
    if (value === '' || value == null) return;
    out[key] = numericFields.has(key) ? Number(value) : value;
  });
  return out;
}

function startCase(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (m) => m.toUpperCase());
}
