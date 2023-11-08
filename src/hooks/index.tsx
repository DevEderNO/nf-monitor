import { AuthProvider } from "./auth";
import { SocketProvider } from "./socket";
import { StateProvider } from "./state";
import { ThemeProvider } from "./theme";

const AppProvider = ({ children }: React.PropsWithChildren) => (
  <StateProvider>
    <SocketProvider>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </SocketProvider>
  </StateProvider>
);

export { AppProvider };
