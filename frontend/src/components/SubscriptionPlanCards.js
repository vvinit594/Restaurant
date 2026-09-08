import React from 'react';

/**
 * Shared DilYum subscription plan selector (Trial + Monthly + Launch).
 * Expects plan objects from GET /plans (id, name, priceLabel, badge, features, …).
 */
export default function SubscriptionPlanCards({
  plans,
  selectedId,
  onSelect,
  disabled = false,
}) {
  const list = Array.isArray(plans) ? plans : [];

  return (
    <div className="admin-sub-plan-grid">
      {list.map((plan) => {
        const id = plan.id || String(plan.code || '').toLowerCase();
        const selected = selectedId === id;
        let theme = plan.theme || 'orange';
        if (!plan.theme) {
          if (id === 'launch') theme = 'blue';
          else if (id === 'trial_10_days') theme = 'trial';
          else theme = 'orange';
        }
        return (
          <button
            key={id}
            type="button"
            className={`admin-sub-plan-card theme-${theme} ${selected ? 'selected' : ''}`}
            onClick={() => onSelect(id)}
            disabled={disabled}
            aria-pressed={selected}
          >
            {plan.badge ? (
              <span className="admin-sub-plan-badge">{plan.badge}</span>
            ) : null}

            <div className="admin-sub-plan-icon" aria-hidden="true">
              <span className={`admin-sub-plan-glyph glyph-${theme}`} />
            </div>

            <h3 className="admin-sub-plan-name">{plan.name}</h3>
            {plan.description ? (
              <p className="admin-sub-plan-desc">{plan.description}</p>
            ) : null}

            <p className="admin-sub-plan-price">{plan.priceLabel}</p>

            {plan.specialNotice ? (
              <p className="admin-sub-plan-notice">{plan.specialNotice}</p>
            ) : null}

            <ul className="admin-sub-plan-features">
              {(plan.features || []).map((f) => (
                <li key={f}>
                  <span className="admin-sub-plan-check" aria-hidden="true">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="admin-sub-plan-branch">
              <span>BRANCH LIMIT</span>
              <strong>
                Up to {plan.branchLimit ?? 5} Branches
              </strong>
            </div>

            <span className="admin-sub-plan-cta">
              {plan.ctaLabel || `Choose ${plan.name}`} →
            </span>
          </button>
        );
      })}
    </div>
  );
}
