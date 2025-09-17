import { AuthProvider } from "./context/AuthContext";
import LandingPage from "./components/landing/LandingPage";
import adhdWomenConfig from "./config/landing-config/adhd-women.config";

export default function App() {
  return (
    <AuthProvider>
      <LandingPage config={adhdWomenConfig} />
    </AuthProvider>
  );
}
