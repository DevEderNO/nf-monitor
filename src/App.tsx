import { Route, Routes } from 'react-router-dom';
import { Signin } from '@pages/Signin';
import { Invoices } from '@pages/Invoices';
import { Layout } from '@components/Layout';
import { AppProvider } from '@hooks/index';
import { Certificates } from '@pages/Certificates';
import { RequireAuth } from '@components/auth/RequireAuth';
import { Configuration } from './pages/Configuration';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/*" element={<Signin />} />
          <Route
            path="/invoices"
            element={
              <RequireAuth>
                <Invoices />
              </RequireAuth>
            }
          />
          <Route
            path="/certificates"
            element={
              <RequireAuth>
                <Certificates />
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
        </Route>
      </Routes>
    </AppProvider>
  );
}
