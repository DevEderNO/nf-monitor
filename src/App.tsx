import { Route, Routes } from "react-router-dom";
import { Signin } from "@pages/Signin";
import { Dashboard } from "@pages/Dashboard";
import { Layout } from "@components/Layout";
import { AppProvider } from "@hooks/index";
import { Directories } from "@pages/Directories";
import { RequireAuth } from "@components/auth/RequireAuth";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout></Layout>}>
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
            path="/directories"
            element={
              <RequireAuth>
                <Directories />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </AppProvider>
  );
}
