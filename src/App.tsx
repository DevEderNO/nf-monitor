import { Route, Routes } from 'react-router-dom';
import { Signin } from '@pages/Signin';
import { Layout } from '@components/Layout';
import { AppProvider } from '@hooks/index';
import { RequireAuth } from '@components/auth/RequireAuth';
import { Configuration } from '@pages/Configuration';
import { UploadCertificates } from './pages/UploadCertificates';
import { DownloadInvoicesSieg } from './pages/DownloadInvoicesSieg';
import { UploadInvoices } from './pages/UploadInvoices';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/*" element={<Signin />} />
          <Route
            path="/upload-invoices"
            element={
              <RequireAuth>
                <UploadInvoices />
              </RequireAuth>
            }
          />
          <Route
            path="/configuration"
            element={
              <RequireAuth>
                <Configuration />
              </RequireAuth>
            }
          />
          <Route
            path="/download-invoices-sieg"
            element={
              <RequireAuth>
                <DownloadInvoicesSieg />
              </RequireAuth>
            }
          />
          <Route
            path="/upload-certificates"
            element={
              <RequireAuth>
                <UploadCertificates />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </AppProvider>
  );
}
