export {};

declare global {
  interface CustomJwtSessionClaims {
    sufeiyaBetaAccess?: {
      protocolVersion?: string;
      status?: string;
    } | null;
  }
}
