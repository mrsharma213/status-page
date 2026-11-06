export type AppEnv = {
  nodeEnv?: string;
  vercel?: string;
  vercelEnv?: string;
  allowSyntheticDemo?: string;
  allowSyntheticDemoLocal?: string;
  displayTimeZone?: string;
  evidenceHostAllowlist?: string;
  ownerPassword?: string;
  ingestSecret?: string;
  authSecret?: string;
  automationBypassSecret?: string;
  blobToken?: string;
  blobStoreId?: string;
};

export function envFrom(source: Record<string, string | undefined>): AppEnv {
  return {
    nodeEnv: source.NODE_ENV,
    vercel: source.VERCEL,
    vercelEnv: source.VERCEL_ENV,
    allowSyntheticDemo: source.ALLOW_SYNTHETIC_DEMO,
    allowSyntheticDemoLocal: source.ALLOW_SYNTHETIC_DEMO_LOCAL,
    displayTimeZone: source.DISPLAY_TIMEZONE,
    evidenceHostAllowlist: source.EVIDENCE_HOST_ALLOWLIST,
    ownerPassword: source.OWNER_PASSWORD,
    ingestSecret: source.INGEST_SECRET,
    authSecret: source.AUTH_SECRET,
    automationBypassSecret: source.VERCEL_AUTOMATION_BYPASS_SECRET,
    blobToken: source.BLOB_READ_WRITE_TOKEN,
    blobStoreId: source.BLOB_STORE_ID,
  };
}
