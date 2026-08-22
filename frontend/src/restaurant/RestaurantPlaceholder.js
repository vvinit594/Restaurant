import React from 'react';
import { Link } from 'react-router-dom';

export default function RestaurantPlaceholder({ title, description }) {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>{title}</h1>
          <p className="admin-muted">{description}</p>
        </div>
      </div>
      <div className="admin-empty">
        <h3>Coming next</h3>
        <p>Scaffolded for NestJS + Prisma. Menu management is available now.</p>
        <Link to="/restaurant/menu" className="admin-btn admin-btn-primary">
          Go to Menu
        </Link>
      </div>
    </div>
  );
}
