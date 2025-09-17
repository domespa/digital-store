import { createContext, useContext, type ReactNode } from "react";
import type { LandingConfig, LandingContextType } from "../types/landing";
import { useLanding } from "../hooks/useLanding";

const LandingContext = createContext<LandingContextType | undefined>(undefined);

export const useLandingContext = () => {
  const context = useContext(LandingContext);

  if (!context) {
    throw new Error("ERRORE CRITICO, METTI CONTEXT DENTRO PROVIDER");
  }

  return context;
};

export const LandingProvider = ({
  children,
  config,
}: {
  children: ReactNode;
  config: LandingConfig;
}) => {
  const landingData = useLanding(config);
  return (
    <LandingContext.Provider value={landingData}>
      {children}
    </LandingContext.Provider>
  );
};
