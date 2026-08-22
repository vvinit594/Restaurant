import React from 'react';

function Navbar({ darkMode, onToggleDarkMode }) {
  return (
    <header className={`navbar ${darkMode ? 'dark' : 'light'}`}>
      <div className="brand">
        <div className="brand-logo">🍽️</div>
        <div>
          <h1>MenuScanner</h1>
          <p>Scan menus, browse dishes, order fast.</p>
        </div>
      </div>

      <nav className="nav-links">
        <a href="#hero">Home</a>
        <a href="#menu">Menu</a>
        <a href="#cart">Cart</a>
      </nav>

      <button className="theme-toggle" onClick={onToggleDarkMode}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
    </header>
  );
}

export default Navbar;
