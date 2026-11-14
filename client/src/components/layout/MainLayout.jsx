import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import AppFooter from './AppFooter';
import PublicNavbar from './PublicNavbar';
import Footer from './Footer';

const MainLayout = () => {
  const { isAuthenticated } = useAuth();

  // Collapsed state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('skillswap_sidebar_collapsed') === 'true';
  });

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleCollapse = (collapsedState) => {
    setIsCollapsed(collapsedState);
    localStorage.setItem('skillswap_sidebar_collapsed', String(collapsedState));
  };

  // If user is not authenticated (browsing /skills publicly), render public layout
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <PublicNavbar />
        <main className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </main>
        <Footer />
      </div>
    );
  }

  // Authenticated Application Layout with Collapsible Sidebar & Minimal Header
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Fixed Left Sidebar (Collapsible & Mobile Drawer) */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area beside Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Minimal Top Header */}
        <Header onOpenMobileMenu={() => setMobileOpen(true)} />

        {/* Scrollable Page Outlet */}
        <main className="flex-1 flex flex-col min-w-0 w-full">
          <Outlet />
        </main>

        {/* In-App Clean Footer */}
        <AppFooter />
      </div>
    </div>
  );
};

export default MainLayout;
