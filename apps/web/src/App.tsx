import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "@/components/common/LoadingSpinner";
import AppLayout from "@/components/layout/AppLayout";

import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import VerifyOtpPage from "@/pages/auth/VerifyOtpPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

import DashboardPage from "@/pages/dashboard/DashboardPage";

import ResidentListPage from "@/pages/residents/ResidentListPage";
import ResidentAdmissionPage from "@/pages/residents/ResidentAdmissionPage";
import ResidentDetailPage from "@/pages/residents/ResidentDetailPage";
import ResidentSearchPage from "@/pages/residents/ResidentSearchPage";

import PropertySetupPage from "@/pages/property/PropertySetupPage";
import OccupancyPage from "@/pages/property/OccupancyPage";

import DuesPage from "@/pages/billing/DuesPage";
import RecordPaymentPage from "@/pages/billing/RecordPaymentPage";
import PaymentHistoryPage from "@/pages/billing/PaymentHistoryPage";

import ReportsPage from "@/pages/reports/ReportsPage";

import NotificationListPage from "@/pages/notifications/NotificationListPage";
import NotificationComposePage from "@/pages/notifications/NotificationComposePage";
import NotificationTemplatesPage from "@/pages/notifications/NotificationTemplatesPage";

import AuditLogPage from "@/pages/settings/AuditLogPage";

import SettingsPage from "@/pages/settings/SettingsPage";
import StaffManagementPage from "@/pages/settings/StaffManagementPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/residents" element={<ResidentListPage />} />
        <Route path="/residents/new" element={<ResidentAdmissionPage />} />
        <Route path="/residents/:id" element={<ResidentDetailPage />} />
        <Route path="/residents/search" element={<ResidentSearchPage />} />

        <Route path="/property" element={<PropertySetupPage />} />
        <Route path="/property/occupancy" element={<OccupancyPage />} />

        <Route path="/billing" element={<DuesPage />} />
        <Route path="/billing/record-payment" element={<RecordPaymentPage />} />
        <Route path="/billing/payments" element={<PaymentHistoryPage />} />

        <Route path="/reports" element={<ReportsPage />} />

        <Route path="/notifications" element={<NotificationListPage />} />
        <Route path="/notifications/compose" element={<NotificationComposePage />} />
        <Route path="/notifications/templates" element={<NotificationTemplatesPage />} />

        <Route path="/audit-log" element={<AuditLogPage />} />

        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/staff" element={<StaffManagementPage />} />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
