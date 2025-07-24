import { Route, Routes } from 'react-router-dom';
import { Signin } from '@pages/Signin';
import { Dashboard } from '@pages/Dashboard';
import { Layout } from '@components/Layout';
import { AppProvider } from '@hooks/index';
import { Directories } from '@pages/Directories';
import { Certificates } from '@pages/Certificates';
import { RequireAuth } from '@components/auth/RequireAuth';
import { Configuration } from './pages/Configuration';
import { Sieg } from '@pages/Sieg';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/*" element={<Signin />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
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
            path="/directories"
            element={
              <RequireAuth>
                <Directories />
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
            path="/sieg"
            element={
              <RequireAuth>
                <Sieg />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </AppProvider>
  );
}
