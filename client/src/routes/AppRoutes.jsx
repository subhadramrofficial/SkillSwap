import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import PublicLayout from '../components/layout/PublicLayout';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';

// Public pages
import LandingPage from '../pages/public/LandingPage';
import NotFoundPage from '../pages/public/NotFoundPage';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import AdminLoginPage from '../pages/auth/AdminLoginPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// User pages
import DashboardPage from '../pages/user/DashboardPage';
import ProfilePage from '../pages/user/ProfilePage';
import EditProfilePage from '../pages/user/EditProfilePage';

// Skills & Discovery pages
import ExploreSkillsPage from '../pages/skills/ExploreSkillsPage';
import SkillDetailsPage from '../pages/skills/SkillDetailsPage';
import MySkillsPage from '../pages/skills/MySkillsPage';
import PartnerDiscoveryPage from '../pages/exchanges/PartnerDiscoveryPage';
import ConnectedPartnersPage from '../pages/exchanges/ConnectedPartnersPage';
import ExchangeManagementPage from '../pages/exchanges/ExchangeManagementPage';
import MessagesPage from '../pages/chat/MessagesPage';
import GiftMoneyPage from '../pages/gifts/GiftMoneyPage';
import SubscriptionPage from '../pages/subscription/SubscriptionPage';
import NotificationsPage from '../pages/notifications/NotificationsPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      {/* Authentication Pages (Standalone Layout, No Sidebar) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      </Route>

      {/* Application Routes with Sidebar Navigation */}
      <Route element={<MainLayout />}>
        {/* Publicly browsable skill directory */}
        <Route path="/skills" element={<ExploreSkillsPage />} />
        <Route path="/skills/:id" element={<SkillDetailsPage />} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />

          {/* Skills Management & Partner Discovery */}
          <Route path="/my-skills" element={<MySkillsPage />} />
          <Route path="/find-partners" element={<PartnerDiscoveryPage />} />
          <Route path="/connected-partners" element={<ConnectedPartnersPage />} />

          {/* Exchange Management */}
          <Route path="/exchanges" element={<ExchangeManagementPage />} />
          <Route path="/exchanges/*" element={<ExchangeManagementPage />} />

          {/* Live Chat Messaging & Simulated Gift Money */}
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/gift-money" element={<GiftMoneyPage />} />

          {/* Membership & Free Exchange Limits */}
          <Route path="/subscription" element={<SubscriptionPage />} />
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminDashboardPage />} />
          <Route path="/admin/skills" element={<AdminDashboardPage />} />
          <Route path="/admin/categories" element={<AdminDashboardPage />} />
          <Route path="/admin/reports" element={<AdminDashboardPage />} />
          <Route path="/admin/*" element={<AdminDashboardPage />} />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
