import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import Footer from './Footer';

const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <PublicNavbar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
