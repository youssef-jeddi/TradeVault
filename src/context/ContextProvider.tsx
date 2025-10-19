import { type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "../config/privyConfig";

function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={privyConfig.appId} config={privyConfig.config}>
      {children}
    </PrivyProvider>
  );
}

export default ContextProvider;

