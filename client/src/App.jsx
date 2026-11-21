import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthModal } from './components/auth/AuthModal.jsx';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.jsx';
import { PublicLayout } from './components/layout/PublicLayout.jsx';
import { RedirectIfSignedIn, RequireAuth } from './components/layout/RouteGuards.jsx';
import { PageLoader } from './components/ui/Feedback.jsx';

// Every page is its own chunk, loaded on first visit. Each page file has a default export.
const Home = lazy(() => import('./pages/public/Home.jsx'));
const FindLawyer = lazy(() => import('./pages/public/FindLawyer.jsx'));
const LawyerProfile = lazy(() => import('./pages/public/LawyerProfile.jsx'));
const Categories = lazy(() => import('./pages/public/Categories.jsx'));
const HowItWorks = lazy(() => import('./pages/public/HowItWorks.jsx'));
const About = lazy(() => import('./pages/public/About.jsx'));
const Contact = lazy(() => import('./pages/public/Contact.jsx'));
const Help = lazy(() => import('./pages/public/Help.jsx'));
const Terms = lazy(() => import('./pages/public/Terms.jsx'));
const Privacy = lazy(() => import('./pages/public/Privacy.jsx'));
const Disclaimer = lazy(() => import('./pages/public/Disclaimer.jsx'));
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'));
const DescribeProblem = lazy(() => import('./pages/public/DescribeProblem.jsx'));
const FeeAssistant = lazy(() => import('./pages/public/FeeAssistant.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));

const Messages = lazy(() => import('./pages/shared/Messages.jsx'));
const Account = lazy(() => import('./pages/shared/Account.jsx'));

const ClientOverview = lazy(() => import('./pages/client/Overview.jsx'));
const ClientRequests = lazy(() => import('./pages/client/Requests.jsx'));
const ClientRequestDetail = lazy(() => import('./pages/client/RequestDetail.jsx'));
const ClientQuotations = lazy(() => import('./pages/client/Quotations.jsx'));
const ClientQuotationDetail = lazy(() => import('./pages/client/QuotationDetail.jsx'));
const ClientAppointments = lazy(() => import('./pages/client/Appointments.jsx'));
const ClientSaved = lazy(() => import('./pages/client/Saved.jsx'));

const LawyerOverview = lazy(() => import('./pages/lawyer/Overview.jsx'));
const LawyerProfileEditor = lazy(() => import('./pages/lawyer/Profile.jsx'));
const LawyerQuotations = lazy(() => import('./pages/lawyer/Quotations.jsx'));
const LawyerQuotationDetail = lazy(() => import('./pages/lawyer/QuotationDetail.jsx'));
const LawyerAppointments = lazy(() => import('./pages/lawyer/Appointments.jsx'));

const AdminOverview = lazy(() => import('./pages/admin/Overview.jsx'));
const AdminApplications = lazy(() => import('./pages/admin/Applications.jsx'));
const AdminApplicationDetail = lazy(() => import('./pages/admin/ApplicationDetail.jsx'));
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews.jsx'));
const AdminCases = lazy(() => import('./pages/admin/Cases.jsx'));
const AdminTaxonomy = lazy(() => import('./pages/admin/Taxonomy.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/Audit.jsx'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public site. Browsing never needs an account; actions that do open the sign-in dialog in place. */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="lawyers" element={<FindLawyer />} />
            <Route path="lawyers/:slug" element={<LawyerProfile />} />
            <Route path="categories" element={<Categories />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="help" element={<Help />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="disclaimer" element={<Disclaimer />} />
            <Route path="describe-problem" element={<DescribeProblem />} />
            <Route path="fee-assistant" element={<FeeAssistant />} />
            <Route path="login" element={<RedirectIfSignedIn><Login /></RedirectIfSignedIn>} />
            <Route path="register" element={<RedirectIfSignedIn><Register /></RedirectIfSignedIn>} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Signed-in pages for every role. The API enforces access again on each request. */}
          <Route element={<RequireAuth />}>
            <Route element={<DashboardLayout />}>
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:id" element={<Messages />} />
              <Route path="account" element={<Account />} />
            </Route>
          </Route>

          <Route element={<RequireAuth roles={['client']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="client" element={<ClientOverview />} />
              <Route path="client/requests" element={<ClientRequests />} />
              <Route path="client/requests/new" element={<Navigate to="/describe-problem" replace />} />
              <Route path="client/requests/:id" element={<ClientRequestDetail />} />
              <Route path="client/quotations" element={<ClientQuotations />} />
              <Route path="client/quotations/:id" element={<ClientQuotationDetail />} />
              <Route path="client/appointments" element={<ClientAppointments />} />
              <Route path="client/saved" element={<ClientSaved />} />
            </Route>
          </Route>

          <Route element={<RequireAuth roles={['lawyer']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="lawyer" element={<LawyerOverview />} />
              <Route path="lawyer/profile" element={<LawyerProfileEditor />} />
              <Route path="lawyer/quotations" element={<LawyerQuotations />} />
              <Route path="lawyer/quotations/:id" element={<LawyerQuotationDetail />} />
              <Route path="lawyer/appointments" element={<LawyerAppointments />} />
            </Route>
          </Route>

          <Route element={<RequireAuth roles={['admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="admin" element={<AdminOverview />} />
              <Route path="admin/applications" element={<AdminApplications />} />
              <Route path="admin/applications/:id" element={<AdminApplicationDetail />} />
              <Route path="admin/reports" element={<AdminReports />} />
              <Route path="admin/reviews" element={<AdminReviews />} />
              <Route path="admin/cases" element={<AdminCases />} />
              <Route path="admin/taxonomy" element={<AdminTaxonomy />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/audit" element={<AdminAudit />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      {/* The sign-in / register dialog that pages open through useAuth().promptAuth(). */}
      <AuthModal />
    </ErrorBoundary>
  );
}
