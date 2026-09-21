import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { useToast } from '../admin/components/Toast';
import {
  createEngagementCoupon,
  getEngagementCampaigns,
  getEngagementCoupons,
  getEngagementCustomers,
  sendEngagementNotification,
} from '../services/loyaltyApi';

const INITIAL_COUPON = {
  title: '20% OFF on your next order',
  description: 'Exclusive DilYum offer',
  discountType: 'PERCENT',
  discountValue: '20',
  code: 'WELCOME20',
  minimumOrderValue: '',
  maximumDiscount: '',
  expiresAt: '',
  usageLimit: '',
};

const INITIAL_SEND = {
  title: 'Special Offer from DilYum',
  message: 'Get 20% OFF on your next order.',
  targeting: 'PREVIOUSLY_ORDERED',
  couponId: '',
  customerId: '',
};

export default function RestaurantEngagementTab({ canSend }) {
  const { push } = useToast();
  const [section, setSection] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [targeting, setTargeting] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [couponForm, setCouponForm] = useState(INITIAL_COUPON);
  const [sendForm, setSendForm] = useState(INITIAL_SEND);
  const [saving, setSaving] = useState(false);

  async function loadCustomers(page = 1) {
    setLoading(true);
    try {
      const data = await getEngagementCustomers({
        page,
        limit: 20,
        search,
        targeting,
      });
      setCustomers(data.items || []);
      setPageInfo({
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        total: data.total || 0,
      });
    } catch (err) {
      push(err.message || 'Failed to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadCouponsAndCampaigns() {
    try {
      const [couponData, campaignData] = await Promise.all([
        getEngagementCoupons(),
        getEngagementCampaigns(),
      ]);
      setCoupons(couponData.items || []);
      setCampaigns(campaignData.items || []);
    } catch (err) {
      push(err.message || 'Failed to load offers.', 'error');
    }
  }

  useEffect(() => {
    const t = setTimeout(() => loadCustomers(1), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, targeting]);

  useEffect(() => {
    loadCouponsAndCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateCoupon(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createEngagementCoupon({
        title: couponForm.title,
        description: couponForm.description || undefined,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        code: couponForm.code,
        minimumOrderValue: couponForm.minimumOrderValue
          ? Number(couponForm.minimumOrderValue)
          : undefined,
        maximumDiscount: couponForm.maximumDiscount
          ? Number(couponForm.maximumDiscount)
          : undefined,
        expiresAt: couponForm.expiresAt || undefined,
        usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : undefined,
      });
      push(`Coupon ${created.code} created.`);
      setSendForm((p) => ({ ...p, couponId: created.id }));
      await loadCouponsAndCampaigns();
    } catch (err) {
      push(err.message || 'Could not create coupon.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onSend(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: sendForm.title,
        message: sendForm.message,
        targeting: sendForm.targeting,
        couponId: sendForm.couponId || undefined,
        customerIds:
          sendForm.targeting === 'INDIVIDUAL' && sendForm.customerId
            ? [sendForm.customerId]
            : undefined,
      };
      const result = await sendEngagementNotification(payload);
      push(
        `Notification sent to ${result.recipientCount} customer(s). Delivered: ${result.deliveredCount}.`,
      );
      await loadCouponsAndCampaigns();
    } catch (err) {
      push(err.message || 'Could not send notification.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="loyalty-engagement">
      <p className="admin-muted">
        Device-based diners who visited or ordered. Send push notifications and coupons instead of WhatsApp.
      </p>
      <div className="loyalty-view-toggle" role="tablist" aria-label="Engagement sections">
        {[['customers', 'Customers'], ['offers', 'Coupons'], ['send', 'Send notification'], ['history', 'Sent history']].map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              className={`loyalty-view-tab ${section === id ? 'active' : ''}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {section === 'customers' ? (
        <section className="admin-panel">
          <div className="admin-toolbar">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers"
            />
            <select value={targeting} onChange={(e) => setTargeting(e.target.value)}>
              <option value="ALL">All eligible customers</option>
              <option value="PREVIOUSLY_ORDERED">Previously ordered</option>
            </select>
          </div>
          {loading ? (
            <Loader variant="inline" label="Loading customers…" />
          ) : customers.length === 0 ? (
            <p className="admin-muted">No device customers yet. They appear after a visit or order.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Orders</th>
                    <th>Last ordered</th>
                    <th>Push</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.displayName}</strong>
                        <div className="admin-cell-sub">{row.phone || row.email || 'Device diner'}</div>
                      </td>
                      <td>{row.orderCount}</td>
                      <td>{row.lastOrderedAt ? new Date(row.lastOrderedAt).toLocaleString('en-IN') : '—'}</td>
                      <td>{row.pushEnabled ? 'Enabled' : 'Not enabled'}</td>
                      <td>
                        {canSend ? (
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => {
                              setSendForm((p) => ({
                                ...p,
                                targeting: 'INDIVIDUAL',
                                customerId: row.id,
                              }));
                              setSection('send');
                            }}
                          >
                            Send notification
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="loyalty-pagination">
            <span className="admin-muted">
              Page {pageInfo.page} of {pageInfo.totalPages} · {pageInfo.total} customers
            </span>
            <button type="button" className="admin-btn admin-btn-ghost" disabled={pageInfo.page <= 1} onClick={() => loadCustomers(pageInfo.page - 1)}>
              Previous
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" disabled={pageInfo.page >= pageInfo.totalPages} onClick={() => loadCustomers(pageInfo.page + 1)}>
              Next
            </button>
          </div>
        </section>
      ) : null}

      {section === 'offers' ? (
        <section className="admin-panel">
          {canSend ? (
            <form className="admin-form" onSubmit={onCreateCoupon}>
              <h3>Create coupon</h3>
              <label>Title<input value={couponForm.title} onChange={(e) => setCouponForm((p) => ({ ...p, title: e.target.value }))} required /></label>
              <label>Description<input value={couponForm.description} onChange={(e) => setCouponForm((p) => ({ ...p, description: e.target.value }))} /></label>
              <label>
                Discount type
                <select value={couponForm.discountType} onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value }))}>
                  <option value="PERCENT">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </label>
              <label>Discount value<input type="number" min="0" step="0.01" value={couponForm.discountValue} onChange={(e) => setCouponForm((p) => ({ ...p, discountValue: e.target.value }))} required /></label>
              <label>Coupon code<input value={couponForm.code} onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value }))} required /></label>
              <label>Minimum order value<input type="number" min="0" value={couponForm.minimumOrderValue} onChange={(e) => setCouponForm((p) => ({ ...p, minimumOrderValue: e.target.value }))} /></label>
              <label>Maximum discount<input type="number" min="0" value={couponForm.maximumDiscount} onChange={(e) => setCouponForm((p) => ({ ...p, maximumDiscount: e.target.value }))} /></label>
              <label>Expiry date<input type="date" value={couponForm.expiresAt} onChange={(e) => setCouponForm((p) => ({ ...p, expiresAt: e.target.value }))} /></label>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create coupon'}
              </button>
            </form>
          ) : null}
          <h3>Existing coupons</h3>
          {coupons.length === 0 ? (
            <p className="admin-muted">No coupons yet.</p>
          ) : (
            <ul className="admin-muted">
              {coupons.map((c) => (
                <li key={c.id}>
                  {c.title} · {c.code} · granted {c.grantedCount}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {section === 'send' ? (
        <section className="admin-panel">
          <form className="admin-form" onSubmit={onSend}>
            <h3>Send push notification</h3>
            <label>Title<input value={sendForm.title} onChange={(e) => setSendForm((p) => ({ ...p, title: e.target.value }))} required /></label>
            <label>Message<textarea value={sendForm.message} onChange={(e) => setSendForm((p) => ({ ...p, message: e.target.value }))} required rows={4} /></label>
            <label>
              Targeting
              <select value={sendForm.targeting} onChange={(e) => setSendForm((p) => ({ ...p, targeting: e.target.value }))}>
                <option value="ALL_ELIGIBLE">All eligible customers</option>
                <option value="PREVIOUSLY_ORDERED">Previously ordered customers</option>
                <option value="INDIVIDUAL">Individual customer</option>
              </select>
            </label>
            {sendForm.targeting === 'INDIVIDUAL' ? (
              <label>
                Customer
                <select value={sendForm.customerId} onChange={(e) => setSendForm((p) => ({ ...p, customerId: e.target.value }))}>
                  <option value="">Select customer</option>
                  {customers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.displayName} ({row.orderCount} orders)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Attach coupon
              <select value={sendForm.couponId} onChange={(e) => setSendForm((p) => ({ ...p, couponId: e.target.value }))}>
                <option value="">None</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-panel" style={{ marginBottom: 12 }}>
              <strong>Preview</strong>
              <p>{sendForm.title}</p>
              <p>{sendForm.message}</p>
            </div>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !canSend}>
              {saving ? 'Sending…' : 'Send notification'}
            </button>
          </form>
        </section>
      ) : null}

      {section === 'history' ? (
        <section className="admin-panel">
          {campaigns.length === 0 ? (
            <p className="admin-muted">No notifications sent yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Targeting</th>
                    <th>Recipients</th>
                    <th>Delivered</th>
                    <th>Status</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.title}</strong>
                        <div className="admin-cell-sub">{row.couponCode || 'No coupon'}</div>
                      </td>
                      <td>{row.targeting}</td>
                      <td>{row.recipientCount}</td>
                      <td>{row.deliveredCount}</td>
                      <td>{row.status}</td>
                      <td>{row.sentAt ? new Date(row.sentAt).toLocaleString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
