import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminPlaceholder({ title, description }) {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>{title}</h1>
          <p className="admin-muted">{description}</p>
        </div>
      </div>
      <div className="admin-empty">
        <h3>Coming in the next phase</h3>
        <p>
          This section is scaffolded for NestJS + PostgreSQL + Prisma integration.
          Restaurant management is available now.
        </p>
        <Link to="/admin/restaurants" className="admin-btn admin-btn-primary">
          Go to Restaurants
        </Link>
      </div>
    </div>
  );
}
